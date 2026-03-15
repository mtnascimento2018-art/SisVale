import React, { useState, useEffect } from "react";
import { BusLine } from "../types";
import { fetchBusLines, saveBusLine, deleteBusLine, saveBulkBusLines } from "../services/api";
import { Trash2, Upload, Lock, Unlock, CheckCircle2, XCircle, DollarSign, Search } from "lucide-react";
import Papa from "papaparse";

export default function Admin() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [lines, setLines] = useState<BusLine[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (isAuthenticated) {
      loadLines();
    }
  }, [isAuthenticated]);

  const loadLines = async () => {
    try {
      const data = await fetchBusLines();
      setLines(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === "admin123") {
      setIsAuthenticated(true);
    } else {
      alert("Senha incorreta");
    }
  };

  const handleFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    
    const fileMap: { [name: string]: File } = {};
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const name = file.name.toLowerCase();
      if (name.endsWith("routes.txt") || name.endsWith("trips.txt") || name.endsWith("shapes.txt")) {
        fileMap[name] = file;
      }
    }

    if (!fileMap["routes.txt"] || !fileMap["trips.txt"] || !fileMap["shapes.txt"]) {
      alert("Certifique-se de que a pasta contém os arquivos routes.txt, trips.txt e shapes.txt");
      setIsUploading(false);
      return;
    }

    try {
      const parseFile = (file: File): Promise<any[]> => {
        return new Promise((resolve, reject) => {
          Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => resolve(results.data),
            error: (err) => reject(err)
          });
        });
      };

      const [routesData, tripsData, shapesData] = await Promise.all([
        parseFile(fileMap["routes.txt"]),
        parseFile(fileMap["trips.txt"]),
        parseFile(fileMap["shapes.txt"])
      ]);

      // 1. Process Routes
      const routes: { [id: string]: string } = {};
      routesData.forEach((r: any) => {
        if (r.route_id) {
          routes[r.route_id] = r.route_long_name || r.route_short_name || `Linha ${r.route_id}`;
        }
      });

      // 2. Process Trips to find a shape for each route
      const routeToShape: { [routeId: string]: string } = {};
      tripsData.forEach((t: any) => {
        if (t.route_id && t.shape_id && !routeToShape[t.route_id]) {
          routeToShape[t.route_id] = t.shape_id;
        }
      });

      // 3. Process Shapes
      const shapes: { [id: string]: { lat: number, lon: number, seq: number }[] } = {};
      shapesData.forEach((s: any) => {
        const id = s.shape_id;
        const lat = parseFloat(s.shape_pt_lat);
        const lon = parseFloat(s.shape_pt_lon);
        const seq = parseInt(s.shape_pt_sequence, 10);
        if (id && !isNaN(lat) && !isNaN(lon) && !isNaN(seq)) {
          if (!shapes[id]) shapes[id] = [];
          shapes[id].push({ lat, lon, seq });
        }
      });

      // 4. Combine into BusLines
      const newLines: Partial<BusLine>[] = [];
      Object.keys(routes).forEach(routeId => {
        const shapeId = routeToShape[routeId];
        if (shapeId && shapes[shapeId]) {
          const coords = shapes[shapeId]
            .sort((a, b) => a.seq - b.seq)
            .map(pt => [pt.lat, pt.lon] as [number, number]);
          
          if (coords.length > 0) {
            newLines.push({
              routeId,
              name: routes[routeId],
              coordinates: coords,
              price: 4.30,
              isActive: false
            });
          }
        }
      });

      if (newLines.length === 0) {
        alert("Nenhuma rota válida encontrada nos arquivos GTFS.");
      } else {
        await saveBulkBusLines(newLines);
        alert(`${newLines.length} linhas importadas com sucesso!`);
        loadLines();
      }
    } catch (error) {
      console.error(error);
      alert("Erro ao processar arquivos GTFS.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleToggleActive = async (line: BusLine) => {
    try {
      await saveBusLine({ ...line, isActive: !line.isActive });
      loadLines();
    } catch (error) {
      console.error(error);
    }
  };

  const handleUpdatePrice = async (line: BusLine, price: number) => {
    try {
      await saveBusLine({ ...line, price });
      loadLines();
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = async (routeId: string) => {
    if (!confirm("Tem certeza que deseja excluir esta linha?")) return;
    try {
      await deleteBusLine(routeId);
      loadLines();
    } catch (error) {
      console.error(error);
    }
  };

  const filteredLines = lines.filter(l => 
    l.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    l.routeId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 bg-slate-50">
        <div className="w-full max-w-md p-8 bg-white rounded-2xl shadow-sm border border-slate-200">
          <div className="flex justify-center mb-6">
            <div className="p-3 bg-indigo-50 rounded-full">
              <Lock className="w-8 h-8 text-indigo-600" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-center text-slate-900 mb-2">Área Administrativa</h2>
          <p className="text-slate-500 text-center mb-8">Informe a senha para gerenciar as linhas de ônibus.</p>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                placeholder="••••••••"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
            >
              <Unlock className="w-4 h-4" />
              Entrar
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 h-full overflow-y-auto bg-slate-50">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Gerenciamento de Linhas</h2>
            <p className="text-slate-500 text-sm">Importe arquivos GTFS e configure as tarifas.</p>
          </div>
          <button 
            onClick={() => setIsAuthenticated(false)}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg shadow-sm transition-all"
          >
            Sair
          </button>
        </div>

        {/* GTFS Upload Section */}
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-xl p-10 hover:border-indigo-400 transition-colors bg-slate-50 relative group">
            <input
              type="file"
              // @ts-ignore
              webkitdirectory=""
              directory=""
              multiple
              onChange={handleFolderUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="flex flex-col items-center justify-center gap-4">
              <div className="p-4 bg-indigo-50 rounded-full group-hover:scale-110 transition-transform">
                <Upload className="w-10 h-10 text-indigo-600" />
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-slate-800">
                  {isUploading ? "Processando arquivos GTFS..." : "Importar Pasta GTFS"}
                </p>
                <p className="text-sm text-slate-500 mt-1">
                  Selecione a pasta que contém routes.txt, trips.txt e shapes.txt
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Search and List */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h3 className="text-lg font-semibold text-slate-800">Linhas Disponíveis ({lines.length})</h3>
            <div className="relative max-w-md w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por nome ou ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider font-semibold">
                  <th className="px-6 py-4">ID / Nome</th>
                  <th className="px-6 py-4">Tarifa (R$)</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLines.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                      Nenhuma linha encontrada.
                    </td>
                  </tr>
                ) : (
                  filteredLines.map((line) => (
                    <tr key={line.routeId} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-xs font-mono text-slate-400">#{line.routeId}</span>
                          <span className="font-medium text-slate-900">{line.name}</span>
                          <span className="text-[10px] text-slate-400">{line.coordinates.length} pontos</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                          <input
                            type="number"
                            step="0.05"
                            defaultValue={line.price}
                            onBlur={(e) => handleUpdatePrice(line, parseFloat(e.target.value))}
                            className="w-20 px-2 py-1 border border-slate-200 rounded bg-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                          />
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleToggleActive(line)}
                          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all ${
                            line.isActive 
                              ? "bg-emerald-50 text-emerald-600 border border-emerald-100" 
                              : "bg-slate-100 text-slate-500 border border-slate-200"
                          }`}
                        >
                          {line.isActive ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Ativa
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3.5 h-3.5" />
                              Inativa
                            </>
                          )}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleDelete(line.routeId)}
                          className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                          title="Excluir linha"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
