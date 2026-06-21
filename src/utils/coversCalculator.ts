import { ProjectState } from '../types';

export interface RoofCoversEstimation {
  roofArea: number;
  sheetingSheets: number;
  sheetingArea: number;
  topCoverPieces: number;
  topCoverArea: number;
  rowsCount: number;
  piecesPerRow: number;
}

export interface WallCoversEstimation {
  wallId: string;
  wallTitle: string;
  netArea: number;
  grossArea: number;
  openingsArea: number;
  external: {
    material: string;
    linearMeters: number;
    piecesCount: number;
  };
  internal: {
    material: string;
    linearMeters: number;
    piecesCount: number;
  };
}

export interface CoversBOM {
  roof: RoofCoversEstimation;
  walls: WallCoversEstimation[];
  totals: {
    externalCladdingMeters: number;
    externalCladdingPieces: number;
    externalOSBSheets: number;
    internalOSBSheets: number;
    internalPlasterboardSheets: number;
    internalCladdingMeters: number;
    internalCladdingPieces: number;
    roofSheetingSheets: number;
    roofShinglesCount: number;
    roofTilesCount: number;
    roofPlatesCount: number;
  };
}

export function calculateCoversBOM(state: ProjectState): CoversBOM {
  const { width, depth, heightPerFloor } = state.dimensions;
  const totalFloors = state.floors.length;
  const wallThickness = state.floors[0]?.walls[0]?.thickness || 0.15;
  const angleRad = (state.roof.inclination * Math.PI) / 180;

  // ----------------------------------------------------
  // 1. ROOF SURFACE CALCULATIONS
  // ----------------------------------------------------
  let roofArea = 0;
  let slopeLength = 0;
  let slopeDepth = depth + state.roof.overhang * 2;
  let slopeCount = 1;

  if (state.roof.type === 'flat') {
    slopeLength = (width + wallThickness) / Math.cos(angleRad) + state.roof.overhang * 2;
    roofArea = slopeLength * slopeDepth;
    slopeCount = 1;
  } else {
    // saddle roof
    const halfGableWidth = width / 2 + wallThickness * 0.5;
    const halfRoofWidth = halfGableWidth + state.roof.overhang;
    slopeLength = halfRoofWidth / Math.cos(angleRad);
    roofArea = 2 * slopeLength * slopeDepth;
    slopeCount = 2;
  }

  // A. Sheeting (OSB / Plywood)
  let sheetingSheets = 0;
  let sheetSize = 2.50 * 1.25; // Default OSB 2500x1250
  if (state.topCover.sheetingMaterial === 'osb_625') {
    sheetSize = 2.50 * 0.625;
  } else if (state.topCover.sheetingMaterial === 'plywood') {
    sheetSize = 2.44 * 1.22;
  }
  
  if (state.topCover.sheetingMaterial !== 'none') {
    sheetingSheets = Math.ceil((roofArea / sheetSize) * 1.10); // 10% wastage
  }

  // B. Top Cover Pieces (Shingles, Tiles, Plates)
  let topCoverPieces = 0;
  let rowsCount = 0;
  let piecesPerRow = 0;

  const expW = state.topCover.visibleWidth || state.topCover.width;
  const expH = state.topCover.visibleHeight || state.topCover.height;

  if (state.topCover.material === 'shingles' || state.topCover.material === 'tiles') {
    rowsCount = Math.ceil(slopeLength / expH);
    piecesPerRow = Math.ceil(slopeDepth / expW);
    topCoverPieces = rowsCount * piecesPerRow * slopeCount;
  } else if (state.topCover.material === 'plates') {
    // Aluminum plates (length default 2.0m, width 1.0m, exposure width 0.95m, exposure length 1.85m)
    const exposureW = state.topCover.width - 0.05;
    const exposureH = state.topCover.height - 0.15;
    rowsCount = Math.ceil(slopeLength / exposureH);
    piecesPerRow = Math.ceil(slopeDepth / exposureW);
    topCoverPieces = rowsCount * piecesPerRow * slopeCount;
  }

  const roofEstimation: RoofCoversEstimation = {
    roofArea,
    sheetingSheets,
    sheetingArea: sheetingSheets * sheetSize,
    topCoverPieces,
    topCoverArea: topCoverPieces * (expW * expH),
    rowsCount,
    piecesPerRow
  };

  // ----------------------------------------------------
  // 2. WALL SURFACE CALCULATIONS (Internal and External)
  // ----------------------------------------------------
  const wallEstimations: WallCoversEstimation[] = [];

  let totalExtCladdingMeters = 0;
  let totalExtCladdingPieces = 0;
  let totalExtOSBSheets = 0;
  let totalIntOSBSheets = 0;
  let totalIntPlasterboardSheets = 0;
  let totalIntCladdingMeters = 0;
  let totalIntCladdingPieces = 0;

  state.floors.forEach((floor) => {
    const isTopFloor = floor.level === totalFloors - 1;
    const isFlatRoof = state.roof.type === 'flat';

    // Helper to calculate heights for trapezoidal flat roof walls
    const getWallHeightBounds = (wallId: string) => {
      const joistHeight = 0.14;
      const baseHeight = isTopFloor ? heightPerFloor : heightPerFloor - joistHeight;
      let hLeft = baseHeight;
      let hRight = baseHeight;

      if (isTopFloor && isFlatRoof) {
        if (wallId === 'wall-left') {
          const h = baseHeight + width * Math.tan(angleRad);
          return { hLeft: h, hRight: h, average: h };
        } else if (wallId === 'wall-right') {
          return { hLeft: baseHeight, hRight: baseHeight, average: baseHeight };
        } else if (wallId === 'wall-front' || wallId === 'wall-back') {
          const hl = baseHeight + (width + wallThickness) * Math.tan(angleRad);
          const hr = baseHeight;
          hLeft = wallId === 'wall-back' ? hr : hl;
          hRight = wallId === 'wall-back' ? hl : hr;
        }
      }
      return { hLeft, hRight, average: (hLeft + hRight) / 2 };
    };

    // External walls
    floor.walls.forEach((wall) => {
      const dx = wall.end[0] - wall.start[0];
      const dz = wall.end[1] - wall.start[1];
      const wallLength = Math.sqrt(dx * dx + dz * dz);
      
      const { average: wallHeight } = getWallHeightBounds(wall.id);
      const grossArea = wallLength * wallHeight;

      let openingsArea = 0;
      wall.subObjects.forEach((obj) => {
        openingsArea += obj.width * obj.height;
      });

      const netArea = Math.max(0, grossArea - openingsArea);
      const wallTitle = `${floor.level === 0 ? 'Ground' : `Floor ${floor.level + 1}`} - ${
        wall.id === 'wall-front' ? 'Front Wall' :
        wall.id === 'wall-back' ? 'Back Wall' :
        wall.id === 'wall-left' ? 'Left Wall' :
        wall.id === 'wall-right' ? 'Right Wall' : wall.id
      }`;

      // A. External Cladding Calculation
      let extMeters = 0;
      let extPieces = 0;
      const extConfig = state.wallCovers.external;

      if (extConfig.material === 'rhombus' || extConfig.material === 'decking') {
        const boardH = extConfig.width + (extConfig.gap || 0.01);
        const rows = Math.ceil(wallHeight / boardH);
        extMeters = (rows * wallLength) * (netArea / grossArea); // proportional coverage
        extPieces = Math.ceil(extMeters / extConfig.length);
        totalExtCladdingMeters += extMeters;
        totalExtCladdingPieces += extPieces;
      } else if (extConfig.material === 'osb_1250') {
        const sheets = Math.ceil((netArea / (2.50 * 1.25)) * 1.12); // 12% cut wastage
        extPieces = sheets;
        totalExtOSBSheets += sheets;
      } else if (extConfig.material === 'osb_625') {
        const sheets = Math.ceil((netArea / (2.50 * 0.625)) * 1.12);
        extPieces = sheets;
        totalExtOSBSheets += sheets;
      }

      // B. Internal Lining Calculation
      let intMeters = 0;
      let intPieces = 0;
      const intConfig = state.wallCovers.internal;

      if (intConfig.material === 'decking') {
        const boardH = intConfig.width + (intConfig.gap || 0);
        const rows = Math.ceil(wallHeight / boardH);
        intMeters = (rows * wallLength) * (netArea / grossArea);
        intPieces = Math.ceil(intMeters / intConfig.length);
        totalIntCladdingMeters += intMeters;
        totalIntCladdingPieces += intPieces;
      } else if (intConfig.material === 'osb_1250') {
        const sheets = Math.ceil((netArea / (2.50 * 1.25)) * 1.12);
        intPieces = sheets;
        totalIntOSBSheets += sheets;
      } else if (intConfig.material === 'osb_625') {
        const sheets = Math.ceil((netArea / (2.50 * 0.625)) * 1.12);
        intPieces = sheets;
        totalIntOSBSheets += sheets;
      } else if (intConfig.material === 'plasterboard') {
        // Assume standard gypsum board 2.0 x 1.2
        const size = intConfig.width * intConfig.length || 2.4;
        const sheets = Math.ceil((netArea / size) * 1.12);
        intPieces = sheets;
        totalIntPlasterboardSheets += sheets;
      }

      wallEstimations.push({
        wallId: `${floor.id}-${wall.id}`,
        wallTitle,
        netArea,
        grossArea,
        openingsArea,
        external: {
          material: extConfig.material,
          linearMeters: extMeters,
          piecesCount: extPieces
        },
        internal: {
          material: intConfig.material,
          linearMeters: intMeters,
          piecesCount: intPieces
        }
      });
    });

    // Partition walls
    (floor.internalWalls || []).forEach((wall, idx) => {
      const dx = wall.end[0] - wall.start[0];
      const dz = wall.end[1] - wall.start[1];
      const wallLength = Math.sqrt(dx * dx + dz * dz);
      
      const joistHeight = 0.14;
      const wallHeight = isTopFloor ? heightPerFloor : heightPerFloor - joistHeight;
      const grossArea = wallLength * wallHeight;

      let openingsArea = 0;
      wall.subObjects.forEach((obj) => {
        openingsArea += obj.width * obj.height;
      });

      const netArea = Math.max(0, grossArea - openingsArea);
      const wallTitle = `${floor.level === 0 ? 'Ground' : `Floor ${floor.level + 1}`} - Partition Wall ${idx + 1}`;

      // Partition walls have lining on BOTH sides (internal lining config applied twice)
      const intConfig = state.wallCovers.internal;
      let intMeters = 0;
      let intPieces = 0;

      if (intConfig.material === 'decking') {
        const boardH = intConfig.width + (intConfig.gap || 0);
        const rows = Math.ceil(wallHeight / boardH);
        intMeters = (rows * wallLength * 2) * (netArea / grossArea); // Double-sided
        intPieces = Math.ceil(intMeters / intConfig.length);
        totalIntCladdingMeters += intMeters;
        totalIntCladdingPieces += intPieces;
      } else if (intConfig.material === 'osb_1250') {
        const sheets = Math.ceil(((netArea * 2) / (2.50 * 1.25)) * 1.12);
        intPieces = sheets;
        totalIntOSBSheets += sheets;
      } else if (intConfig.material === 'osb_625') {
        const sheets = Math.ceil(((netArea * 2) / (2.50 * 0.625)) * 1.12);
        intPieces = sheets;
        totalIntOSBSheets += sheets;
      } else if (intConfig.material === 'plasterboard') {
        const size = intConfig.width * intConfig.length || 2.4;
        const sheets = Math.ceil(((netArea * 2) / size) * 1.12);
        intPieces = sheets;
        totalIntPlasterboardSheets += sheets;
      }

      wallEstimations.push({
        wallId: wall.id,
        wallTitle,
        netArea,
        grossArea,
        openingsArea,
        // Partition walls have no external side covers
        external: {
          material: 'none',
          linearMeters: 0,
          piecesCount: 0
        },
        internal: {
          material: intConfig.material,
          linearMeters: intMeters,
          piecesCount: intPieces
        }
      });
    });
  });

  return {
    roof: roofEstimation,
    walls: wallEstimations,
    totals: {
      externalCladdingMeters: totalExtCladdingMeters,
      externalCladdingPieces: totalExtCladdingPieces,
      externalOSBSheets: totalExtOSBSheets,
      internalOSBSheets: totalIntOSBSheets,
      internalPlasterboardSheets: totalIntPlasterboardSheets,
      internalCladdingMeters: totalIntCladdingMeters,
      internalCladdingPieces: totalIntCladdingPieces,
      roofSheetingSheets: sheetingSheets,
      roofShinglesCount: state.topCover.material === 'shingles' ? topCoverPieces : 0,
      roofTilesCount: state.topCover.material === 'tiles' ? topCoverPieces : 0,
      roofPlatesCount: state.topCover.material === 'plates' ? topCoverPieces : 0
    }
  };
}
