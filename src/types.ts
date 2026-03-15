export interface BusLine {
  id?: string;
  routeId: string;
  name: string;
  price: number;
  coordinates: [number, number][];
  isActive: boolean;
}

export interface Location {
  lat: number;
  lng: number;
  address: string;
}

export interface RouteState {
  origin: Location | null;
  destination: Location | null;
  selectedLines: BusLine[];
  daysWorked: number;
}
