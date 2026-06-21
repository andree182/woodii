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

  const rafterSpacing = 0.6;
  const rafterThickness = 0.04;
  const rafterHeight = 0.14; // 2x6 rafters

  // Rafter Z-positions: fly rafters at ends, wall rafters, and internal rafters
  const backFlyZ = -depth / 2 - overhang + gableThickness + rafterThickness / 2;
  const backWallZ = -depth / 2;
  const frontWallZ = depth / 2;
  const frontFlyZ = depth / 2 + overhang - gableThickness - rafterThickness / 2;

  const internalSpan = depth;
  const numInternalSpaces = Math.max(1, Math.ceil(internalSpan / rafterSpacing));
  const internalSpacing = internalSpan / numInternalSpaces;
  const internalZs: number[] = [];
  for (let i = 1; i < numInternalSpaces; i++) {
    internalZs.push(-depth / 2 + i * internalSpacing);
  }

  const rafterZs = [backFlyZ, backWallZ, ...internalZs, frontWallZ, frontFlyZ];

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

    const halfRoofWidth = halfGableWidth + overhang;
    const slopeLength = halfRoofWidth / Math.cos(angleRad);

    rafterZs.forEach((rz, idx) => {
      // Right slope rafters
      const rightX = halfRoofWidth / 2;
      const rightY = topElevation + (halfGableWidth - halfRoofWidth / 2) * Math.tan(angleRad) + (rafterHeight / 2) / Math.cos(angleRad);
      members.push({
        id: `roof-rafter-saddle-right-${idx}`,
        type: 'rafter',
        position: [rightX, rightY, rz],
        rotation: [0, 0, -angleRad],
        size: [slopeLength, rafterHeight, rafterThickness],
      });

      // Left slope rafters
      const leftX = -halfRoofWidth / 2;
      const leftY = topElevation + (halfGableWidth - halfRoofWidth / 2) * Math.tan(angleRad) + (rafterHeight / 2) / Math.cos(angleRad);
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
