import { create } from 'zustand';
import { ProjectState, BuildingType, Dimensions, RoofConfig, UIState, Floor, Wall } from './types';

// Helper to create default walls based on dimensions
export const createOuterWalls = (width: number, depth: number, thickness = 0.15, level = 0): Wall[] => {
  const halfW = width / 2;
  const halfD = depth / 2;
  return [
    {
      id: 'wall-front',
      // Extended by half-thickness at both ends to cover the side wall ends completely
      start: [-halfW - thickness * 0.5, halfD],
      end: [halfW + thickness * 0.5, halfD],
      thickness,
      subObjects: [
        {
          id: `door-main-${level}`,
          type: 'door',
          position: (width + thickness) / 2, // centered on front wall
          width: 0.9,
          height: 2.0,
          color: '#8B4513',
        }
      ],
    },
    {
      id: 'wall-right',
      // Shortened by half-thickness at each end to butt perfectly against front/back wall inner faces
      start: [halfW, halfD - thickness * 0.5],
      end: [halfW, -halfD + thickness * 0.5],
      thickness,
      subObjects: [
        {
          id: `window-side-${level}`,
          type: 'window',
          position: (depth - thickness) / 2, // centered on the shortened side wall
          width: 1.0,
          height: 1.0,
          color: '#ffffff',
        }
      ],
    },
    {
      id: 'wall-back',
      // Extended by half-thickness at both ends to cover the side wall ends completely
      start: [halfW + thickness * 0.5, -halfD],
      end: [-halfW - thickness * 0.5, -halfD],
      thickness,
      subObjects: [],
    },
    {
      id: 'wall-left',
      // Shortened by half-thickness at each end to butt perfectly against front/back wall inner faces
      start: [-halfW, -halfD + thickness * 0.5],
      end: [-halfW, halfD - thickness * 0.5],
      thickness,
      subObjects: [],
    },
  ];
};

interface ProjectStore extends ProjectState {
  // Actions
  setBuildingType: (type: BuildingType) => void;
  setDimensions: (dimensions: Partial<Dimensions>) => void;
  setRoofConfig: (config: Partial<RoofConfig>) => void;
  updateUIState: (state: Partial<UIState>) => void;
  addFloor: () => void;
  removeLastFloor: () => void;
  selectObject: (id: string | null, type: UIState['selectedType']) => void;
  
  // Custom functions to add/modify objects
  updateSubObject: (wallId: string, subObjectId: string, updates: Partial<any>) => void;
  addSubObject: (wallId: string, type: 'window' | 'door') => void;
  removeSubObject: (wallId: string, subObjectId: string) => void;
  resetProject: () => void;
}

const INITIAL_PROJECT_STATE = {
  buildingType: 'garden_saddle' as BuildingType,
  dimensions: {
    width: 4.0,
    depth: 3.0,
    heightPerFloor: 2.4,
  },
  roof: {
    type: 'saddle' as const,
    inclination: 25,
    overhang: 0.3,
    thickness: 0.2,
    constructionWidth: 0.1,
  },
  uiState: {
    selectedId: null,
    selectedType: null,
    seeThroughMode: 'solid' as const,
    currentFloorView: -1, // -1 means see all floors
  }
};

export const useProjectStore = create<ProjectStore>((set) => ({
  ...INITIAL_PROJECT_STATE,
  floors: [
    {
      id: 'floor-0',
      level: 0,
      walls: createOuterWalls(4.0, 3.0, 0.15, 0),
    }
  ],

  setBuildingType: (type) => set((state) => {
    const isSaddle = type === 'garden_saddle' || type === 'playhouse' || type === 'tiny_house';
    return {
      buildingType: type,
      roof: {
        ...state.roof,
        type: isSaddle ? 'saddle' : 'flat',
      }
    };
  }),

  setDimensions: (dims) => set((state) => {
    const newDims = { ...state.dimensions, ...dims };
    
    // Dynamically adjust outer walls for each floor to match new dimensions
    const newFloors = state.floors.map((floor) => {
      const existingWalls = floor.walls;
      const defaultWalls = createOuterWalls(newDims.width, newDims.depth, 0.15, floor.level);
      
      // Preserve subObjects where possible by matching wall direction (front, right, back, left)
      const updatedWalls = defaultWalls.map((newWall) => {
        const matchingExisting = existingWalls.find(w => w.id === newWall.id);
        if (matchingExisting) {
          // Keep the existing subObjects but adjust positions if they exceed the new length
          const wallLength = Math.sqrt(
            Math.pow(newWall.end[0] - newWall.start[0], 2) +
            Math.pow(newWall.end[1] - newWall.start[1], 2)
          );
          const adjustedSubObjects = matchingExisting.subObjects.map(obj => {
            const maxPos = wallLength - obj.width / 2;
            const newPos = Math.min(Math.max(obj.width / 2, obj.position), maxPos);
            return { ...obj, position: newPos };
          });
          return { ...newWall, subObjects: adjustedSubObjects };
        }
        return newWall;
      });

      return {
        ...floor,
        walls: updatedWalls
      };
    });

    return {
      dimensions: newDims,
      floors: newFloors
    };
  }),

  setRoofConfig: (config) => set((state) => ({
    roof: { ...state.roof, ...config }
  })),

  updateUIState: (uiUpdates) => set((state) => ({
    uiState: { ...state.uiState, ...uiUpdates }
  })),

  addFloor: () => set((state) => {
    const nextLevel = state.floors.length;
    const newFloor: Floor = {
      id: `floor-${nextLevel}`,
      level: nextLevel,
      walls: createOuterWalls(state.dimensions.width, state.dimensions.depth, 0.15, nextLevel),
    };
    return {
      floors: [...state.floors, newFloor]
    };
  }),

  removeLastFloor: () => set((state) => {
    if (state.floors.length <= 1) return {}; // Keep ground floor
    return {
      floors: state.floors.slice(0, -1),
      uiState: {
        ...state.uiState,
        selectedId: state.uiState.selectedId?.startsWith(`floor-${state.floors.length - 1}`) ? null : state.uiState.selectedId
      }
    };
  }),

  selectObject: (id, type) => set((state) => ({
    uiState: {
      ...state.uiState,
      selectedId: id,
      selectedType: type
    }
  })),

  updateSubObject: (wallId, subObjectId, updates) => set((state) => {
    const updatedFloors = state.floors.map(floor => ({
      ...floor,
      walls: floor.walls.map(wall => {
        if (wall.id !== wallId) return wall;
        return {
          ...wall,
          subObjects: wall.subObjects.map(obj => 
            obj.id === subObjectId ? { ...obj, ...updates } : obj
          )
        };
      })
    }));
    return { floors: updatedFloors };
  }),

  addSubObject: (wallId, type) => set((state) => {
    const id = `${type}-${Date.now()}`;
    const defaultObj = {
      id,
      type,
      position: 1.0, // Default offset
      width: type === 'door' ? 0.9 : 1.0,
      height: type === 'door' ? 2.0 : 1.0,
      color: type === 'door' ? '#8B4513' : '#ffffff',
    };

    const updatedFloors = state.floors.map(floor => ({
      ...floor,
      walls: floor.walls.map(wall => {
        if (wall.id !== wallId) return wall;
        return {
          ...wall,
          subObjects: [...wall.subObjects, defaultObj]
        };
      })
    }));

    return { 
      floors: updatedFloors,
      uiState: {
        ...state.uiState,
        selectedId: id,
        selectedType: 'subObject'
      }
    };
  }),

  removeSubObject: (wallId, subObjectId) => set((state) => {
    const updatedFloors = state.floors.map(floor => ({
      ...floor,
      walls: floor.walls.map(wall => {
        if (wall.id !== wallId) return wall;
        return {
          ...wall,
          subObjects: wall.subObjects.filter(obj => obj.id !== subObjectId)
        };
      })
    }));
    return {
      floors: updatedFloors,
      uiState: {
        ...state.uiState,
        selectedId: state.uiState.selectedId === subObjectId ? null : state.uiState.selectedId,
        selectedType: state.uiState.selectedId === subObjectId ? null : state.uiState.selectedType
      }
    };
  }),

  resetProject: () => set(() => ({
    ...INITIAL_PROJECT_STATE,
    floors: [
      {
        id: 'floor-0',
        level: 0,
        walls: createOuterWalls(4.0, 3.0, 0.15, 0),
      }
    ]
  }))
}));
