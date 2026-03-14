export interface BusLine {
  name: string;
  price: number;
  coordinates: [number, number][];
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
