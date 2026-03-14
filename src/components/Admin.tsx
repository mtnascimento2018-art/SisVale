import React, { useState, useEffect } from "react";
import { BusLine } from "../types";
import { fetchBusLines, saveBusLine, deleteBusLine, getStreetRoute } from "../services/api";
import { Trash2, Plus, Upload, Lock, Unlock, Zap } from "lucide-react";
import Papa from "papaparse";

export default function Admin() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [lines, setLines] = useState<BusLine[]>([]);
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState(4.30);
  const [newCoords, setNewCoords] = useState<[number, number][]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [shouldSwap, setShouldSwap] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [parsedShapes, setParsedShapes] = useState<{ [id: string]: [number, number][] }>({});
  const [selectedShapeId, setSelectedShapeId] = useState<string>("");

  useEffect(() => {
    if (isAuthenticated) {
      loadLines();
    }
  }, [isAuthenticated]);

  const toggleSwap = () => {
    const swapped = newCoords.map(c => [c[1], c[0]] as [number, number]);
    setNewCoords(swapped);
    setShouldSwap(!shouldSwap);
  };

  const handleOptimize = async () => {
    if (newCoords.length < 2) return;
    setIsOptimizing(true);
    try {
      const optimized = await getStreetRoute(newCoords);
      setNewCoords(optimized);
    } catch (error) {
      console.error(error);
      alert("Erro ao otimizar rota pelas ruas.");
    } finally {
      setIsOptimizing(false);
    }
  };

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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const shapes: { [id: string]: { lat: number, lon: number, seq: number }[] } = {};
          
          results.data.forEach((row: any) => {
            const shapeId = row.shape_id;
            const lat = parseFloat(row.shape_pt_lat);
            const lon = parseFloat(row.shape_pt_lon);
            const seq = parseInt(row.shape_pt_sequence, 10);
            
            if (shapeId && !isNaN(lat) && !isNaN(lon) && !isNaN(seq)) {
              if (!shapes[shapeId]) {
                shapes[shapeId] = [];
              }
              shapes[shapeId].push({ lat, lon, seq });
            }
          });

          const processedShapes: { [id: string]: [number, number][] } = {};
          Object.keys(shapes).forEach(id => {
            // Sort by sequence to ensure correct order
            shapes[id].sort((a, b) => a.seq - b.seq);
            // Convert to [lat, lon] for Leaflet
            processedShapes[id] = shapes[id].map(pt => [pt.lat, pt.lon]);
          });

          const shapeIds = Object.keys(processedShapes);
          if (shapeIds.length === 0) {
            alert("Nenhuma rota encontrada no arquivo GTFS. Verifique se é um arquivo shapes.txt válido.");
            setParsedShapes({});
            setSelectedShapeId("");
            setNewCoords([]);
          } else {
            setParsedShapes(processedShapes);
            const firstShapeId = shapeIds[0];
            setSelectedShapeId(firstShapeId);
            setNewCoords(processedShapes[firstShapeId]);
          }
        } catch (error) {
          console.error(error);
          alert("Erro ao processar arquivo GTFS. Verifique o formato.");
        } finally {
          setIsUploading(false);
        }
      },
      error: (error) => {
        console.error(error);
        alert("Erro ao ler o arquivo CSV.");
        setIsUploading(false);
      }
    });
  };

  const handleShapeSelection = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedShapeId(id);
    if (parsedShapes[id]) {
      setNewCoords(parsedShapes[id]);
    }
  };

  const handleAddLine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newCoords || newCoords.length === 0) {
      return;
    }

    try {
      const newLine: BusLine = {
        name: newName,
        price: newPrice,
        coordinates: newCoords,
      };
      await saveBusLine(newLine);
      setNewName("");
      setNewPrice(4.30);
      setNewCoords([]);
      setParsedShapes({});
      setSelectedShapeId("");
      loadLines();
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = async (name: string) => {
    try {
      await deleteBusLine(name);
      loadLines();
    } catch (error) {
      console.error(error);
    }
  };

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
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-900">Gerenciamento de Linhas</h2>
          <button 
            onClick={() => setIsAuthenticated(false)}
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            Sair
          </button>
        </div>

        {/* Add New Line Form */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Plus className="w-5 h-5 text-indigo-600" />
            Cadastrar Nova Linha
          </h3>
          <form onSubmit={handleAddLine} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Nome da Linha</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Ex: Linha 483 - Penha/Copacabana"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Valor da Passagem (R$)</label>
              <input
                type="number"
                step="0.05"
                value={newPrice}
                onChange={(e) => setNewPrice(parseFloat(e.target.value))}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-slate-700 block mb-1">Arquivo shapes.txt (GTFS)</label>
              <div className="relative border-2 border-dashed border-slate-300 rounded-xl p-6 hover:border-indigo-400 transition-colors bg-slate-50 group">
                <input
                  type="file"
                  accept=".txt,.csv"
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="flex flex-col items-center justify-center gap-2">
                  <Upload className="w-8 h-8 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                  <p className="text-sm text-slate-600">
                    {Object.keys(parsedShapes).length > 0 
                      ? `${Object.keys(parsedShapes).length} rotas carregadas` 
                      : isUploading ? "Processando..." : "Clique ou arraste o arquivo shapes.txt aqui"}
                  </p>
                </div>
              </div>
              
              {Object.keys(parsedShapes).length > 0 && (
                <div className="mt-4 space-y-1">
                  <label className="text-sm font-medium text-slate-700 block">Selecione a Rota (shape_id)</label>
                  <select
                    value={selectedShapeId}
                    onChange={handleShapeSelection}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    {Object.keys(parsedShapes).map(id => (
                      <option key={id} value={id}>
                        Rota {id} ({parsedShapes[id].length} pontos)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {newCoords.length > 0 && (
                <div className="mt-2 flex items-center justify-between px-2">
                  <p className="text-[10px] text-slate-500">
                    Primeiro ponto: <span className="font-mono">{newCoords[0][0].toFixed(4)}, {newCoords[0][1].toFixed(4)}</span>
                  </p>
                  <button
                    type="button"
                    onClick={toggleSwap}
                    className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 uppercase tracking-wider"
                  >
                    Inverter Lat/Lon
                  </button>
                </div>
              )}
              {newCoords.length > 0 && (
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={handleOptimize}
                    disabled={isOptimizing}
                    className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold hover:bg-emerald-100 transition-all disabled:opacity-50"
                  >
                    {isOptimizing ? (
                      <div className="w-3 h-3 border-2 border-emerald-700/30 border-t-emerald-700 rounded-full animate-spin" />
                    ) : (
                      <Zap className="w-3.5 h-3.5" />
                    )}
                    {isOptimizing ? "Otimizando..." : "Otimizar Trajeto pelas Ruas"}
                  </button>
                  <p className="text-[9px] text-slate-400 mt-1 text-center">
                    Isso ajusta os pontos para seguirem as ruas reais (OSRM).
                  </p>
                </div>
              )}
            </div>
            <div className="md:col-span-2">
              <button
                type="submit"
                className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
              >
                Salvar Linha
              </button>
            </div>
          </form>
        </div>

        {/* List of Lines */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-bottom border-slate-100">
            <h3 className="text-lg font-semibold text-slate-800">Linhas Cadastradas</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {lines.length === 0 ? (
              <div className="p-8 text-center text-slate-500">Nenhuma linha cadastrada ainda.</div>
            ) : (
              lines.map((line, idx) => (
                <div key={line?.name || idx} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div>
                    <h4 className="font-medium text-slate-900">{line?.name || "Sem nome"}</h4>
                    <p className="text-sm text-slate-500">
                      R$ {(line?.price || 0).toFixed(2)} • {(line?.coordinates || []).length} pontos de rota
                    </p>
                  </div>
                  <button
                    onClick={() => line?.name && handleDelete(line.name)}
                    className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
