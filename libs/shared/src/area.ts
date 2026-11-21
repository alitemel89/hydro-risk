export interface Polygon { type: 'Polygon'; coordinates: number[][][]; }
export interface AreaInput { name: string; geometry: Polygon; }
export interface Area extends AreaInput { id: string; areaKm2: number; createdAt: string; }
