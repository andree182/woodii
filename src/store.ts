import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ProjectState, BuildingType, Dimensions, RoofConfig, FoundationConfig, WallLayersConfig, StructuralConfig, UIState, Floor, Wall, InternalWall, SubObject, TopCoverConfig, SideCoverConfig, RoofCoversConfig } from './types';


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
      subObjects: level === 0 ? [
        {
          id: `door-main-${level}`,
          type: 'door',
          position: (width + thickness) / 2, // centered on front wall
          width: 0.9,
          height: 2.0,
          color: '#8B4513',
        }
      ] : [],
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

export const recalculateWallCoordinates = (
  width: number,
  depth: number,
  walls: Wall[]
): Wall[] => {
  const halfW = width / 2;
  const halfD = depth / 2;
  
  const getT = (id: string) => walls.find(w => w.id === id)?.thickness ?? 0.15;
  const T_front = getT('wall-front');
  const T_back = getT('wall-back');
  const T_left = getT('wall-left');
  const T_right = getT('wall-right');

  return walls.map((wall) => {
    let start: [number, number] = [0, 0];
    let end: [number, number] = [0, 0];
    
    switch (wall.id) {
      case 'wall-front':
        start = [-halfW - T_left * 0.5, halfD];
        end = [halfW + T_right * 0.5, halfD];
        break;
      case 'wall-right':
        start = [halfW, halfD - T_front * 0.5];
        end = [halfW, -halfD + T_back * 0.5];
        break;
      case 'wall-back':
        start = [halfW + T_right * 0.5, -halfD];
        end = [-halfW - T_left * 0.5, -halfD];
        break;
      case 'wall-left':
        start = [-halfW, -halfD + T_back * 0.5];
        end = [-halfW, halfD - T_front * 0.5];
        break;
    }
    
    return {
      ...wall,
      start,
      end,
    };
  });
};


interface ProjectStore extends ProjectState {
  // Actions
  setBuildingType: (type: BuildingType) => void;
  setDimensions: (dimensions: Partial<Dimensions>) => void;
  setRoofConfig: (config: Partial<RoofConfig>) => void;
  setFoundationConfig: (config: Partial<FoundationConfig>) => void;
  updateUIState: (state: Partial<UIState>) => void;
  addFloor: () => void;
  removeLastFloor: () => void;
  selectObject: (id: string | null, type: UIState['selectedType']) => void;
  
  // Custom functions to add/modify objects
  updateSubObject: (wallId: string, subObjectId: string, updates: Partial<any>) => void;
  addSubObject: (wallId: string, type: 'window' | 'door' | 'opening') => void;
  removeSubObject: (wallId: string, subObjectId: string) => void;
  setFloorOpening: (floorId: string, opening: Floor['floorOpening'] | null) => void;
  setWallLayers: (layers: Partial<WallLayersConfig>) => void;
  setWallPreset: (preset: 'custom' | 'diffusion_open' | 'diffusion_closed') => void;
  addInternalWall: (floorId: string, start?: [number, number], end?: [number, number]) => void;
  removeInternalWall: (floorId: string, wallId: string) => void;
  updateInternalWall: (floorId: string, wallId: string, updates: Partial<InternalWall>) => void;
  setStructuralConfig: (config: Partial<StructuralConfig>) => void;
  setTopCoverConfig: (config: Partial<TopCoverConfig>) => void;
  setWallCoversConfig: (side: 'external' | 'internal', config: Partial<SideCoverConfig>) => void;
  setRoofCoversConfig: (config: Partial<RoofCoversConfig>) => void;
  loadProject: (project: any) => void;
  resetProject: () => void;

  // Dragging actions
  startDragging: (id: string, type: UIState['draggedType'], offset?: [number, number] | null) => void;
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
  foundation: {
    type: 'slab' as const,
  },
  wallLayers: {
    outer: 0.02,
    middle: 0.10,
    inner: 0.03,
  },
  wallPreset: 'custom' as const,
  structuralConfig: {
    wallBlocking: false,
    floorBlocking: false,
    showDimensionsOnDrag: true,
  },
  topCover: {
    material: 'shingles' as const,
    width: 1.0,
    height: 0.33,
    visibleWidth: 1.0,
    visibleHeight: 0.145,
    sheetingMaterial: 'osb_1250' as const,
    sheetingThickness: 0.015,
  },
  wallCovers: {
    external: {
      material: 'rhombus' as const,
      width: 0.09,
      length: 4.0,
      thickness: 0.02,
      gap: 0.01,
    },
    internal: {
      material: 'osb_1250' as const,
      width: 1.25,
      length: 2.50,
      thickness: 0.012,
    },
  },
  roofCovers: {
    soffitMaterial: 'decking' as const,
    soffitThickness: 0.015,
    soffitWidth: 0.12,
    
    fasciaMaterial: 'wood_board' as const,
    fasciaThickness: 0.02,
    fasciaHeight: 0.18,
    
    gableMaterial: 'wood_board' as const,
    gableThickness: 0.02,
    gableHeight: 0.18,
  },
  uiState: {
    selectedId: null,
    selectedType: null,
    seeThroughMode: 'solid' as const,
    currentFloorView: -1, // -1 means see all floors
    isDragging: false,
    draggedId: null,
    draggedType: null,
    showHelpModal: false,
  }
};

export const useProjectStore = create<ProjectStore>()(
  persist(
    (set) => ({
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
      // Recalculate coordinates based on existing wall thicknesses and new dimensions
      const relocatedWalls = recalculateWallCoordinates(newDims.width, newDims.depth, existingWalls);
      
      // Preserve subObjects where possible by matching wall direction (front, right, back, left)
      const updatedWalls = relocatedWalls.map((newWall) => {
        const matchingExisting = existingWalls.find(w => w.id === newWall.id);
        if (matchingExisting) {
          // Keep the existing subObjects but adjust positions if they exceed the new length
          const wallLength = Math.sqrt(
            Math.pow(newWall.end[0] - newWall.start[0], 2) +
            Math.pow(newWall.end[1] - newWall.start[1], 2)
          );
          const adjustedSubObjects = matchingExisting.subObjects.map(obj => {
            const wallThickness = newWall.thickness;
            const maxWidth = Math.max(0.1, wallLength - 2 * wallThickness);
            const clampedWidth = Math.min(maxWidth, obj.width);
            const halfW = clampedWidth / 2;
            const minPos = halfW + wallThickness;
            const maxPos = wallLength - halfW - wallThickness;
            const clampedPos = maxPos >= minPos
              ? Math.max(minPos, Math.min(maxPos, obj.position))
              : wallLength / 2;

            // Calculate wall height at this object's clamped position
            const level = floor.level;
            const isTopFloor = level === state.floors.length - 1;
            const isFlatRoof = state.roof.type === 'flat';
            const angleRad = (state.roof.inclination * Math.PI) / 180;
            let localWallHeight = isTopFloor ? newDims.heightPerFloor : newDims.heightPerFloor - 0.14;
            
            if (isTopFloor && isFlatRoof) {
              if (newWall.id === 'wall-left') {
                localWallHeight = newDims.heightPerFloor + (newDims.width / 2) * Math.tan(angleRad);
              } else if (newWall.id === 'wall-right') {
                localWallHeight = newDims.heightPerFloor - (newDims.width / 2) * Math.tan(angleRad);
              } else if (newWall.id === 'wall-front' || newWall.id === 'wall-back') {
                const isBack = newWall.id === 'wall-back';
                const hLeft = newDims.heightPerFloor + (newDims.width / 2 + newWall.thickness * 0.5) * Math.tan(angleRad);
                const hRight = newDims.heightPerFloor - (newDims.width / 2 + newWall.thickness * 0.5) * Math.tan(angleRad);
                localWallHeight = isBack
                  ? hRight + clampedPos * Math.tan(angleRad)
                  : hLeft - clampedPos * Math.tan(angleRad);
              }
            }

            // Clamp height and elevation to prevent interference with top/bottom plates and rafters (including the window header)
            const lumberThickness = 0.04;
            const doubleTopPlate = 0.08;
            const headerThickness = 0.14;
            const topClearance = doubleTopPlate + headerThickness; // 0.22
            let clampedHeight = obj.height;
            let clampedElevation = obj.elevation !== undefined ? obj.elevation : (obj.type === 'door' ? 0 : 0.9);

            if (obj.type === 'door') {
              clampedElevation = 0;
              clampedHeight = Math.max(0.1, Math.min(localWallHeight - topClearance, obj.height));
            } else if (obj.type === 'window') {
              const minElevation = lumberThickness;
              clampedHeight = Math.max(0.1, Math.min(localWallHeight - topClearance - minElevation, obj.height));
              clampedElevation = Math.max(minElevation, Math.min(localWallHeight - topClearance - clampedHeight, clampedElevation));
            } else {
              // opening
              if (clampedElevation < 0.05) {
                clampedElevation = 0;
                clampedHeight = Math.max(0.1, Math.min(localWallHeight - topClearance, obj.height));
              } else {
                const minElevation = lumberThickness;
                clampedHeight = Math.max(0.1, Math.min(localWallHeight - topClearance - minElevation, obj.height));
                clampedElevation = Math.max(minElevation, Math.min(localWallHeight - topClearance - clampedHeight, clampedElevation));
              }
            }

            return {
              ...obj,
              width: clampedWidth,
              position: clampedPos,
              height: clampedHeight,
              elevation: clampedElevation
            };
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

    let updatedRoofOpening = state.roof.roofOpening;
    if (updatedRoofOpening) {
      const oWidth = Math.max(0.5, Math.min(newDims.width - 0.4, updatedRoofOpening.width));
      const oDepth = Math.max(0.5, Math.min(newDims.depth - 0.4, updatedRoofOpening.depth));
      const minX = -newDims.width / 2 + oWidth / 2 + 0.2;
      const maxX = newDims.width / 2 - oWidth / 2 - 0.2;
      const minZ = -newDims.depth / 2 + oDepth / 2 + 0.2;
      const maxZ = newDims.depth / 2 - oDepth / 2 - 0.2;
      const oX = Math.max(minX, Math.min(maxX, updatedRoofOpening.x));
      const oZ = Math.max(minZ, Math.min(maxZ, updatedRoofOpening.z));
      updatedRoofOpening = {
        x: oX,
        z: oZ,
        width: oWidth,
        depth: oDepth
      };
    }

    return {
      dimensions: newDims,
      floors: newFloors,
      roof: { ...state.roof, roofOpening: updatedRoofOpening }
    };
  }),

  setRoofConfig: (config) => set((state) => ({
    roof: { ...state.roof, ...config }
  })),

  setFoundationConfig: (config) => set((state) => ({
    foundation: { ...state.foundation, ...config }
  })),

  setTopCoverConfig: (config) => set((state) => ({
    topCover: { ...state.topCover, ...config }
  })),

  setWallCoversConfig: (side, config) => set((state) => ({
    wallCovers: {
      ...state.wallCovers,
      [side]: { ...state.wallCovers[side], ...config }
    }
  })),

  setRoofCoversConfig: (config) => set((state) => ({
    roofCovers: { ...state.roofCovers, ...config }
  })),

  updateUIState: (uiUpdates) => set((state) => ({
    uiState: { ...state.uiState, ...uiUpdates }
  })),

  addFloor: () => set((state) => {
    const nextLevel = state.floors.length;
    const T = state.wallLayers.outer + state.wallLayers.middle + state.wallLayers.inner;
    const newFloor: Floor = {
      id: `floor-${nextLevel}`,
      level: nextLevel,
      walls: createOuterWalls(state.dimensions.width, state.dimensions.depth, T, nextLevel),
      internalWalls: [],
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
    const isInternal = wallId.startsWith('internal-');
    const floorId = !isInternal && wallId.includes('floor-') ? wallId.substring(0, wallId.indexOf('-wall-')) : null;
    const cleanWallId = !isInternal && wallId.includes('floor-') ? wallId.substring(wallId.indexOf('wall-')) : wallId;

    const updatedFloors = state.floors.map(floor => {
      if (!isInternal && floorId && floor.id !== floorId) return floor;
      return {
        ...floor,
        walls: floor.walls.map(wall => {
          if (wall.id !== cleanWallId) return wall;

          // Calculate wall length
          const startX = wall.start[0];
          const startZ = wall.start[1];
          const endX = wall.end[0];
          const endZ = wall.end[1];
          const length = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endZ - startZ, 2));

          return {
            ...wall,
            subObjects: wall.subObjects.map(obj => {
              if (obj.id !== subObjectId) return obj;

              const merged = { ...obj, ...updates };
              const wallThickness = wall.thickness;
              const maxWidth = Math.max(0.1, length - 2 * wallThickness);
              const clampedWidth = Math.min(maxWidth, merged.width);
              const halfW = clampedWidth / 2;

              // Clamp position so it doesn't overlap with side corner stands (clearance = wallThickness)
              const minPos = halfW + wallThickness;
              const maxPos = length - halfW - wallThickness;

              const clampedPos = maxPos >= minPos
                ? Math.max(minPos, Math.min(maxPos, merged.position))
                : length / 2;

              // Calculate wall height at the clamped position
              const level = floor.level;
              const isTopFloor = level === state.floors.length - 1;
              const isFlatRoof = state.roof.type === 'flat';
              const angleRad = (state.roof.inclination * Math.PI) / 180;
              let localWallHeight = isTopFloor ? state.dimensions.heightPerFloor : state.dimensions.heightPerFloor - 0.14;
              
              if (isTopFloor && isFlatRoof) {
                if (wall.id === 'wall-left') {
                  localWallHeight = state.dimensions.heightPerFloor + (state.dimensions.width / 2) * Math.tan(angleRad);
                } else if (wall.id === 'wall-right') {
                  localWallHeight = state.dimensions.heightPerFloor - (state.dimensions.width / 2) * Math.tan(angleRad);
                } else if (wall.id === 'wall-front' || wall.id === 'wall-back') {
                  const isBack = wall.id === 'wall-back';
                  const hLeft = state.dimensions.heightPerFloor + (state.dimensions.width / 2 + wall.thickness * 0.5) * Math.tan(angleRad);
                  const hRight = state.dimensions.heightPerFloor - (state.dimensions.width / 2 + wall.thickness * 0.5) * Math.tan(angleRad);
                  localWallHeight = isBack
                    ? hRight + clampedPos * Math.tan(angleRad)
                    : hLeft - clampedPos * Math.tan(angleRad);
                }
              }

              // Clamp height and elevation to prevent interference with top/bottom plates and rafters (including the window header)
              const lumberThickness = 0.04;
              const doubleTopPlate = 0.08;
              const headerThickness = 0.14;
              const topClearance = doubleTopPlate + headerThickness; // 0.22
              let clampedHeight = merged.height;
              let clampedElevation = merged.elevation !== undefined ? merged.elevation : (merged.type === 'door' ? 0 : 0.9);

              if (merged.type === 'door') {
                clampedElevation = 0;
                clampedHeight = Math.max(0.1, Math.min(localWallHeight - topClearance, merged.height));
              } else if (merged.type === 'window') {
                const minElevation = lumberThickness;
                clampedHeight = Math.max(0.1, Math.min(localWallHeight - topClearance - minElevation, merged.height));
                clampedElevation = Math.max(minElevation, Math.min(localWallHeight - topClearance - clampedHeight, clampedElevation));
              } else {
                // opening
                if (clampedElevation < 0.05) {
                  clampedElevation = 0;
                  clampedHeight = Math.max(0.1, Math.min(localWallHeight - topClearance, merged.height));
                } else {
                  const minElevation = lumberThickness;
                  clampedHeight = Math.max(0.1, Math.min(localWallHeight - topClearance - minElevation, merged.height));
                  clampedElevation = Math.max(minElevation, Math.min(localWallHeight - topClearance - clampedHeight, clampedElevation));
                }
              }

              return {
                ...merged,
                width: clampedWidth,
                position: clampedPos,
                height: clampedHeight,
                elevation: clampedElevation
              };
            })
          };
        }),
        internalWalls: (floor.internalWalls || []).map(wall => {
          if (wall.id !== wallId) return wall;
          
          const length = Math.sqrt(Math.pow(wall.end[0] - wall.start[0], 2) + Math.pow(wall.end[1] - wall.start[1], 2));
          const totalThickness = wall.timberSize.width + wall.liningThickness * 2;
          
          return {
            ...wall,
            subObjects: wall.subObjects.map(obj => {
              if (obj.id !== subObjectId) return obj;
              
              const merged = { ...obj, ...updates };
              const maxWidth = Math.max(0.1, length - 2 * totalThickness);
              const clampedWidth = Math.min(maxWidth, merged.width);
              const halfW = clampedWidth / 2;
              
              const minPos = halfW + totalThickness;
              const maxPos = length - halfW - totalThickness;
              const clampedPos = maxPos >= minPos
                ? Math.max(minPos, Math.min(maxPos, merged.position))
                : length / 2;

              const localWallHeight = state.dimensions.heightPerFloor - 0.14;
              const lumberThickness = wall.timberSize.thickness;
              const doubleTopPlate = lumberThickness * 2;
              const headerThickness = 0.14;
              const topClearance = doubleTopPlate + headerThickness;
              let clampedHeight = merged.height;
              let clampedElevation = merged.elevation !== undefined ? merged.elevation : (merged.type === 'door' ? 0 : 0.9);

              if (merged.type === 'door') {
                clampedElevation = 0;
                clampedHeight = Math.max(0.1, Math.min(localWallHeight - topClearance, merged.height));
              } else if (merged.type === 'window') {
                const minElevation = lumberThickness;
                clampedHeight = Math.max(0.1, Math.min(localWallHeight - topClearance - minElevation, merged.height));
                clampedElevation = Math.max(minElevation, Math.min(localWallHeight - topClearance - clampedHeight, clampedElevation));
              } else {
                clampedElevation = 0;
                clampedHeight = Math.max(0.1, Math.min(localWallHeight - topClearance, merged.height));
              }

              return {
                ...merged,
                width: clampedWidth,
                position: clampedPos,
                height: clampedHeight,
                elevation: clampedElevation
              };
            })
          };
        })
      };
    });
    return { floors: updatedFloors };
  }),

  addSubObject: (wallId, type) => set((state) => {
    const isInternal = wallId.startsWith('internal-');
    const floorId = !isInternal && wallId.includes('floor-') ? wallId.substring(0, wallId.indexOf('-wall-')) : null;
    const cleanWallId = !isInternal && wallId.includes('floor-') ? wallId.substring(wallId.indexOf('wall-')) : wallId;

    const id = `${type}-${Date.now()}`;
    const widthVal = type === 'door' ? 0.9 : 1.0;
    const heightVal = type === 'window' ? 1.0 : 2.0;

    const updatedFloors = state.floors.map(floor => {
      if (!isInternal && floorId && floor.id !== floorId) return floor;
      return {
        ...floor,
        walls: floor.walls.map(wall => {
          if (wall.id !== cleanWallId) return wall;

          // Calculate wall length
          const startX = wall.start[0];
          const startZ = wall.start[1];
          const endX = wall.end[0];
          const endZ = wall.end[1];
          const length = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endZ - startZ, 2));

          const halfW = widthVal / 2;
          const wallThickness = wall.thickness;

          // Clamp starting position away from side corner stands
          const minPos = halfW + wallThickness;
          const maxPos = length - halfW - wallThickness;

          const clampedPos = maxPos >= minPos
            ? Math.max(minPos, Math.min(maxPos, 1.0))
            : length / 2;

          // Calculate wall height at the clamped position
          const level = floor.level;
          const isTopFloor = level === state.floors.length - 1;
          const isFlatRoof = state.roof.type === 'flat';
          const angleRad = (state.roof.inclination * Math.PI) / 180;
          let localWallHeight = isTopFloor ? state.dimensions.heightPerFloor : state.dimensions.heightPerFloor - 0.14;
          
          if (isTopFloor && isFlatRoof) {
            if (wall.id === 'wall-left') {
              localWallHeight = state.dimensions.heightPerFloor + (state.dimensions.width / 2) * Math.tan(angleRad);
            } else if (wall.id === 'wall-right') {
              localWallHeight = state.dimensions.heightPerFloor - (state.dimensions.width / 2) * Math.tan(angleRad);
            } else if (wall.id === 'wall-front' || wall.id === 'wall-back') {
              const isBack = wall.id === 'wall-back';
              const hLeft = state.dimensions.heightPerFloor + (state.dimensions.width / 2 + wall.thickness * 0.5) * Math.tan(angleRad);
              const hRight = state.dimensions.heightPerFloor - (state.dimensions.width / 2 + wall.thickness * 0.5) * Math.tan(angleRad);
              localWallHeight = isBack
                ? hRight + clampedPos * Math.tan(angleRad)
                : hLeft - clampedPos * Math.tan(angleRad);
            }
          }

          const lumberThickness = 0.04;
          const doubleTopPlate = 0.08;
          const headerThickness = 0.14;
          const topClearance = doubleTopPlate + headerThickness; // 0.22
          let clampedHeight = heightVal;
          let clampedElevation = type === 'window' ? 0.9 : 0;

          if (type === 'door') {
            clampedElevation = 0;
            clampedHeight = Math.max(0.1, Math.min(localWallHeight - topClearance, heightVal));
          } else if (type === 'window') {
            const minElevation = lumberThickness;
            clampedHeight = Math.max(0.1, Math.min(localWallHeight - topClearance - minElevation, heightVal));
            clampedElevation = Math.max(minElevation, Math.min(localWallHeight - topClearance - clampedHeight, clampedElevation));
          } else {
            // opening
            clampedElevation = 0;
            clampedHeight = Math.max(0.1, Math.min(localWallHeight - topClearance, heightVal));
          }

          const defaultObj = {
            id,
            type,
            position: clampedPos,
            width: widthVal,
            height: clampedHeight,
            elevation: clampedElevation,
            color: type === 'door' ? '#8B4513' : type === 'opening' ? '#222222' : '#ffffff',
          };

          return {
            ...wall,
            subObjects: [...wall.subObjects, defaultObj]
          };
        }),
        internalWalls: (floor.internalWalls || []).map(wall => {
          if (wall.id !== wallId) return wall;

          const totalThickness = wall.timberSize.width + 2 * wall.liningThickness;
          const length = Math.sqrt(Math.pow(wall.end[0] - wall.start[0], 2) + Math.pow(wall.end[1] - wall.start[1], 2));
          const halfW = widthVal / 2;
          const minPos = halfW + totalThickness;
          const maxPos = length - halfW - totalThickness;

          const clampedPos = maxPos >= minPos
            ? Math.max(minPos, Math.min(maxPos, 1.0))
            : length / 2;

          const level = floor.level;
          const isTopFloor = level === state.floors.length - 1;
          const localWallHeight = isTopFloor ? state.dimensions.heightPerFloor : state.dimensions.heightPerFloor - 0.14;

          const lumberThickness = wall.timberSize.thickness;
          const doubleTopPlate = lumberThickness * 2;
          const headerThickness = 0.14;
          const topClearance = doubleTopPlate + headerThickness;
          let clampedHeight = heightVal;
          let clampedElevation = type === 'window' ? 0.9 : 0;

          if (type === 'door') {
            clampedElevation = 0;
            clampedHeight = Math.max(0.1, Math.min(localWallHeight - topClearance, heightVal));
          } else if (type === 'window') {
            const minElevation = lumberThickness;
            clampedHeight = Math.max(0.1, Math.min(localWallHeight - topClearance - minElevation, heightVal));
            clampedElevation = Math.max(minElevation, Math.min(localWallHeight - topClearance - clampedHeight, clampedElevation));
          } else {
            clampedElevation = 0;
            clampedHeight = Math.max(0.1, Math.min(localWallHeight - topClearance, heightVal));
          }

          const defaultObj = {
            id,
            type,
            position: clampedPos,
            width: widthVal,
            height: clampedHeight,
            elevation: clampedElevation,
            color: type === 'door' ? '#8B4513' : type === 'opening' ? '#222222' : '#ffffff',
          };

          return {
            ...wall,
            subObjects: [...wall.subObjects, defaultObj]
          };
        })
      };
    });

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
    const isInternal = wallId.startsWith('internal-');
    const floorId = !isInternal && wallId.includes('floor-') ? wallId.substring(0, wallId.indexOf('-wall-')) : null;
    const cleanWallId = !isInternal && wallId.includes('floor-') ? wallId.substring(wallId.indexOf('wall-')) : wallId;

    const updatedFloors = state.floors.map(floor => {
      if (!isInternal && floorId && floor.id !== floorId) return floor;
      return {
        ...floor,
        walls: floor.walls.map(wall => {
          if (wall.id !== cleanWallId) return wall;
          return {
            ...wall,
            subObjects: wall.subObjects.filter(obj => obj.id !== subObjectId)
          };
        }),
        internalWalls: (floor.internalWalls || []).map(wall => {
          if (wall.id !== wallId) return wall;
          return {
            ...wall,
            subObjects: wall.subObjects.filter(obj => obj.id !== subObjectId)
          };
        })
      };
    });

    return {
      floors: updatedFloors,
      uiState: {
        ...state.uiState,
        selectedId: state.uiState.selectedId === subObjectId ? null : state.uiState.selectedId,
        selectedType: state.uiState.selectedId === subObjectId ? null : state.uiState.selectedType
      }
    };
  }),

  startDragging: (id, type, offset = null) => set((state) => ({
    uiState: {
      ...state.uiState,
      isDragging: true,
      draggedId: id,
      draggedType: type,
      dragOffset: offset,
    }
  })),

  stopDragging: () => set((state) => ({
    uiState: {
      ...state.uiState,
      isDragging: false,
      draggedId: null,
      draggedType: null,
      dragOffset: null,
    }
  })),

  updateDragPosition: (point) => set((state) => {
    const { draggedId, draggedType } = state.uiState;
    if (!draggedId || !draggedType) return {};

    if (draggedType === 'internalWall' || draggedType === 'internalWallStart' || draggedType === 'internalWallEnd' || draggedType === 'internalWallRotate') {
      let foundFloor: Floor | null = null;
      let foundWall: InternalWall | null = null;
      
      for (const floor of state.floors) {
        if (floor.internalWalls) {
          const w = floor.internalWalls.find(item => item.id === draggedId);
          if (w) {
            foundFloor = floor;
            foundWall = w;
            break;
          }
        }
      }
      
      if (!foundFloor || !foundWall) return {};

      const [x, , z] = point;
      const halfW = state.dimensions.width / 2;
      const halfD = state.dimensions.depth / 2;
      const margin = 0.05;
      const minX = -halfW + margin;
      const maxX = halfW - margin;
      const minZ = -halfD + margin;
      const maxZ = halfD - margin;
      
      let finalStartX = foundWall.start[0];
      let finalStartZ = foundWall.start[1];
      let finalEndX = foundWall.end[0];
      let finalEndZ = foundWall.end[1];

      if (draggedType === 'internalWall') {
        const [offsetStartX, offsetStartZ] = state.uiState.dragOffset || [0, 0];
        let tx = x + offsetStartX - foundWall.start[0];
        let tz = z + offsetStartZ - foundWall.start[1];

        // adjust translation to keep both inside bounds
        if (foundWall.start[0] + tx < minX) tx = minX - foundWall.start[0];
        if (foundWall.start[0] + tx > maxX) tx = maxX - foundWall.start[0];
        if (foundWall.end[0] + tx < minX) tx = minX - foundWall.end[0];
        if (foundWall.end[0] + tx > maxX) tx = maxX - foundWall.end[0];

        if (foundWall.start[1] + tz < minZ) tz = minZ - foundWall.start[1];
        if (foundWall.start[1] + tz > maxZ) tz = maxZ - foundWall.start[1];
        if (foundWall.end[1] + tz < minZ) tz = minZ - foundWall.end[1];
        if (foundWall.end[1] + tz > maxZ) tz = maxZ - foundWall.end[1];

        finalStartX = foundWall.start[0] + tx;
        finalStartZ = foundWall.start[1] + tz;
        finalEndX = foundWall.end[0] + tx;
        finalEndZ = foundWall.end[1] + tz;
      } else if (draggedType === 'internalWallStart') {
        const targetStartX = Math.max(minX, Math.min(maxX, x));
        const targetStartZ = Math.max(minZ, Math.min(maxZ, z));
        const dx = finalEndX - targetStartX;
        const dz = finalEndZ - targetStartZ;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist >= 0.1) {
          finalStartX = targetStartX;
          finalStartZ = targetStartZ;
        }
      } else if (draggedType === 'internalWallEnd') {
        const targetEndX = Math.max(minX, Math.min(maxX, x));
        const targetEndZ = Math.max(minZ, Math.min(maxZ, z));
        const dx = targetEndX - finalStartX;
        const dz = targetEndZ - finalStartZ;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist >= 0.1) {
          finalEndX = targetEndX;
          finalEndZ = targetEndZ;
        }
      } else if (draggedType === 'internalWallRotate') {
        const cx = (foundWall.start[0] + foundWall.end[0]) / 2;
        const cz = (foundWall.start[1] + foundWall.end[1]) / 2;
        const dx = foundWall.end[0] - foundWall.start[0];
        const dz = foundWall.end[1] - foundWall.start[1];
        const wallAngle = Math.atan2(dz, dx);

        const lastMouseAngle = state.uiState.dragOffset ? state.uiState.dragOffset[0] : Math.atan2(z - cz, x - cx);
        const lastUnsnappedWallAngle = (state.uiState.dragOffset && state.uiState.dragOffset[2] !== undefined)
          ? state.uiState.dragOffset[2]
          : wallAngle;

        const currentAngle = Math.atan2(z - cz, x - cx);
        const angleDelta = currentAngle - lastMouseAngle;
        const newUnsnappedAngle = lastUnsnappedWallAngle + angleDelta;
        
        const snapAngle = Math.PI / 8; // 22.5 degrees in radians
        const snappedAngle = Math.round(newUnsnappedAngle / snapAngle) * snapAngle;
        const length = Math.sqrt(dx * dx + dz * dz);

        const targetStartX = cx - (length / 2) * Math.cos(snappedAngle);
        const targetStartZ = cz - (length / 2) * Math.sin(snappedAngle);
        const targetEndX = cx + (length / 2) * Math.cos(snappedAngle);
        const targetEndZ = cz + (length / 2) * Math.sin(snappedAngle);

        const clampX = (val: number) => Math.max(minX, Math.min(maxX, val));
        const clampZ = (val: number) => Math.max(minZ, Math.min(maxZ, val));

        finalStartX = clampX(targetStartX);
        finalStartZ = clampZ(targetStartZ);
        finalEndX = clampX(targetEndX);
        finalEndZ = clampZ(targetEndZ);
      }

      // Re-clamp sub-objects
      const newLength = Math.sqrt(
        Math.pow(finalEndX - finalStartX, 2) + Math.pow(finalEndZ - finalStartZ, 2)
      );
      const wallThickness = foundWall.timberSize.width + foundWall.liningThickness * 2;
      const adjustedSubObjects = foundWall.subObjects.map(obj => {
        const halfW = obj.width / 2;
        const minPos = halfW + wallThickness;
        const maxPos = newLength - halfW - wallThickness;
        const clampedPos = maxPos >= minPos
          ? Math.max(minPos, Math.min(maxPos, obj.position))
          : newLength / 2;
        return { ...obj, position: clampedPos };
      });

      const updatedFloors = state.floors.map(floor => {
        if (floor.id !== foundFloor!.id) return floor;
        return {
          ...floor,
          internalWalls: (floor.internalWalls || []).map(w => {
            if (w.id !== foundWall!.id) return w;
            return {
              ...w,
              start: [finalStartX, finalStartZ] as [number, number],
              end: [finalEndX, finalEndZ] as [number, number],
              subObjects: adjustedSubObjects
            };
          })
        };
      });

      // Update rotation offset to the current angle so rotation doesn't lag/accrue errors
      const newCx = (finalStartX + finalEndX) / 2;
      const newCz = (finalStartZ + finalEndZ) / 2;
      const updatedAngle = Math.atan2(z - newCz, x - newCx);

      // Determine the unsnapped angle value for dragOffset
      let finalUnsnappedAngle = 0;
      if (draggedType === 'internalWallRotate') {
        const dx = finalEndX - finalStartX;
        const dz = finalEndZ - finalStartZ;
        const wallAngle = Math.atan2(dz, dx);
        const lastMouseAngle = state.uiState.dragOffset ? state.uiState.dragOffset[0] : Math.atan2(z - newCz, x - newCx);
        const lastUnsnappedWallAngle = (state.uiState.dragOffset && state.uiState.dragOffset[2] !== undefined)
          ? state.uiState.dragOffset[2]
          : wallAngle;
        const currentAngle = Math.atan2(z - newCz, x - newCx);
        const angleDelta = currentAngle - lastMouseAngle;
        finalUnsnappedAngle = lastUnsnappedWallAngle + angleDelta;
      }

      return { 
        floors: updatedFloors,
        uiState: {
          ...state.uiState,
          dragOffset: draggedType === 'internalWallRotate'
            ? [updatedAngle, state.uiState.dragOffset ? state.uiState.dragOffset[1] : 0, finalUnsnappedAngle]
            : state.uiState.dragOffset
        }
      };
    }

    if (draggedType === 'subObject') {
      let foundFloor: Floor | null = null;
      let foundWall: Wall | InternalWall | null = null;
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
        if (foundObj) break;

        if (floor.internalWalls) {
          for (const wall of floor.internalWalls) {
            const obj = wall.subObjects.find(o => o.id === draggedId);
            if (obj) {
              foundFloor = floor;
              foundWall = wall;
              foundObj = obj;
              break;
            }
          }
        }
        if (foundObj) break;
      }

      if (!foundFloor || !foundWall || !foundObj) return {};

      const isInternal = foundWall.id.startsWith('internal-');
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
      const wallThickness = isInternal
        ? (foundWall as InternalWall).timberSize.width + 2 * (foundWall as InternalWall).liningThickness
        : (foundWall as Wall).thickness;
      const minPos = halfW + wallThickness;
      const maxPos = length - halfW - wallThickness;
      const clampedPos = maxPos >= minPos
        ? Math.max(minPos, Math.min(maxPos, pos))
        : length / 2;

      let clampedElevation = 0;
      const level = foundFloor.level;
      const localY = y - level * state.dimensions.heightPerFloor;
      const targetElevation = localY - foundObj.height / 2;

      const isTopFloor = level === state.floors.length - 1;
      const isFlatRoof = state.roof.type === 'flat';
      const angleRad = (state.roof.inclination * Math.PI) / 180;
      let localWallHeight = isTopFloor ? state.dimensions.heightPerFloor : state.dimensions.heightPerFloor - 0.14;
      
      // For internal walls, we do not slope with flat roof (they are interior partitions of constant height)
      if (!isInternal && isTopFloor && isFlatRoof) {
        if (foundWall.id === 'wall-left') {
          localWallHeight = state.dimensions.heightPerFloor + (state.dimensions.width / 2) * Math.tan(angleRad);
        } else if (foundWall.id === 'wall-right') {
          localWallHeight = state.dimensions.heightPerFloor - (state.dimensions.width / 2) * Math.tan(angleRad);
        } else if (foundWall.id === 'wall-front' || foundWall.id === 'wall-back') {
          const isBack = foundWall.id === 'wall-back';
          const hLeft = state.dimensions.heightPerFloor + (state.dimensions.width / 2 + (foundWall as Wall).thickness * 0.5) * Math.tan(angleRad);
          const hRight = state.dimensions.heightPerFloor - (state.dimensions.width / 2 + (foundWall as Wall).thickness * 0.5) * Math.tan(angleRad);
          localWallHeight = isBack
            ? hRight + clampedPos * Math.tan(angleRad)
            : hLeft - clampedPos * Math.tan(angleRad);
        }
      }

      const lumberThickness = isInternal ? (foundWall as InternalWall).timberSize.thickness : 0.04;
      const doubleTopPlate = lumberThickness * 2;
      const headerThickness = 0.14;
      const topClearance = doubleTopPlate + headerThickness; // 0.22

      if (foundObj.type === 'door') {
        clampedElevation = 0;
      } else if (foundObj.type === 'window') {
        const minElevation = lumberThickness;
        const maxElevation = localWallHeight - topClearance - foundObj.height;
        clampedElevation = Math.max(minElevation, Math.min(Math.max(minElevation, maxElevation), targetElevation));
      } else {
        // opening
        if (targetElevation < 0.05) {
          clampedElevation = 0;
        } else {
          const minElevation = lumberThickness;
          const maxElevation = localWallHeight - topClearance - foundObj.height;
          clampedElevation = Math.max(minElevation, Math.min(Math.max(minElevation, maxElevation), targetElevation));
        }
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
          }),
          internalWalls: (floor.internalWalls || []).map(wall => {
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
                    const wallThickness = newWall.thickness;
                    const maxWidth = Math.max(0.1, wallLength - 2 * wallThickness);
                    const clampedWidth = Math.min(maxWidth, obj.width);
                    const halfW = clampedWidth / 2;
                    const minPos = halfW + wallThickness;
                    const maxPos = wallLength - halfW - wallThickness;
                    const clampedPos = maxPos >= minPos
                      ? Math.max(minPos, Math.min(maxPos, obj.position))
                      : wallLength / 2;

                    // Calculate wall height at this object's clamped position
                    const level = floor.level;
                    const isTopFloor = level === state.floors.length - 1;
                    const isFlatRoof = state.roof.type === 'flat';
                    const angleRad = (state.roof.inclination * Math.PI) / 180;
                    let localWallHeight = isTopFloor ? newDims.heightPerFloor : newDims.heightPerFloor - 0.14;
                    
                    if (isTopFloor && isFlatRoof) {
                      if (newWall.id === 'wall-left') {
                        localWallHeight = newDims.heightPerFloor + (newDims.width / 2) * Math.tan(angleRad);
                      } else if (newWall.id === 'wall-right') {
                        localWallHeight = newDims.heightPerFloor - (newDims.width / 2) * Math.tan(angleRad);
                      } else if (newWall.id === 'wall-front' || newWall.id === 'wall-back') {
                        const isBack = newWall.id === 'wall-back';
                        const hLeft = newDims.heightPerFloor + (newDims.width / 2 + newWall.thickness * 0.5) * Math.tan(angleRad);
                        const hRight = newDims.heightPerFloor - (newDims.width / 2 + newWall.thickness * 0.5) * Math.tan(angleRad);
                        localWallHeight = isBack
                          ? hRight + clampedPos * Math.tan(angleRad)
                          : hLeft - clampedPos * Math.tan(angleRad);
                      }
                    }

                    // Clamp height and elevation to prevent interference with top/bottom plates and rafters (including the window header)
                    const lumberThickness = 0.04;
                    const doubleTopPlate = 0.08;
                    const headerThickness = 0.14;
                    const topClearance = doubleTopPlate + headerThickness; // 0.22
                    let clampedHeight = obj.height;
                    let clampedElevation = obj.elevation !== undefined ? obj.elevation : (obj.type === 'door' ? 0 : 0.9);

                    if (obj.type === 'door') {
                      clampedElevation = 0;
                      clampedHeight = Math.max(0.1, Math.min(localWallHeight - topClearance, obj.height));
                    } else if (obj.type === 'window') {
                      const minElevation = lumberThickness;
                      clampedHeight = Math.max(0.1, Math.min(localWallHeight - topClearance - minElevation, obj.height));
                      clampedElevation = Math.max(minElevation, Math.min(localWallHeight - topClearance - clampedHeight, clampedElevation));
                    } else {
                      // opening
                      if (clampedElevation < 0.05) {
                        clampedElevation = 0;
                        clampedHeight = Math.max(0.1, Math.min(localWallHeight - topClearance, obj.height));
                      } else {
                        const minElevation = lumberThickness;
                        clampedHeight = Math.max(0.1, Math.min(localWallHeight - topClearance - minElevation, obj.height));
                        clampedElevation = Math.max(minElevation, Math.min(localWallHeight - topClearance - clampedHeight, clampedElevation));
                      }
                    }

                    return {
                      ...obj,
                      width: clampedWidth,
                      position: clampedPos,
                      height: clampedHeight,
                      elevation: clampedElevation
                    };
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
                    const wallThickness = newWall.thickness;
                    const maxWidth = Math.max(0.1, wallLength - 2 * wallThickness);
                    const clampedWidth = Math.min(maxWidth, obj.width);
                    const halfW = clampedWidth / 2;
                    const minPos = halfW + wallThickness;
                    const maxPos = wallLength - halfW - wallThickness;
                    const clampedPos = maxPos >= minPos
                      ? Math.max(minPos, Math.min(maxPos, obj.position))
                      : wallLength / 2;

                    // Calculate wall height at this object's clamped position
                    const level = floor.level;
                    const isTopFloor = level === state.floors.length - 1;
                    const isFlatRoof = state.roof.type === 'flat';
                    const angleRad = (state.roof.inclination * Math.PI) / 180;
                    let localWallHeight = isTopFloor ? newDims.heightPerFloor : newDims.heightPerFloor - 0.14;
                    
                    if (isTopFloor && isFlatRoof) {
                      if (newWall.id === 'wall-left') {
                        localWallHeight = newDims.heightPerFloor + (newDims.width / 2) * Math.tan(angleRad);
                      } else if (newWall.id === 'wall-right') {
                        localWallHeight = newDims.heightPerFloor - (newDims.width / 2) * Math.tan(angleRad);
                      } else if (newWall.id === 'wall-front' || newWall.id === 'wall-back') {
                        const isBack = newWall.id === 'wall-back';
                        const hLeft = newDims.heightPerFloor + (newDims.width / 2 + newWall.thickness * 0.5) * Math.tan(angleRad);
                        const hRight = newDims.heightPerFloor - (newDims.width / 2 + newWall.thickness * 0.5) * Math.tan(angleRad);
                        localWallHeight = isBack
                          ? hRight + clampedPos * Math.tan(angleRad)
                          : hLeft - clampedPos * Math.tan(angleRad);
                      }
                    }

                    // Clamp height and elevation to prevent interference with top/bottom plates and rafters (including the window header)
                    const lumberThickness = 0.04;
                    const doubleTopPlate = 0.08;
                    const headerThickness = 0.14;
                    const topClearance = doubleTopPlate + headerThickness; // 0.22
                    let clampedHeight = obj.height;
                    let clampedElevation = obj.elevation !== undefined ? obj.elevation : (obj.type === 'door' ? 0 : 0.9);

                    if (obj.type === 'door') {
                      clampedElevation = 0;
                      clampedHeight = Math.max(0.1, Math.min(localWallHeight - topClearance, obj.height));
                    } else if (obj.type === 'window') {
                      const minElevation = lumberThickness;
                      clampedHeight = Math.max(0.1, Math.min(localWallHeight - topClearance - minElevation, obj.height));
                      clampedElevation = Math.max(minElevation, Math.min(localWallHeight - topClearance - clampedHeight, clampedElevation));
                    } else {
                      // opening
                      if (clampedElevation < 0.05) {
                        clampedElevation = 0;
                        clampedHeight = Math.max(0.1, Math.min(localWallHeight - topClearance, obj.height));
                      } else {
                        const minElevation = lumberThickness;
                        clampedHeight = Math.max(0.1, Math.min(localWallHeight - topClearance - minElevation, obj.height));
                        clampedElevation = Math.max(minElevation, Math.min(localWallHeight - topClearance - clampedHeight, clampedElevation));
                      }
                    }

                    return {
                      ...obj,
                      width: clampedWidth,
                      position: clampedPos,
                      height: clampedHeight,
                      elevation: clampedElevation
                    };
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

  addInternalWall: (floorId, start, end) => set((state) => {
    const id = `internal-${floorId}-${Date.now()}`;
    const defaultStart: [number, number] = start || [-1.0, 0];
    const defaultEnd: [number, number] = end || [1.0, 0];
    const newInternalWall: InternalWall = {
      id,
      start: defaultStart,
      end: defaultEnd,
      timberSize: { thickness: 0.04, width: 0.07 },
      liningThickness: 0.0125,
      subObjects: [],
    };

    return {
      floors: state.floors.map(floor => {
        if (floor.id !== floorId) return floor;
        const currentInternalWalls = floor.internalWalls || [];
        return {
          ...floor,
          internalWalls: [...currentInternalWalls, newInternalWall]
        };
      }),
      uiState: {
        ...state.uiState,
        selectedId: id,
        selectedType: 'wall'
      }
    };
  }),

  removeInternalWall: (floorId, wallId) => set((state) => {
    return {
      floors: state.floors.map(floor => {
        if (floor.id !== floorId) return floor;
        const currentInternalWalls = floor.internalWalls || [];
        return {
          ...floor,
          internalWalls: currentInternalWalls.filter(w => w.id !== wallId)
        };
      }),
      uiState: {
        ...state.uiState,
        selectedId: state.uiState.selectedId === wallId ? null : state.uiState.selectedId,
        selectedType: state.uiState.selectedId === wallId ? null : state.uiState.selectedType,
      }
    };
  }),

  updateInternalWall: (floorId, wallId, updates) => set((state) => {
    return {
      floors: state.floors.map(floor => {
        if (floor.id !== floorId) return floor;
        const currentInternalWalls = floor.internalWalls || [];
        return {
          ...floor,
          internalWalls: currentInternalWalls.map(w => {
            if (w.id !== wallId) return w;
            return { ...w, ...updates };
          })
        };
      })
    };
  }),

  setWallLayers: (layers) => set((state) => {
    const newLayers = { ...state.wallLayers, ...layers };
    const T = newLayers.outer + newLayers.middle + newLayers.inner;

    const updatedFloors = state.floors.map((floor) => {
      // Update all walls on this floor to have the new overall thickness
      const updatedWalls = floor.walls.map((wall) => ({
        ...wall,
        thickness: T,
      }));

      // Recalculate coordinates for all walls on this floor
      const relocatedWalls = recalculateWallCoordinates(
        state.dimensions.width,
        state.dimensions.depth,
        updatedWalls
      );

      // Clamp subobjects for each wall
      const finalWalls = relocatedWalls.map((w) => {
        const wallLength = Math.sqrt(
          Math.pow(w.end[0] - w.start[0], 2) +
          Math.pow(w.end[1] - w.start[1], 2)
        );
        const adjustedSubObjects = w.subObjects.map((obj) => {
          const maxWidth = Math.max(0.1, wallLength - 2 * w.thickness);
          const clampedWidth = Math.min(maxWidth, obj.width);
          const halfW = clampedWidth / 2;
          const minPos = halfW + w.thickness;
          const maxPos = wallLength - halfW - w.thickness;
          const clampedPos = maxPos >= minPos
            ? Math.max(minPos, Math.min(maxPos, obj.position))
            : wallLength / 2;
          return {
            ...obj,
            width: clampedWidth,
            position: clampedPos,
          };
        });
        return {
          ...w,
          subObjects: adjustedSubObjects,
        };
      });

      return {
        ...floor,
        walls: finalWalls,
      };
    });

    return {
      wallPreset: 'custom',
      wallLayers: newLayers,
      floors: updatedFloors,
    };
  }),

  setWallPreset: (preset) => set((state) => {
    let newLayers = { ...state.wallLayers };
    if (preset === 'diffusion_open') {
      newLayers = { outer: 0.02, middle: 0.10, inner: 0.015 };
    } else if (preset === 'diffusion_closed') {
      newLayers = { outer: 0.035, middle: 0.10, inner: 0.00 };
    }

    const T = newLayers.outer + newLayers.middle + newLayers.inner;

    const updatedFloors = state.floors.map((floor) => {
      const updatedWalls = floor.walls.map((wall) => ({
        ...wall,
        thickness: T,
      }));

      const relocatedWalls = recalculateWallCoordinates(
        state.dimensions.width,
        state.dimensions.depth,
        updatedWalls
      );

      const finalWalls = relocatedWalls.map((w) => {
        const wallLength = Math.sqrt(
          Math.pow(w.end[0] - w.start[0], 2) +
          Math.pow(w.end[1] - w.start[1], 2)
        );
        const adjustedSubObjects = w.subObjects.map((obj) => {
          const maxWidth = Math.max(0.1, wallLength - 2 * w.thickness);
          const clampedWidth = Math.min(maxWidth, obj.width);
          const halfW = clampedWidth / 2;
          const minPos = halfW + w.thickness;
          const maxPos = wallLength - halfW - w.thickness;
          const clampedPos = maxPos >= minPos
            ? Math.max(minPos, Math.min(maxPos, obj.position))
            : wallLength / 2;
          return {
            ...obj,
            width: clampedWidth,
            position: clampedPos,
          };
        });
        return {
          ...w,
          subObjects: adjustedSubObjects,
        };
      });

      return {
        ...floor,
        walls: finalWalls,
      };
    });

    return {
      wallPreset: preset,
      wallLayers: newLayers,
      floors: updatedFloors,
    };
  }),

  setStructuralConfig: (config) => set((state) => ({
    structuralConfig: { ...state.structuralConfig, ...config }
  })),

  loadProject: (project) => set((state) => {
    if (!project || !project.dimensions || !project.floors) return {};
    return {
      buildingType: project.buildingType || state.buildingType,
      dimensions: { ...state.dimensions, ...project.dimensions },
      roof: { ...state.roof, ...project.roof },
      foundation: project.foundation || state.foundation,
      wallLayers: project.wallLayers || state.wallLayers,
      wallPreset: project.wallPreset || state.wallPreset,
      structuralConfig: {
        showDimensionsOnDrag: true,
        ...state.structuralConfig,
        ...(project.structuralConfig || {})
      },
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
        internalWalls: [],
      }
    ]
  }))
}), {
  name: 'woodii-project-storage',
  partialize: (state) => ({
    buildingType: state.buildingType,
    dimensions: state.dimensions,
    roof: state.roof,
    foundation: state.foundation,
    wallLayers: state.wallLayers,
    wallPreset: state.wallPreset,
    structuralConfig: state.structuralConfig,
    floors: state.floors,
  }),
}));
