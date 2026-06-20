import { create } from 'zustand';
import { ProjectState, BuildingType, Dimensions, RoofConfig, UIState, Floor, Wall, SubObject } from './types';

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
  addSubObject: (wallId: string, type: 'window' | 'door' | 'opening') => void;
  removeSubObject: (wallId: string, subObjectId: string) => void;
  setFloorOpening: (floorId: string, opening: Floor['floorOpening'] | null) => void;
  loadProject: (project: any) => void;
  resetProject: () => void;

  // Dragging actions
  startDragging: (id: string, type: 'subObject' | 'wallHandle') => void;
  stopDragging: () => void;
  updateDragPosition: (point: [number, number, number]) => void;
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
    isDragging: false,
    draggedId: null,
    draggedType: null,
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

      // Clamp floorOpening if it exists
      let updatedOpening = floor.floorOpening;
      if (updatedOpening) {
        const oWidth = Math.max(0.5, Math.min(newDims.width - 0.4, updatedOpening.width));
        const oDepth = Math.max(0.5, Math.min(newDims.depth - 0.4, updatedOpening.depth));
        const minX = -newDims.width / 2 + oWidth / 2 + 0.2;
        const maxX = newDims.width / 2 - oWidth / 2 - 0.2;
        const minZ = -newDims.depth / 2 + oDepth / 2 + 0.2;
        const maxZ = newDims.depth / 2 - oDepth / 2 - 0.2;
        const oX = Math.max(minX, Math.min(maxX, updatedOpening.x));
        const oZ = Math.max(minZ, Math.min(maxZ, updatedOpening.z));
        updatedOpening = {
          x: oX,
          z: oZ,
          width: oWidth,
          depth: oDepth
        };
      }

      return {
        ...floor,
        walls: updatedWalls,
        floorOpening: updatedOpening
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
      height: type === 'window' ? 1.0 : 2.0,
      elevation: type === 'window' ? 0.9 : 0,
      color: type === 'door' ? '#8B4513' : type === 'opening' ? '#222222' : '#ffffff',
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

  startDragging: (id, type) => set((state) => ({
    uiState: {
      ...state.uiState,
      isDragging: true,
      draggedId: id,
      draggedType: type,
    }
  })),

  stopDragging: () => set((state) => ({
    uiState: {
      ...state.uiState,
      isDragging: false,
      draggedId: null,
      draggedType: null,
    }
  })),

  updateDragPosition: (point) => set((state) => {
    const { draggedId, draggedType } = state.uiState;
    if (!draggedId || !draggedType) return {};

    if (draggedType === 'subObject') {
      let foundFloor: Floor | null = null;
      let foundWall: Wall | null = null;
      let foundObj: SubObject | null = null;
      
      for (const floor of state.floors) {
        for (const wall of floor.walls) {
          const obj = wall.subObjects.find(o => o.id === draggedId);
          if (obj) {
            foundFloor = floor;
            foundWall = wall;
            foundObj = obj;
            break;
          }
        }
      }

      if (!foundFloor || !foundWall || !foundObj) return {};

      const startX = foundWall.start[0];
      const startZ = foundWall.start[1];
      const endX = foundWall.end[0];
      const endZ = foundWall.end[1];

      const dx = endX - startX;
      const dz = endZ - startZ;
      const length = Math.sqrt(dx * dx + dz * dz);
      const ux = dx / length;
      const uz = dz / length;

      const [x, y, z] = point;
      const vx = x - startX;
      const vz = z - startZ;
      const pos = vx * ux + vz * uz;

      const halfW = foundObj.width / 2;
      const clampedPos = Math.max(halfW, Math.min(length - halfW, pos));

      let clampedElevation = undefined;
      if (foundObj.type !== 'door') {
        const level = foundFloor.level;
        const localY = y - level * state.dimensions.heightPerFloor;
        const targetElevation = localY - foundObj.height / 2;

        const isTopFloor = level === state.floors.length - 1;
        const isFlatRoof = state.roof.type === 'flat';
        const angleRad = (state.roof.inclination * Math.PI) / 180;
        let localWallHeight = state.dimensions.heightPerFloor;
        
        if (isTopFloor && isFlatRoof) {
          if (foundWall.id === 'wall-left') {
            localWallHeight = state.dimensions.heightPerFloor + (state.dimensions.width / 2) * Math.tan(angleRad);
          } else if (foundWall.id === 'wall-right') {
            localWallHeight = state.dimensions.heightPerFloor - (state.dimensions.width / 2) * Math.tan(angleRad);
          } else if (foundWall.id === 'wall-front' || foundWall.id === 'wall-back') {
            const isBack = foundWall.id === 'wall-back';
            const hLeft = state.dimensions.heightPerFloor + (state.dimensions.width / 2 + foundWall.thickness * 0.5) * Math.tan(angleRad);
            const hRight = state.dimensions.heightPerFloor - (state.dimensions.width / 2 + foundWall.thickness * 0.5) * Math.tan(angleRad);
            localWallHeight = isBack
              ? hRight + clampedPos * Math.tan(angleRad)
              : hLeft - clampedPos * Math.tan(angleRad);
          }
        }

        const maxElevation = localWallHeight - foundObj.height;
        clampedElevation = Math.max(0, Math.min(Math.max(0, maxElevation), targetElevation));
      }

      const updatedFloors = state.floors.map(floor => {
        if (floor.id !== foundFloor!.id) return floor;
        return {
          ...floor,
          walls: floor.walls.map(wall => {
            if (wall.id !== foundWall!.id) return wall;
            return {
              ...wall,
              subObjects: wall.subObjects.map(obj => 
                obj.id === draggedId 
                  ? { 
                      ...obj, 
                      position: clampedPos,
                      ...(clampedElevation !== undefined ? { elevation: clampedElevation } : {}) 
                    } 
                  : obj
              )
            };
          })
        };
      });

      return { floors: updatedFloors };
    } else if (draggedType === 'wallHandle') {
      const [x, , z] = point;
      if (draggedId.endsWith('wall-front') || draggedId.endsWith('wall-back')) {
        const newDepth = Math.round(Math.max(1.5, Math.min(15, Math.abs(z) * 2)) * 10) / 10;
        const newDims = { ...state.dimensions, depth: newDepth };
        return {
          dimensions: newDims,
          floors: state.floors.map(floor => {
            const defaultWalls = createOuterWalls(newDims.width, newDims.depth, 0.15, floor.level);
            
            let updatedOpening = floor.floorOpening;
            if (updatedOpening) {
              const oWidth = Math.max(0.5, Math.min(newDims.width - 0.4, updatedOpening.width));
              const oDepth = Math.max(0.5, Math.min(newDims.depth - 0.4, updatedOpening.depth));
              const minX = -newDims.width / 2 + oWidth / 2 + 0.2;
              const maxX = newDims.width / 2 - oWidth / 2 - 0.2;
              const minZ = -newDims.depth / 2 + oDepth / 2 + 0.2;
              const maxZ = newDims.depth / 2 - oDepth / 2 - 0.2;
              const oX = Math.max(minX, Math.min(maxX, updatedOpening.x));
              const oZ = Math.max(minZ, Math.min(maxZ, updatedOpening.z));
              updatedOpening = {
                x: oX,
                z: oZ,
                width: oWidth,
                depth: oDepth
              };
            }

            return {
              ...floor,
              floorOpening: updatedOpening,
              walls: defaultWalls.map(newWall => {
                const matchingExisting = floor.walls.find(w => w.id === newWall.id);
                if (matchingExisting) {
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
              })
            };
          })
        };
      } else if (draggedId.endsWith('wall-left') || draggedId.endsWith('wall-right')) {
        const newWidth = Math.round(Math.max(1.5, Math.min(15, Math.abs(x) * 2)) * 10) / 10;
        const newDims = { ...state.dimensions, width: newWidth };
        return {
          dimensions: newDims,
          floors: state.floors.map(floor => {
            const defaultWalls = createOuterWalls(newDims.width, newDims.depth, 0.15, floor.level);
            
            let updatedOpening = floor.floorOpening;
            if (updatedOpening) {
              const oWidth = Math.max(0.5, Math.min(newDims.width - 0.4, updatedOpening.width));
              const oDepth = Math.max(0.5, Math.min(newDims.depth - 0.4, updatedOpening.depth));
              const minX = -newDims.width / 2 + oWidth / 2 + 0.2;
              const maxX = newDims.width / 2 - oWidth / 2 - 0.2;
              const minZ = -newDims.depth / 2 + oDepth / 2 + 0.2;
              const maxZ = newDims.depth / 2 - oDepth / 2 - 0.2;
              const oX = Math.max(minX, Math.min(maxX, updatedOpening.x));
              const oZ = Math.max(minZ, Math.min(maxZ, updatedOpening.z));
              updatedOpening = {
                x: oX,
                z: oZ,
                width: oWidth,
                depth: oDepth
              };
            }

            return {
              ...floor,
              floorOpening: updatedOpening,
              walls: defaultWalls.map(newWall => {
                const matchingExisting = floor.walls.find(w => w.id === newWall.id);
                if (matchingExisting) {
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
              })
            };
          })
        };
      }
    }
    return {};
  }),

  setFloorOpening: (floorId, opening) => set((state) => {
    if (!opening) {
      return {
        floors: state.floors.map(f => f.id === floorId ? { ...f, floorOpening: undefined } : f)
      };
    }
    
    const { width, depth } = state.dimensions;
    const oWidth = Math.max(0.5, Math.min(width - 0.4, opening.width));
    const oDepth = Math.max(0.5, Math.min(depth - 0.4, opening.depth));
    
    const minX = -width / 2 + oWidth / 2 + 0.2;
    const maxX = width / 2 - oWidth / 2 - 0.2;
    const minZ = -depth / 2 + oDepth / 2 + 0.2;
    const maxZ = depth / 2 - oDepth / 2 - 0.2;
    
    const oX = Math.max(minX, Math.min(maxX, opening.x));
    const oZ = Math.max(minZ, Math.min(maxZ, opening.z));

    return {
      floors: state.floors.map(floor => {
        if (floor.id !== floorId) return floor;
        return {
          ...floor,
          floorOpening: {
            x: oX,
            z: oZ,
            width: oWidth,
            depth: oDepth
          }
        };
      })
    };
  }),

  loadProject: (project) => set((state) => {
    if (!project || !project.dimensions || !project.floors) return {};
    return {
      buildingType: project.buildingType || state.buildingType,
      dimensions: { ...state.dimensions, ...project.dimensions },
      roof: { ...state.roof, ...project.roof },
      floors: project.floors,
      uiState: { ...state.uiState, selectedId: null, selectedType: null }
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
