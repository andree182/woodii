import { ProjectState } from '../../types';
import { FramingMember } from '../framingEngine';

export function generateRoof(state: ProjectState): FramingMember[] {
  const members: FramingMember[] = [];
  const { width, depth, heightPerFloor } = state.dimensions;
  const totalFloors = state.floors.length;
  const lumberThickness = 0.04; // 40mm

  const topElevation = totalFloors * heightPerFloor;
  const { overhang, inclination, type } = state.roof;
  const angleRad = (inclination * Math.PI) / 180;

  const wallThickness = state.floors[0]?.walls[0]?.thickness || 0.15;
  const roofCovers = state.roofCovers || { gableMaterial: 'none', gableThickness: 0.02 };
  const gableThickness = roofCovers.gableMaterial !== 'none' ? roofCovers.gableThickness : 0;

  const rafterThickness = 0.04;
  const rafterHeight = 0.14; // 2x6 rafters

  // Determine spacing based on sheeting material
  let spacing = 0.625;
  const sheeting = state.topCover?.sheetingMaterial || 'osb_1250';
  if (sheeting === 'osb_1250' || sheeting === 'osb_625') {
    spacing = 0.625;
  } else if (sheeting === 'plywood') {
    spacing = 0.61; // 610mm
  } else {
    spacing = 0.625;
  }

  // Rafter Z-positions: fly rafters at ends, wall rafters, and internal rafters
  const backFlyZ = -depth / 2 - overhang + gableThickness + rafterThickness / 2;
  const backWallZ = -depth / 2;
  const frontWallZ = depth / 2;
  const frontFlyZ = depth / 2 + overhang - gableThickness - rafterThickness / 2;

  // OSB boards start at the back edge of the roof sheathing
  const sheathingStartZ = -depth / 2 - overhang;
  const internalZs: number[] = [];
  
  // Place internal rafters at exact spacing intervals starting from sheathingStartZ
  // They must be strictly inside the walls to not conflict with wall rafters
  let currentZ = sheathingStartZ + spacing;
  while (currentZ < depth / 2 - 0.05) {
    if (currentZ > -depth / 2 + 0.05) {
      internalZs.push(currentZ);
    }
    currentZ += spacing;
  }

  const rafterZs: number[] = [];
  if (overhang > 0.01) {
    rafterZs.push(backFlyZ);
  }
  rafterZs.push(backWallZ);
  rafterZs.push(...internalZs);
  rafterZs.push(frontWallZ);
  if (overhang > 0.01) {
    rafterZs.push(frontFlyZ);
  }

  if (type === 'flat') {
    // Flat roof joists/rafters sloping along inclination
    const rafterLength = (width + wallThickness) / Math.cos(angleRad) + overhang * 2;

    rafterZs.forEach((rz, idx) => {
      members.push({
        id: `roof-rafter-flat-${idx}`,
        type: 'rafter',
        position: [0, topElevation + (width / 2 + wallThickness / 2) * Math.tan(angleRad) + (rafterHeight / 2) / Math.cos(angleRad), rz],
        rotation: [0, 0, -angleRad],
        size: [rafterLength, rafterHeight, rafterThickness],
      });
    });
  } else {
    // Ridge beam along the Z center line (terminating inside gable boards)
    const ridgeLength = depth + overhang * 2 - gableThickness * 2;
    const ridgeHeight = 0.18; // 2x8 ridge beam
    const halfGableWidth = width / 2 + wallThickness * 0.5;
    
    members.push({
      id: `roof-ridge-beam`,
      type: 'ridge',
      position: [0, topElevation + halfGableWidth * Math.tan(angleRad) + ridgeHeight / 2, 0],
      rotation: [0, 0, 0],
      size: [lumberThickness, ridgeHeight, ridgeLength],
    });

    const ridgeThickness = lumberThickness; // 0.04m
    const halfRoofWidth = halfGableWidth + overhang;
    const horizontalSpan = halfRoofWidth - ridgeThickness / 2;
    const slopeLength = horizontalSpan / Math.cos(angleRad);

    rafterZs.forEach((rz, idx) => {
      // Right slope rafters
      const rightX = ridgeThickness / 2 + horizontalSpan / 2;
      const rightY = topElevation + (halfGableWidth - rightX) * Math.tan(angleRad) + (rafterHeight / 2) / Math.cos(angleRad);
      members.push({
        id: `roof-rafter-saddle-right-${idx}`,
        type: 'rafter',
        position: [rightX, rightY, rz],
        rotation: [0, 0, -angleRad],
        size: [slopeLength, rafterHeight, rafterThickness],
      });

      // Left slope rafters
      const leftX = -rightX;
      const leftY = rightY;
      members.push({
        id: `roof-rafter-saddle-left-${idx}`,
        type: 'rafter',
        position: [leftX, leftY, rz],
        rotation: [0, 0, angleRad],
        size: [slopeLength, rafterHeight, rafterThickness],
      });

      // Collar ties on internal rafters only
      const isInternal = rz > backWallZ && rz < frontWallZ;
      if (isInternal) {
        const collarY = topElevation + 0.6; // 60cm above wall plates
        const yOffset = collarY - topElevation;
        const maxWidth = 2 * (halfGableWidth - yOffset / Math.tan(angleRad));
        const collarWidth = Math.max(0.5, maxWidth - 0.02);

        members.push({
          id: `roof-collar-tie-${idx}`,
          type: 'joist',
          position: [0, collarY, rz + rafterThickness],
          rotation: [0, 0, 0],
          size: [collarWidth, 0.09, rafterThickness],
        });
      }
    });
  }

  return members;
}
