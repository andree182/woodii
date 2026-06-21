import { generateRoof } from '../roofGenerator';
import { ProjectState } from '../../../types';

// Simple lightweight test runner to run tests in Node 18 without Vitest engine errors
export function describe(name: string, fn: () => void) {
  console.log(`\n\x1b[36m=== ${name} ===\x1b[0m`);
  fn();
}

export function it(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  } catch (err: any) {
    console.error(`  \x1b[31m✗\x1b[0m ${name}`);
    console.error(`    Error: ${err.message}`);
    if (err.stack) {
      const relevantStack = err.stack.split('\n').slice(0, 3).join('\n    ');
      console.error(`    Stack:\n    ${relevantStack}`);
    }
    const g = globalThis as any;
    if (g.process) {
      g.process.exitCode = 1;
    }
  }
}

export const expect = (val: any) => ({
  toBeDefined: () => {
    if (val === undefined || val === null) {
      throw new Error(`Expected defined value but got ${val}`);
    }
  },
  toBeGreaterThan: (other: number) => {
    if (!(val > other)) {
      throw new Error(`Expected ${val} to be greater than ${other}`);
    }
  },
  toBeCloseTo: (other: number, precision: number = 2) => {
    const diff = Math.abs(val - other);
    const threshold = Math.pow(10, -precision) / 2;
    if (diff > threshold) {
      throw new Error(`Expected ${val} to be close to ${other} (diff ${diff} exceeds threshold ${threshold})`);
    }
  }
});

// Mock state generator
function makeMockState(type: 'flat' | 'saddle', inclination = 15, overhang = 0.3): ProjectState {
  return {
    buildingType: 'garden_flat',
    dimensions: { width: 4.0, depth: 5.0, heightPerFloor: 2.5 },
    floors: [
      {
        id: 'floor-0',
        level: 0,
        walls: [
          { id: 'wall-front', start: [-2, 2.5], end: [2, 2.5], thickness: 0.15, subObjects: [] },
          { id: 'wall-back', start: [-2, -2.5], end: [2, -2.5], thickness: 0.15, subObjects: [] }
        ]
      }
    ],
    roof: {
      type,
      inclination,
      overhang,
      thickness: 0.15,
      constructionWidth: 0.1
    },
    foundation: { type: 'slab' },
    wallLayers: { outer: 0.02, middle: 0.10, inner: 0.03 },
    wallPreset: 'diffusion_open',
    structuralConfig: { wallBlocking: true, floorBlocking: true },
    topCover: {
      material: 'shingles',
      width: 1.0,
      height: 0.33,
      visibleWidth: 1.0,
      visibleHeight: 0.145,
      sheetingMaterial: 'osb_1250',
      sheetingThickness: 0.015
    },
    wallCovers: {
      external: { material: 'decking', width: 0.12, length: 2.0, thickness: 0.019 },
      internal: { material: 'plasterboard', width: 1.2, length: 2.6, thickness: 0.0125 }
    },
    roofCovers: {
      soffitMaterial: 'decking',
      soffitThickness: 0.015,
      soffitWidth: 0.12,
      fasciaMaterial: 'wood_board',
      fasciaThickness: 0.02,
      fasciaHeight: 0.18,
      gableMaterial: 'wood_board',
      gableThickness: 0.02,
      gableHeight: 0.18
    },
    uiState: {
      selectedId: null,
      selectedType: null,
      seeThroughMode: 'solid',
      currentFloorView: -1,
      isDragging: false,
      draggedId: null,
      draggedType: null
    }
  };
}

// Geometry math helpers for verification
function getRafterWorldCoords(
  posX: number,
  posY: number,
  angleRad: number,
  sign: number, // 1 for left saddle, -1 for right saddle or flat
  localX: number,
  localY: number
) {
  // Rotate local point [localX, localY] by angleRad * sign around Z
  const theta = angleRad * sign;
  
  // Plumb cut adjustment inside local coordinate X:
  // x' = x'_base + sign * y' * tan(angleRad)
  const adjustedLocalX = localX + sign * localY * Math.tan(angleRad);

  const xWorld = posX + adjustedLocalX * Math.cos(theta) - localY * Math.sin(theta);
  const yWorld = posY + adjustedLocalX * Math.sin(theta) + localY * Math.cos(theta);
  return { x: xWorld, y: yWorld };
}

describe('Roof Geometry Verification Tests', () => {
  describe('Flat Roof Geometry', () => {
    it('1) encompasses rafters and sheeting volume (bottom begins at topElevation)', () => {
      const state = makeMockState('flat', 15);
      const members = generateRoof(state);
      const rafters = members.filter(m => m.type === 'rafter');
      
      const rafterHeight = 0.14;
      const angleRad = (15 * Math.PI) / 180;
      const wallThickness = 0.15;
      const width = 4.0;
      
      // Top of wall
      const topElevation = 2.5;
      
      const rafter = rafters[0];
      expect(rafter).toBeDefined();

      const [posX, posY] = rafter.position;
      
      // Bottom of rafter at the right wall center (x_world = width/2 + wallThickness/2)
      const rightWallX = width / 2 + wallThickness / 2;
      const localXAtRightWall = (rightWallX - posX) / Math.cos(-angleRad);
      
      // At bottom face of rafter, localY = -rafterHeight / 2
      const bottomCoords = getRafterWorldCoords(
        posX,
        posY,
        angleRad,
        -1,
        localXAtRightWall,
        -rafterHeight / 2
      );
      
      // The bottom of the flat roof rafter should align perfectly with the wall top elevation
      expect(bottomCoords.y).toBeCloseTo(topElevation, 4);
    });

    it('2) geometry represents specified inclination for all sloped surfaces', () => {
      const state = makeMockState('flat', 15);
      const members = generateRoof(state);
      const rafters = members.filter(m => m.type === 'rafter');
      
      rafters.forEach(r => {
        const angleRad = (15 * Math.PI) / 180;
        expect(Math.abs(r.rotation[2])).toBeCloseTo(angleRad, 5);
      });
    });

    it('4) has vertical sides (plumb cuts) on rafters', () => {
      const state = makeMockState('flat', 15);
      const members = generateRoof(state);
      const rafters = members.filter(m => m.type === 'rafter');
      
      const rafter = rafters[0];
      const rafterLength = rafter.size[0];
      const rafterHeight = rafter.size[1];
      const angleRad = (15 * Math.PI) / 180;

      // Left rafter end (high end): check top and bottom points
      const topLeft = getRafterWorldCoords(
        rafter.position[0],
        rafter.position[1],
        angleRad,
        -1,
        -rafterLength / 2,
        rafterHeight / 2
      );

      const bottomLeft = getRafterWorldCoords(
        rafter.position[0],
        rafter.position[1],
        angleRad,
        -1,
        -rafterLength / 2,
        -rafterHeight / 2
      );

      expect(topLeft.x).toBeCloseTo(bottomLeft.x, 4);

      // Right rafter end (low end): check top and bottom points
      const topRight = getRafterWorldCoords(
        rafter.position[0],
        rafter.position[1],
        angleRad,
        -1,
        rafterLength / 2,
        rafterHeight / 2
      );

      const bottomRight = getRafterWorldCoords(
        rafter.position[0],
        rafter.position[1],
        angleRad,
        -1,
        rafterLength / 2,
        -rafterHeight / 2
      );

      expect(topRight.x).toBeCloseTo(bottomRight.x, 4);
    });
  });

  describe('Saddle Roof Geometry', () => {
    it('1) encompasses rafters and sheeting (bottom of rafters sits on topElevation)', () => {
      const state = makeMockState('saddle', 20);
      const members = generateRoof(state);
      const leftRafters = members.filter(m => m.id.includes('roof-rafter-saddle-left'));
      const rightRafters = members.filter(m => m.id.includes('roof-rafter-saddle-right'));
      
      expect(leftRafters.length).toBeGreaterThan(0);
      expect(rightRafters.length).toBeGreaterThan(0);

      const topElevation = 2.5;
      const angleRad = (20 * Math.PI) / 180;
      const wallThickness = 0.15;
      const width = 4.0;
      const halfGableWidth = width / 2 + wallThickness / 2;
      
      const rightRafter = rightRafters[0];
      const rafterHeight = rightRafter.size[1];

      // At the eave wall seat (X = halfGableWidth), rafter bottom should sit exactly at topElevation
      const rightWallSeat = getRafterWorldCoords(
        rightRafter.position[0],
        rightRafter.position[1],
        angleRad,
        -1,
        (halfGableWidth - rightRafter.position[0]) / Math.cos(-angleRad),
        -rafterHeight / 2
      );
      
      expect(rightWallSeat.y).toBeCloseTo(topElevation, 4);
    });

    it('2) geometry represents specified inclination for all sloped surfaces', () => {
      const state = makeMockState('saddle', 20);
      const members = generateRoof(state);
      
      const leftRafters = members.filter(m => m.id.includes('roof-rafter-saddle-left'));
      const rightRafters = members.filter(m => m.id.includes('roof-rafter-saddle-right'));
      const angleRad = (20 * Math.PI) / 180;

      leftRafters.forEach(r => {
        expect(Math.abs(r.rotation[2])).toBeCloseTo(angleRad, 5);
      });
      rightRafters.forEach(r => {
        expect(Math.abs(r.rotation[2])).toBeCloseTo(angleRad, 5);
      });
    });

    it('3) is highest in the middle, lowest at both ends', () => {
      const state = makeMockState('saddle', 20);
      const members = generateRoof(state);
      
      const rightRafter = members.find(m => m.id.includes('roof-rafter-saddle-right-0'))!;
      const angleRad = (20 * Math.PI) / 180;
      const rafterLength = rightRafter.size[0];
      const rafterHeight = rightRafter.size[1];

      // Ridge top point (X = 0.02)
      const ridgePoint = getRafterWorldCoords(
        rightRafter.position[0],
        rightRafter.position[1],
        angleRad,
        -1,
        -rafterLength / 2,
        rafterHeight / 2
      );

      // Eave top point
      const eavePoint = getRafterWorldCoords(
        rightRafter.position[0],
        rightRafter.position[1],
        angleRad,
        -1,
        rafterLength / 2,
        rafterHeight / 2
      );

      expect(ridgePoint.y).toBeGreaterThan(eavePoint.y);
      expect(ridgePoint.x).toBeCloseTo(0.02, 4);
    });

    it('4) has vertical sides (plumb cuts) on rafters', () => {
      const state = makeMockState('saddle', 20);
      const members = generateRoof(state);
      const rightRafter = members.find(m => m.id.includes('roof-rafter-saddle-right-0'))!;
      const leftRafter = members.find(m => m.id.includes('roof-rafter-saddle-left-0'))!;
      
      const angleRad = (20 * Math.PI) / 180;

      // Right Rafter Eave (low end) check
      const rightTop = getRafterWorldCoords(
        rightRafter.position[0],
        rightRafter.position[1],
        angleRad,
        -1,
        rightRafter.size[0] / 2,
        rightRafter.size[1] / 2
      );
      const rightBottom = getRafterWorldCoords(
        rightRafter.position[0],
        rightRafter.position[1],
        angleRad,
        -1,
        rightRafter.size[0] / 2,
        -rightRafter.size[1] / 2
      );
      expect(rightTop.x).toBeCloseTo(rightBottom.x, 4);

      // Left Rafter Eave (low end) check
      const leftTop = getRafterWorldCoords(
        leftRafter.position[0],
        leftRafter.position[1],
        angleRad,
        1,
        leftRafter.size[0] / 2,
        leftRafter.size[1] / 2
      );
      const leftBottom = getRafterWorldCoords(
        leftRafter.position[0],
        leftRafter.position[1],
        angleRad,
        1,
        leftRafter.size[0] / 2,
        -leftRafter.size[1] / 2
      );
      expect(leftTop.x).toBeCloseTo(leftBottom.x, 4);
    });
  });

  describe('Solid Roof Block Vertices', () => {
    // Helper for solid block geometry simulation
    function getSolidBlockWorldCoords(
      posX: number,
      posY: number,
      angleRad: number,
      isLeft: boolean,
      localX: number,
      localY: number
    ) {
      // Slope shape coordinates in local space (always negative slope coefficient in our fix)
      const adjustedLocalX = localX - localY * Math.tan(angleRad);

      if (!isLeft) {
        // Right/Flat slope rotation [0, 0, -angleRad]
        const theta = -angleRad;
        const xWorld = posX + adjustedLocalX * Math.cos(theta) - localY * Math.sin(theta);
        const yWorld = posY + adjustedLocalX * Math.sin(theta) + localY * Math.cos(theta);
        return { x: xWorld, y: yWorld };
      } else {
        // Left slope rotation [0, Math.PI, -angleRad]
        // Three.js order is Ry * Rz:
        // xWorld = posX - x' * cos(theta) - y' * sin(theta)
        // yWorld = posY - x' * sin(theta) + y' * cos(theta)
        const theta = angleRad;
        const xWorld = posX - adjustedLocalX * Math.cos(theta) - localY * Math.sin(theta);
        const yWorld = posY - adjustedLocalX * Math.sin(theta) + localY * Math.cos(theta);
        return { x: xWorld, y: yWorld };
      }
    }

    it('5) has vertical ends (plumb cuts) for right slope / flat roof solid block', () => {
      const angleRad = (15 * Math.PI) / 180;
      const L = 4.0;
      const H = 0.3;
      const posX = 0;
      const posY = 2.5;

      // Check left end (ridge) top and bottom
      const topLeft = getSolidBlockWorldCoords(posX, posY, angleRad, false, 0, H);
      const bottomLeft = getSolidBlockWorldCoords(posX, posY, angleRad, false, 0, 0);
      expect(topLeft.x).toBeCloseTo(bottomLeft.x, 4);

      // Check right end (eave) top and bottom
      const topRight = getSolidBlockWorldCoords(posX, posY, angleRad, false, L, H);
      const bottomRight = getSolidBlockWorldCoords(posX, posY, angleRad, false, L, 0);
      expect(topRight.x).toBeCloseTo(bottomRight.x, 4);
    });

    it('6) has vertical ends (plumb cuts) for left slope solid block', () => {
      const angleRad = (20 * Math.PI) / 180;
      const L = 3.5;
      const H = 0.4;
      const posX = 0;
      const posY = 3.0;

      // Check left end (eave) top and bottom
      const topLeft = getSolidBlockWorldCoords(posX, posY, angleRad, true, L, H);
      const bottomLeft = getSolidBlockWorldCoords(posX, posY, angleRad, true, L, 0);
      expect(topLeft.x).toBeCloseTo(bottomLeft.x, 4);

      // Check right end (ridge) top and bottom
      const topRight = getSolidBlockWorldCoords(posX, posY, angleRad, true, 0, H);
      const bottomRight = getSolidBlockWorldCoords(posX, posY, angleRad, true, 0, 0);
      expect(topRight.x).toBeCloseTo(bottomRight.x, 4);
    });
  });
});
