import React, { useState, useEffect, memo } from "react";
import { BusLine, Location, RouteState } from "./types";
import { fetchBusLines, geocodeCEP } from "./services/api";
import Map from "./components/Map";
import Admin from "./components/Admin";
import { MapPin, Bus, Calculator, Settings, Search, ChevronRight, Info } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

const MemoizedMap = memo(Map);

export default function App() {
  const [activeTab, setActiveTab] = useState<"user" | "admin">("user");
  const [busLines, setBusLines] = useState<BusLine[]>([]);
  const [cepOrigem, setCepOrigem] = useState("");
  const [cepDestino, setCepDestino] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [route, setRoute] = useState<RouteState>({
    origin: null,
    destination: null,
    selectedLines: [],
    daysWorked: 22,
  });

  useEffect(() => {
    loadLines();
  }, []);

  const loadLines = async () => {
    try {
      const data = await fetchBusLines();
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
      const isSelected = prev.selectedLines.some((l) => l?.name === line?.name);
      if (isSelected) {
        return { ...prev, selectedLines: prev.selectedLines.filter((l) => l?.name !== line?.name) };
      } else {
        return { ...prev, selectedLines: [...prev.selectedLines, line] };
      }
    });
  };

  const valorIda = (route?.selectedLines || []).reduce((sum, l) => sum + (l?.price || 0), 0);
  const valorIdaVolta = valorIda * 2;
  const custoMensal = valorIdaVolta * (route?.daysWorked || 0);

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
                            {(route?.selectedLines || []).length} / {busLines.length}
                          </span>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        {busLines.length === 0 ? (
                          <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                            <Bus className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                            <p className="text-xs text-slate-400">Nenhuma linha cadastrada.</p>
                          </div>
                        ) : (
                          busLines.map((line, idx) => (
                            <button
                              key={line?.name || `line-${idx}`}
                              onClick={() => line && toggleLine(line)}
                              className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between group ${
                                (route?.selectedLines || []).some(l => l?.name === line?.name)
                                  ? "bg-indigo-50 border-indigo-200 ring-1 ring-indigo-200"
                                  : "bg-white border-slate-200 hover:border-indigo-200"
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`p-2.5 rounded-lg transition-colors ${
                                  (route?.selectedLines || []).some(l => l?.name === line?.name) ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-400 group-hover:bg-indigo-100 group-hover:text-indigo-600"
                                }`}>
                                  <Bus className="w-4 h-4" />
                                </div>
                                <div>
                                  <div className="text-sm font-bold text-slate-800">{line?.name || "Sem nome"}</div>
                                  <div className="text-xs font-medium text-slate-500">R$ {(line?.price || 0).toFixed(2)}</div>
                                </div>
                              </div>
                              {(route?.selectedLines || []).some(l => l?.name === line?.name) && (
                                <div className="w-2.5 h-2.5 rounded-full bg-indigo-600 shadow-sm shadow-indigo-200" />
                              )}
                            </button>
                          ))
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
                            <div className="text-[10px] font-bold text-slate-400 uppercase">Ida e Volta</div>
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
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Map */}
                <div className="w-full h-[500px] md:h-full md:flex-1 relative bg-slate-200 shrink-0">
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

