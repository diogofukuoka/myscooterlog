export interface Trip {
  id: number;
  date: string;
  distance: number;
  route: string;
  active?: boolean;
}

export interface SyncConfig {
  token: string;
  gistId: string;
}

export interface Location {
  name: string;
  address: string;
}

export interface PredefinedRoute {
  dist: number;
  name: string;
}

export type TabType = 'official' | 'simulation';
export type MapContextType = 'official' | 'simulation';
