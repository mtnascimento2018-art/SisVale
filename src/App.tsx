import React, { useState, useEffect, memo, useRef } from "react";
import { BusLine, Location, RouteState } from "./types";
import { fetchBusLines, geocodeCEP } from "./services/api";
import Map from "./components/Map";
import Admin from "./components/Admin";
import L from "leaflet";
import { MapPin, Bus, Calculator, Settings, Search, ChevronRight, Info, FileText, Download } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import jsPDF from "jspdf";
import * as htmlToImage from "html-to-image";

const MemoizedMap = memo(Map);

export default function App() {
  const [activeTab, setActiveTab] = useState<"user" | "admin">("user");
  const [busLines, setBusLines] = useState<BusLine[]>([]);
  const [cepOrigem, setCepOrigem] = useState("");
  const [cepDestino, setCepDestino] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const mapRef = useRef<HTMLDivElement>(null);
  const [route, setRoute] = useState<RouteState>({
    origin: null,
    destination: null,
    selectedLines: [],
    daysWorked: 22,
    isRoundTrip: true,
  });

  useEffect(() => {
    if (activeTab === "user") {
      loadLines();
    }
  }, [activeTab]);

  const loadLines = async () => {
    try {
      const data = await fetchBusLines(true);
      setBusLines(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
    }
  };

  const handleSearch = async () => {
    if (!cepOrigem || !cepDestino) {
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const [origin, destination] = await Promise.all([
        geocodeCEP(cepOrigem),
        geocodeCEP(cepDestino),
      ]);
      setRoute((prev) => {
        if (!prev) return prev;
        return { ...prev, origin, destination };
      });
    } catch (error: any) {
      console.error(error.message || "Erro ao buscar CEPs");
      setError(error.message || "Erro ao buscar CEPs. Verifique os dados e tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleLine = (line: BusLine) => {
    if (!line) return;
    setRoute((prev) => {
      if (!prev || !prev.selectedLines) return prev;
      const isSelected = prev.selectedLines.some((l) => l?.routeId === line?.routeId);
      if (isSelected) {
        return { ...prev, selectedLines: prev.selectedLines.filter((l) => l?.routeId !== line?.routeId) };
      } else {
        return { ...prev, selectedLines: [...prev.selectedLines, line] };
      }
    });
  };

  const filteredLines = busLines.filter(line => 
    line.name?.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
    line.routeId?.toLowerCase().includes(userSearchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredLines.length / itemsPerPage);
  const paginatedLines = filteredLines.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [userSearchTerm]);

  const valorIda = (route?.selectedLines || []).reduce((sum, l) => sum + (l?.price || 0), 0);
  const valorIdaVolta = route.isRoundTrip ? valorIda * 2 : valorIda;
  const custoMensal = valorIdaVolta * (route?.daysWorked || 0);

  const generatePDF = async () => {
    if (!route.origin || !route.destination) return;
    
    setIsGeneratingPDF(true);
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 15;
      const contentWidth = pageWidth - (margin * 2);
      
      // Helper for distance/duration
      const getWalkingMetrics = (start: [number, number], end: [number, number]) => {
        const dist = L.latLng(start).distanceTo(L.latLng(end));
        const dur = dist / 1.388; // 5km/h
        return { dist, dur };
      };

      const formatDist = (m: number) => m < 1000 ? `${Math.round(m)}m` : `${(m / 1000).toFixed(1)}km`;
      const formatDur = (s: number) => {
        const mins = Math.round(s / 60);
        return mins < 1 ? "< 1 min" : `${mins} min`;
      };

      // Calculate walking metrics
      let originWalking = { dist: 0, dur: 0 };
      let destWalking = { dist: 0, dur: 0 };
      
      if (route.selectedLines.length > 0) {
        const line = route.selectedLines[0];
        const coords = line.coordinates || [];
        const findClosest = (point: [number, number], polyline: [number, number][]) => {
          let minD = Infinity;
          let closest: [number, number] = polyline[0];
          for (let i = 0; i < polyline.length - 1; i++) {
            const p1 = polyline[i];
            const p2 = polyline[i + 1];
            const dx = p2[1] - p1[1];
            const dy = p2[0] - p1[0];
            if (dx === 0 && dy === 0) continue;
            let t = ((point[1] - p1[1]) * dx + (point[0] - p1[0]) * dy) / (dx * dx + dy * dy);
            t = Math.max(0, Math.min(1, t));
            const proj: [number, number] = [p1[0] + t * dy, p1[1] + t * dx];
            const d = L.latLng(point).distanceTo(L.latLng(proj));
            if (d < minD) { minD = d; closest = proj; }
          }
          return { point: closest, distance: minD };
        };
        const closestOrigin = findClosest([route.origin.lat, route.origin.lng], coords);
        const closestDest = findClosest([route.destination.lat, route.destination.lng], coords);
        originWalking = getWalkingMetrics([route.origin.lat, route.origin.lng], closestOrigin.point);
        destWalking = getWalkingMetrics([route.destination.lat, route.destination.lng], closestDest.point);
      }

      // Header - Compact
      doc.setFillColor(79, 70, 229);
      doc.rect(0, 0, pageWidth, 25, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("Relatório Vale-Rota", margin, 15);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, margin, 20);
      
      let y = 35;

      // Two Column Layout for Info
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("Informações do Percurso", margin, y);
      doc.text("Métricas de Caminhada", pageWidth / 2 + 5, y);
      
      y += 6;
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text("Origem:", margin, y);
      doc.setFont("helvetica", "normal");
      doc.text(`${cepOrigem} - ${route.origin.address}`, margin + 15, y, { maxWidth: pageWidth / 2 - 25 });
      
      doc.setFont("helvetica", "bold");
      doc.text("Início:", pageWidth / 2 + 5, y);
      doc.setFont("helvetica", "normal");
      doc.text(`${formatDist(originWalking.dist)} (~${formatDur(originWalking.dur)})`, pageWidth / 2 + 20, y);

      y += 10;
      doc.setFont("helvetica", "bold");
      doc.text("Destino:", margin, y);
      doc.setFont("helvetica", "normal");
      doc.text(`${cepDestino} - ${route.destination.address}`, margin + 15, y, { maxWidth: pageWidth / 2 - 25 });
      
      doc.setFont("helvetica", "bold");
      doc.text("Final:", pageWidth / 2 + 5, y);
      doc.setFont("helvetica", "normal");
      doc.text(`${formatDist(destWalking.dist)} (~${formatDur(destWalking.dur)})`, pageWidth / 2 + 20, y);

      y += 12;
      doc.setDrawColor(226, 232, 240);
      doc.line(margin, y - 5, pageWidth - margin, y - 5);

      // Lines and Financial Summary
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(`Linhas Selecionadas (${route.selectedLines.length})`, margin, y);
      doc.text("Resumo Financeiro", pageWidth / 2 + 5, y);

      y += 6;
      let lineY = y;
      route.selectedLines.forEach((line, index) => {
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.text(`${index + 1}. ${line.name || line.routeId}`, margin + 2, lineY);
        doc.text(`R$ ${line.price.toFixed(2)}`, margin + 65, lineY);
        lineY += 5;
      });

      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text("Custo Unitário (Ida):", pageWidth / 2 + 5, y);
      doc.setFont("helvetica", "bold");
      doc.text(`R$ ${valorIda.toFixed(2)}`, pageWidth - margin - 20, y, { align: 'right' });
      
      y += 5;
      doc.setFont("helvetica", "normal");
      doc.text(route.isRoundTrip ? "Custo Ida e Volta:" : "Custo (Apenas Ida):", pageWidth / 2 + 5, y);
      doc.setFont("helvetica", "bold");
      doc.text(`R$ ${valorIdaVolta.toFixed(2)}`, pageWidth - margin - 20, y, { align: 'right' });
      
      y += 5;
      doc.setFont("helvetica", "normal");
      doc.text(`Custo Mensal (${route.daysWorked} dias):`, pageWidth / 2 + 5, y);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(79, 70, 229);
      doc.text(`R$ ${custoMensal.toFixed(2)}`, pageWidth - margin - 20, y, { align: 'right' });

      y = Math.max(lineY, y + 10) + 5;

      // Map Screenshot - Compact
      if (mapRef.current) {
        doc.setTextColor(30, 41, 59);
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text("Mapa do Trajeto", margin, y);
        
        const imgData = await htmlToImage.toJpeg(mapRef.current, {
          quality: 0.8,
          pixelRatio: 1.5,
          backgroundColor: '#f1f5f9',
        });
        
        const imgProps = doc.getImageProperties(imgData);
        const imgWidth = contentWidth;
        const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
        
        // Ensure it fits on one page by scaling down if necessary
        const maxMapHeight = pageHeight - y - 15;
        let finalWidth = imgWidth;
        let finalHeight = imgHeight;
        
        if (imgHeight > maxMapHeight) {
          finalHeight = maxMapHeight;
          finalWidth = (imgProps.width * finalHeight) / imgProps.height;
        }
        
        doc.addImage(imgData, 'JPEG', (pageWidth - finalWidth) / 2, y + 5, finalWidth, finalHeight);
      }
      
      doc.save(`relatorio-vale-rota-${new Date().getTime()}.pdf`);
    } catch (err) {
      console.error("Erro ao gerar PDF:", err);
      alert("Erro ao gerar o relatório PDF.");
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  return (
    <div className="flex flex-col md:h-screen min-h-screen w-full bg-slate-50 font-sans text-slate-900 md:overflow-hidden">
      {/* Top Header */}
      <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-xl">
            <Bus className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight leading-none">Vale-Rota</h1>
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest mt-0.5">Verificador de Trajetos</p>
          </div>
        </div>

        <nav className="flex items-center bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab("user")}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === "user" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Search className="w-4 h-4" />
            Consulta
          </button>
          <button
            onClick={() => setActiveTab("admin")}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === "admin" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Settings className="w-4 h-4" />
            Admin
          </button>
        </nav>

        <div className="hidden md:flex items-center gap-4">
          <div className="h-8 w-px bg-slate-200" />
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Info className="w-3.5 h-3.5" />
            <span>v1.0.0</span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col md:overflow-hidden">
        <AnimatePresence mode="wait">
          {activeTab === "user" ? (
            <motion.div
              key="user"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col md:overflow-hidden"
            >
              {/* Horizontal Search Bar */}
              <div className="bg-white border-b border-slate-200 p-4 shadow-sm z-[5] shrink-0">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-end gap-4">
                  <div className="flex-1 w-full space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">CEP de Origem</label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
                      <input
                        type="text"
                        value={cepOrigem}
                        onChange={(e) => setCepOrigem(e.target.value)}
                        placeholder="00000-000"
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                      />
                    </div>
                  </div>

                  <div className="flex-1 w-full space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">CEP de Destino</label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500" />
                      <input
                        type="text"
                        value={cepDestino}
                        onChange={(e) => setCepDestino(e.target.value)}
                        placeholder="00000-000"
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                      />
                    </div>
                  </div>

                  <div className="w-full md:w-32 space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Dias Úteis</label>
                    <input
                      type="number"
                      value={route?.daysWorked || 0}
                      onChange={(e) => setRoute(prev => {
                        if (!prev) return prev;
                        return { ...prev, daysWorked: parseInt(e.target.value) || 0 };
                      })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                    />
                  </div>

                  <div className="flex items-center gap-2 mb-2 md:mb-0 h-10 px-4 bg-slate-50 border border-slate-200 rounded-xl">
                    <input
                      type="checkbox"
                      id="roundTrip"
                      checked={route.isRoundTrip}
                      onChange={(e) => setRoute(prev => ({ ...prev, isRoundTrip: e.target.checked }))}
                      className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                    />
                    <label htmlFor="roundTrip" className="text-xs font-bold text-slate-600 cursor-pointer select-none">Ida e Volta</label>
                  </div>

                  <button
                    onClick={handleSearch}
                    disabled={isLoading}
                    className="w-full md:w-auto bg-indigo-600 text-white px-8 py-2.5 rounded-xl font-bold hover:bg-indigo-700 active:scale-95 transition-all shadow-md shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
                  >
                    {isLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Buscando...
                      </>
                    ) : (
                      <>
                        Calcular Rota
                        <ChevronRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>

                {error && (
                  <div className="max-w-7xl mx-auto mt-4 p-3 bg-red-50 border border-red-200 text-red-600 text-xs font-medium rounded-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                    <Info className="w-4 h-4" />
                    {error}
                  </div>
                )}
              </div>

              {/* Split Content: Map & Results */}
              <div className="flex-1 flex flex-col md:flex-row md:overflow-hidden">
                {/* Left: Selection & Results */}
                <div className="w-full md:w-[400px] bg-white border-r border-slate-200 flex flex-col md:overflow-y-auto shrink-0">
                  <div className="p-6 space-y-8">
                    {/* Address Info */}
                    {(route?.origin || route?.destination) && (
                      <div className="space-y-3">
                        {route?.origin && (
                          <div className="flex gap-3 p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                            <div className="bg-emerald-500 p-1.5 rounded-lg h-fit">
                              <MapPin className="w-3.5 h-3.5 text-white" />
                            </div>
                            <div>
                              <div className="text-[10px] font-bold text-emerald-600 uppercase">Origem</div>
                              <div className="text-xs font-medium text-slate-700 leading-tight mt-0.5">{route?.origin?.address}</div>
                            </div>
                          </div>
                        )}
                        {route?.destination && (
                          <div className="flex gap-3 p-3 bg-red-50 rounded-xl border border-red-100">
                            <div className="bg-red-500 p-1.5 rounded-lg h-fit">
                              <MapPin className="w-3.5 h-3.5 text-white" />
                            </div>
                            <div>
                              <div className="text-[10px] font-bold text-red-600 uppercase">Destino</div>
                              <div className="text-xs font-medium text-slate-700 leading-tight mt-0.5">{route?.destination?.address}</div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Bus Line Selection */}
                    <div className="space-y-4">
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Linhas Disponíveis</h3>
                          <div className="flex items-center gap-2">
                            {(route?.selectedLines || []).length > 0 && (
                              <button 
                                onClick={() => setRoute(prev => ({ ...prev, selectedLines: [] }))}
                                className="text-[10px] font-bold text-red-500 hover:text-red-700 uppercase tracking-tight"
                              >
                                Limpar
                              </button>
                            )}
                            <span className="text-[10px] font-bold bg-slate-100 px-2 py-0.5 rounded-full text-slate-500">
                              {(route?.selectedLines || []).length} selecionadas
                            </span>
                          </div>
                        </div>

                        {/* Search Input */}
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Filtrar por nome ou ID..."
                            value={userSearchTerm}
                            onChange={(e) => setUserSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        {filteredLines.length === 0 ? (
                          <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                            <Bus className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                            <p className="text-xs text-slate-400">Nenhuma linha encontrada.</p>
                          </div>
                        ) : (
                          <>
                            {paginatedLines.map((line, idx) => (
                              <button
                                key={line?.routeId || `line-${idx}`}
                                onClick={() => line && toggleLine(line)}
                                className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between group ${
                                  (route?.selectedLines || []).some(l => l?.routeId === line?.routeId)
                                    ? "bg-indigo-50 border-indigo-200 ring-1 ring-indigo-200"
                                    : "bg-white border-slate-200 hover:border-indigo-200"
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <div className={`p-2.5 rounded-lg transition-colors ${
                                    (route?.selectedLines || []).some(l => l?.routeId === line?.routeId) ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-400 group-hover:bg-indigo-100 group-hover:text-indigo-600"
                                  }`}>
                                    <Bus className="w-4 h-4" />
                                  </div>
                                  <div>
                                    <div className="text-sm font-bold text-slate-800 truncate max-w-[180px]">{line?.name || line?.routeId || "Sem nome"}</div>
                                    <div className="text-xs font-medium text-slate-500">R$ {(line?.price || 0).toFixed(2)}</div>
                                  </div>
                                </div>
                                {(route?.selectedLines || []).some(l => l?.routeId === line?.routeId) && (
                                  <div className="w-2.5 h-2.5 rounded-full bg-indigo-600 shadow-sm shadow-indigo-200" />
                                )}
                              </button>
                            ))}

                            {/* Pagination Controls */}
                            {totalPages > 1 && (
                              <div className="flex items-center justify-between pt-2 px-1">
                                <button
                                  disabled={currentPage === 1}
                                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                  className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-30 hover:bg-slate-50 transition-colors"
                                >
                                  <ChevronRight className="w-4 h-4 rotate-180" />
                                </button>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                  Página {currentPage} de {totalPages}
                                </span>
                                <button
                                  disabled={currentPage === totalPages}
                                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                  className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-30 hover:bg-slate-50 transition-colors"
                                >
                                  <ChevronRight className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Cost Summary */}
                    {(route?.selectedLines || []).length > 0 && (
                      <div className="space-y-4 pt-6 border-t border-slate-100">
                        <div className="flex items-center gap-2 text-indigo-600">
                          <Calculator className="w-5 h-5" />
                          <h3 className="font-bold">Resumo Financeiro</h3>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                            <div className="text-[10px] font-bold text-slate-400 uppercase">Passagem Ida</div>
                            <div className="text-lg font-bold text-slate-800">R$ {valorIda.toFixed(2)}</div>
                          </div>
                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                            <div className="text-[10px] font-bold text-slate-400 uppercase">{route.isRoundTrip ? "Ida e Volta" : "Total (Apenas Ida)"}</div>
                            <div className="text-lg font-bold text-slate-800">R$ {valorIdaVolta.toFixed(2)}</div>
                          </div>
                        </div>
 
                        <div className="p-5 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-100 relative overflow-hidden group">
                          <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
                            <Calculator className="w-24 h-24 text-white" />
                          </div>
                          <div className="relative z-10">
                            <div className="text-[10px] font-bold text-indigo-200 uppercase mb-1">Custo Mensal Estimado</div>
                            <div className="text-3xl font-black text-white">R$ {custoMensal.toFixed(2)}</div>
                            <div className="text-[10px] text-indigo-100 mt-1 font-medium italic">Calculado para {route?.daysWorked || 0} dias úteis</div>
                          </div>
                        </div>

                        {/* PDF Export Button */}
                        <button
                          onClick={generatePDF}
                          disabled={isGeneratingPDF}
                          className="w-full flex items-center justify-center gap-2 py-3 bg-white border-2 border-indigo-600 text-indigo-600 rounded-xl font-bold hover:bg-indigo-50 active:scale-95 transition-all disabled:opacity-50"
                        >
                          {isGeneratingPDF ? (
                            <>
                              <div className="w-4 h-4 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" />
                              Gerando Relatório...
                            </>
                          ) : (
                            <>
                              <FileText className="w-4 h-4" />
                              Gerar Relatório Completo (PDF)
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Map */}
                <div ref={mapRef} className="w-full h-[500px] md:h-full md:flex-1 relative bg-slate-200 shrink-0">
                  <MemoizedMap 
                    origin={route?.origin || null} 
                    destination={route?.destination || null} 
                    selectedLines={route?.selectedLines || []} 
                  />
                  
                  {/* Map Overlay Info */}
                  {!route?.origin && (
                    <div className="absolute inset-0 flex items-center justify-center z-[1000] pointer-events-none">
                      <div className="bg-white/80 backdrop-blur-md px-6 py-4 rounded-3xl shadow-2xl border border-white/40 flex flex-col items-center gap-3 animate-pulse">
                        <div className="p-3 bg-indigo-100 rounded-2xl">
                          <MapPin className="w-6 h-6 text-indigo-600" />
                        </div>
                        <div className="text-center">
                          <h4 className="font-bold text-slate-800">Aguardando CEPs</h4>
                          <p className="text-xs text-slate-500 mt-1">Informe origem e destino para iniciar</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="admin"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="flex-1 md:overflow-hidden"
            >
              <Admin />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

