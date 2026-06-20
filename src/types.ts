export type BuildingType = 'garden_saddle' | 'garden_flat' | 'playhouse' | 'henhouse' | 'tiny_house';

export interface Dimensions {
  width: number; // in meters (X axis)
  depth: number; // in meters (Z axis)
  heightPerFloor: number; // in meters (Y axis)
}

export interface SubObject {
  id: string;
  type: 'window' | 'door' | 'opening';
  position: number; // offset from start of wall in meters
  width: number;
  height: number;
  elevation?: number; // vertical height offset from floor in meters (default 0 for doors)
  color?: string;
}

export interface Wall {
  id: string;
  start: [number, number]; // 2D [x, z] relative to floor center
  end: [number, number];   // 2D [x, z] relative to floor center
  thickness: number;       // total wall thickness (default 0.15m)
  subObjects: SubObject[];
}

export interface Floor {
  id: string;
  level: number; // 0 for ground floor, 1, 2, etc.
  walls: Wall[];
  floorOpening?: {
    x: number;
    z: number;
    width: number;
    depth: number;
  };
}

export interface RoofConfig {
  type: 'saddle' | 'flat';
  inclination: number; // in degrees
  overhang: number;    // overhang past the walls in meters
  thickness: number;   // thickness of roof layers in meters
  constructionWidth: number; // beam width (e.g. 0.1m)
  roofOpening?: {
    x: number;
    z: number;
    width: number;
    depth: number;
  };
}

export interface UIState {
  selectedId: string | null; // Selected wall or sub-object id
  selectedType: 'wall' | 'subObject' | 'roof' | 'floor' | null;
  seeThroughMode: 'solid' | 'seeThrough' | 'studsOnly';
  currentFloorView: number; // Active floor to edit / view (-1 for all)
  isDragging: boolean;
  draggedId: string | null;
  draggedType: 'subObject' | 'wallHandle' | null;
}

export interface FoundationConfig {
  type: 'slab' | 'screws';
}

export interface WallLayersConfig {
  outer: number;
  middle: number;
  inner: number;
}

export interface ProjectState {
  buildingType: BuildingType;
  dimensions: Dimensions;
  floors: Floor[];
  roof: RoofConfig;
  foundation: FoundationConfig;
  wallLayers: WallLayersConfig;
  uiState: UIState;
}
