import { BusLine, Location } from "../types";

export const fetchBusLines = async (activeOnly = false): Promise<BusLine[]> => {
  const response = await fetch(`/api/lines${activeOnly ? "?active=true" : ""}`);
  if (!response.ok) throw new Error("Failed to fetch bus lines");
  return response.json();
};

export const saveBusLine = async (line: BusLine): Promise<BusLine> => {
  const response = await fetch("/api/lines", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(line),
  });
  if (!response.ok) throw new Error("Failed to save bus line");
  return response.json();
};

export const saveBulkBusLines = async (lines: Partial<BusLine>[]): Promise<{ count: number }> => {
  const response = await fetch("/api/lines/bulk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(lines),
  });
  if (!response.ok) throw new Error("Failed to save bulk bus lines");
  return response.json();
};

export const deleteBusLine = async (routeId: string): Promise<void> => {
  const response = await fetch(`/api/lines/${encodeURIComponent(routeId)}`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error("Failed to delete bus line");
};

const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeout = 8000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
};

export const geocodeCEP = async (cep: string): Promise<Location> => {
  const cleanCEP = cep.replace(/\D/g, "");
  if (cleanCEP.length !== 8) throw new Error("CEP deve ter 8 dígitos (apenas números)");

  let viaCepData: any = null;

  // 1. Try ViaCEP
  try {
    const response = await fetchWithTimeout(`https://viacep.com.br/ws/${cleanCEP}/json/`);
    if (response.ok) {
      const data = await response.json();
      if (data && !data.erro) {
        viaCepData = data;
      }
    }
  } catch (e) {
    console.warn("ViaCEP failed, trying fallback...");
  }

  // 2. Fallback to BrasilAPI if ViaCEP failed or didn't find the CEP
  if (!viaCepData) {
    try {
      const response = await fetchWithTimeout(`https://brasilapi.com.br/api/cep/v1/${cleanCEP}`);
      if (response.ok) {
        const data = await response.json();
        viaCepData = {
          logradouro: data.street,
          bairro: data.neighborhood,
          localidade: data.city,
          uf: data.state
        };
      }
    } catch (e) {
      console.warn("BrasilAPI failed...");
    }
  }

  if (!viaCepData) {
    throw new Error("CEP não encontrado. Verifique se o número está correto.");
  }

  const address = `${viaCepData.logradouro || ""}, ${viaCepData.bairro || ""}, ${viaCepData.localidade || ""} - ${viaCepData.uf || ""}`;

  // 3. Geocode with Nominatim
  try {
    const query = `${viaCepData.logradouro || viaCepData.localidade}, ${viaCepData.localidade}, ${viaCepData.uf}, Brazil`;
    const nominatimResponse = await fetchWithTimeout(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
      { headers: { "User-Agent": "ValeTransporteApp/1.0" } }
    );
    const nominatimData = await nominatimResponse.json();

    if (!nominatimData || nominatimData.length === 0) {
      // Fallback to just city/state if logradouro fails
      const fallbackQuery = `${viaCepData.localidade}, ${viaCepData.uf}, Brazil`;
      const fallbackResponse = await fetchWithTimeout(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(fallbackQuery)}&format=json&limit=1`,
        { headers: { "User-Agent": "ValeTransporteApp/1.0" } }
      );
      const fallbackData = await fallbackResponse.json();
      if (!fallbackData || fallbackData.length === 0) throw new Error("Não foi possível localizar as coordenadas no mapa");
      
      return {
        lat: parseFloat(fallbackData[0].lat),
        lng: parseFloat(fallbackData[0].lon),
        address,
      };
    }

    return {
      lat: parseFloat(nominatimData[0].lat),
      lng: parseFloat(nominatimData[0].lon),
      address,
    };
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error("A localização demorou muito. Tente novamente.");
    }
    throw error;
  }
};

export interface RouteInfo {
  coordinates: [number, number][];
  distance: number;
  duration: number;
}

export const getWalkingRoute = async (start: [number, number], end: [number, number]): Promise<RouteInfo | null> => {
  try {
    const coords = `${start[1]},${start[0]};${end[1]},${end[0]}`;
    const response = await fetch(`https://router.project-osrm.org/route/v1/foot/${coords}?overview=full&geometries=geojson`);
    const data = await response.json();
    
    if (data.code === 'Ok' && data.routes && data.routes[0]) {
      const route = data.routes[0];
      return {
        coordinates: route.geometry.coordinates.map((c: any) => [c[1], c[0]] as [number, number]),
        distance: route.distance,
        duration: route.duration
      };
    }
    return null;
  } catch (error) {
    console.error("Erro ao buscar rota a pé:", error);
    return null;
  }
};

export const getStreetRoute = async (points: [number, number][]): Promise<[number, number][]> => {

  if (points.length < 2) return points;
  
  try {
    const maxPoints = 50;
    let sampledPoints = points;
    if (points.length > maxPoints) {
      const step = Math.floor(points.length / maxPoints);
      sampledPoints = points.filter((_, i) => i % step === 0);
      if (sampledPoints[sampledPoints.length - 1] !== points[points.length - 1]) {
        sampledPoints.push(points[points.length - 1]);
      }
    }

    const coords = sampledPoints.map(p => `${p[1]},${p[0]}`).join(';');
    const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`);
    const data = await response.json();
    
    if (data.code === 'Ok' && data.routes && data.routes[0]) {
      return data.routes[0].geometry.coordinates.map((c: any) => [c[1], c[0]] as [number, number]);
    }
    return points;
  } catch (error) {
    console.error("Erro ao buscar rota OSRM:", error);
    return points;
  }
};
