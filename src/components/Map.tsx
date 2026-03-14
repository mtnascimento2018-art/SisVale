import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, ZoomControl, Tooltip, GeoJSON } from "react-leaflet";
import L from "leaflet";
import { Location, BusLine } from "../types";
import { getWalkingRoute, RouteInfo } from "../services/api";

// Fix default icon issue in Leaflet using CDN
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

L.Marker.prototype.options.icon = DefaultIcon;

const greenIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const redIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const startIcon = new L.DivIcon({
  className: 'custom-div-icon',
  html: `<div style="background-color: #4f46e5; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: bold; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">I</div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

const endIcon = new L.DivIcon({
  className: 'custom-div-icon',
  html: `<div style="background-color: #dc2626; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: bold; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">F</div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

const walkingIcon = new L.DivIcon({
  className: 'custom-div-icon',
  html: `<div style="background-color: white; color: #64748b; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; border: 1px solid #e2e8f0; box-shadow: 0 1px 2px rgba(0,0,0,0.1);"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10]
});

// Helper to find closest point on a polyline
function findClosestPoint(point: [number, number], polyline: [number, number][]): { point: [number, number], distance: number } {
  let minDistance = Infinity;
  let closest: [number, number] = polyline[0];

  polyline.forEach(p => {
    const d = L.latLng(point).distanceTo(L.latLng(p));
    if (d < minDistance) {
      minDistance = d;
      closest = p;
    }
  });

  return { point: closest, distance: minDistance };
}

function formatDistance(meters: number) {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

function formatDuration(seconds: number) {
  const minutes = Math.round(seconds / 60);
  if (minutes < 1) return "< 1 min";
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}min` : `${h}h`;
  }
  return `${minutes} min`;
}

function WalkingPath({ start, end, label }: { start: [number, number], end: [number, number], label: string }) {
  const [route, setRoute] = useState<RouteInfo | null>(null);

  useEffect(() => {
    let isMounted = true;
    getWalkingRoute(start, end).then(res => {
      if (isMounted && res) {
        setRoute(res);
      }
    });
    return () => { isMounted = false; };
  }, [start[0], start[1], end[0], end[1]]);

  const positions = route ? route.coordinates : [start, end];
  const distance = route ? route.distance : L.latLng(start).distanceTo(L.latLng(end));
  
  // OSRM foot duration can sometimes be unreliable or missing. 
  // Calculate duration manually based on distance (average walking speed: 5 km/h = ~1.388 m/s)
  const duration = distance / 1.388;

  return (
    <>
      <Polyline
        positions={positions}
        pathOptions={{ color: '#475569', weight: 4, dashArray: '6, 8', opacity: 0.8, lineJoin: 'round' }}
      />
      <Marker position={end} icon={walkingIcon}>
        <Popup className="custom-popup">
          <div className="text-center leading-tight p-1">
            <strong className="text-slate-700 block text-[9px] uppercase tracking-wider mb-0.5">{label}</strong>
            <span className="text-indigo-600 font-bold text-[11px]">{formatDistance(distance)}</span>
            <span className="text-slate-400 mx-1 text-[9px]">•</span>
            <span className="text-emerald-600 font-bold text-[11px]">{formatDuration(duration)}</span>
          </div>
        </Popup>
      </Marker>
    </>
  );
}

function MapController({ origin, destination, selectedLines }: { origin: Location | null, destination: Location | null, selectedLines: BusLine[] }) {
  const map = useMap();

  useEffect(() => {
    // Force a resize check multiple times to ensure the container is ready
    const timer1 = setTimeout(() => map.invalidateSize(), 100);
    const timer2 = setTimeout(() => map.invalidateSize(), 500);
    const timer3 = setTimeout(() => map.invalidateSize(), 1000);
    
    const handleResize = () => map.invalidateSize();
    window.addEventListener('resize', handleResize);
    
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      window.removeEventListener('resize', handleResize);
    };
  }, [map]);

  useEffect(() => {
    if (!map) return;

    // Small delay to ensure container dimensions are settled
    const timer = setTimeout(() => {
      const bounds = L.latLngBounds([]);
      let hasPoints = false;

      if (origin) {
        bounds.extend([origin.lat, origin.lng]);
        hasPoints = true;
      }
      if (destination) {
        bounds.extend([destination.lat, destination.lng]);
        hasPoints = true;
      }

      (selectedLines || []).forEach(line => {
        (line?.coordinates || []).forEach(coord => {
          if (Array.isArray(coord) && coord.length >= 2) {
            bounds.extend([coord[0], coord[1]]);
            hasPoints = true;
          }
        });
      });

      if (hasPoints && bounds.isValid()) {
        map.fitBounds(bounds, { 
          padding: [40, 40], 
          maxZoom: 15,
          animate: true,
          duration: 0.5
        });
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [map, origin, destination, selectedLines]);

  return null;
}

interface MapProps {
  origin: Location | null;
  destination: Location | null;
  selectedLines: BusLine[];
}

export default function Map({ origin, destination, selectedLines }: MapProps) {
  let closestLineToOriginIdx = -1;
  let minOriginDist = Infinity;
  let closestLineToDestIdx = -1;
  let minDestDist = Infinity;

  if (origin) {
    (selectedLines || []).forEach((line, idx) => {
      const coords = line?.coordinates || [];
      if (coords.length > 0) {
        const closest = findClosestPoint([origin.lat, origin.lng], coords);
        if (closest.distance < minOriginDist) {
          minOriginDist = closest.distance;
          closestLineToOriginIdx = idx;
        }
      }
    });
  }

  if (destination) {
    (selectedLines || []).forEach((line, idx) => {
      const coords = line?.coordinates || [];
      if (coords.length > 0) {
        const closest = findClosestPoint([destination.lat, destination.lng], coords);
        if (closest.distance < minDestDist) {
          minDestDist = closest.distance;
          closestLineToDestIdx = idx;
        }
      }
    });
  }

  return (
    <div className="h-full w-full relative bg-slate-100 overflow-hidden" style={{ minHeight: '300px' }}>
      <MapContainer 
        center={[-22.9068, -43.1729]} 
        zoom={12} 
        scrollWheelZoom={true} 
        zoomControl={false}
        className="h-full w-full"
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ZoomControl position="bottomright" />
        <MapController origin={origin} destination={destination} selectedLines={selectedLines} />
        
        {origin && (
          <Marker position={[origin.lat, origin.lng]} icon={greenIcon}>
            <Popup>
              <div className="p-1">
                <strong className="text-emerald-600">Origem</strong>
                <p className="text-[10px] text-slate-500 mt-1">{origin.address}</p>
              </div>
            </Popup>
          </Marker>
        )}

        {destination && (
          <Marker position={[destination.lat, destination.lng]} icon={redIcon}>
            <Popup>
              <div className="p-1">
                <strong className="text-red-600">Destino</strong>
                <p className="text-[10px] text-slate-500 mt-1">{destination.address}</p>
              </div>
            </Popup>
          </Marker>
        )}

        {(selectedLines || []).map((line, idx) => {
          const coords = line?.coordinates || [];
          if (coords.length < 2) return null;

          const start = coords[0];
          const end = coords[coords.length - 1];
          const lineColor = ["#4f46e5", "#7c3aed", "#d97706", "#059669", "#dc2626"][idx % 5];

          // Calculate walking paths if origin/destination exist
          const walkingOrigin = origin ? findClosestPoint([origin.lat, origin.lng], coords) : null;
          const walkingDest = destination ? findClosestPoint([destination.lat, destination.lng], coords) : null;

          return (
            <React.Fragment key={`${line?.name || idx}-${idx}`}>
              {/* Walking Path from Origin (Only for the closest selected line) */}
              {idx === closestLineToOriginIdx && origin && walkingOrigin && (
                <WalkingPath 
                  start={[origin.lat, origin.lng]} 
                  end={walkingOrigin.point} 
                  label={`Caminhada até ${line.name}`} 
                />
              )}

              {/* Walking Path to Destination (Only for the closest selected line) */}
              {idx === closestLineToDestIdx && destination && walkingDest && (
                <WalkingPath 
                  start={[destination.lat, destination.lng]} 
                  end={walkingDest.point} 
                  label={`Caminhada do ${line.name}`} 
                />
              )}

              {/* Start/End Markers */}
              <Marker position={start} icon={startIcon}>
                <Popup>
                  <div className="p-1">
                    <strong className="text-indigo-600">Início: {line.name}</strong>
                  </div>
                </Popup>
              </Marker>
              <Marker position={end} icon={endIcon}>
                <Popup>
                  <div className="p-1">
                    <strong className="text-red-600">Final: {line.name}</strong>
                  </div>
                </Popup>
              </Marker>

              {/* Shadow/Border Line */}
              <GeoJSON
                key={`geojson-shadow-${line?.name || idx}-${idx}-${coords.length}`}
                data={{
                  type: "Feature",
                  geometry: {
                    type: "LineString",
                    coordinates: coords.map(c => [c[1], c[0]])
                  }
                } as any}
                style={{
                  color: "#ffffff",
                  weight: 8,
                  opacity: 0.5,
                  lineJoin: 'round',
                  lineCap: 'round'
                }}
              />

              {/* GeoJSON Route Rendering */}
              <GeoJSON
                key={`geojson-${line?.name || idx}-${idx}-${coords.length}`}
                data={{
                  type: "Feature",
                  properties: {
                    name: line.name,
                    price: line.price,
                    color: lineColor
                  },
                  geometry: {
                    type: "LineString",
                    coordinates: coords.map(c => [c[1], c[0]]) // GeoJSON uses [lon, lat]
                  }
                } as any}
                style={(feature) => ({
                  color: feature?.properties?.color || lineColor,
                  weight: 5,
                  opacity: 0.9,
                  lineJoin: 'round',
                  lineCap: 'round'
                })}
                onEachFeature={(feature, layer) => {
                  layer.bindPopup(`
                    <div class="p-1">
                      <strong class="text-indigo-600">${feature.properties.name || "Linha sem nome"}</strong>
                      <p class="text-[10px] text-slate-500 mt-1">Tarifa: R$ ${(feature.properties.price || 0).toFixed(2)}</p>
                    </div>
                  `);
                }}
              />
            </React.Fragment>
          );
        })}
      </MapContainer>
    </div>
  );
}
