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
  if (type === 'flat') {
    // Flat roof joists/rafters sloping along inclination
    const rafterSpacing = 0.6;
    const rafterThickness = 0.04;
    const rafterHeight = 0.14; // 2x6 rafters
    const rafterLength = (width + wallThickness) / Math.cos(angleRad) + overhang * 2;

    const spanningWidth = depth + overhang * 2 - rafterThickness;
    const numSpaces = Math.max(1, Math.ceil(spanningWidth / rafterSpacing));
    const actualSpacing = spanningWidth / numSpaces;
    const rafterCount = numSpaces + 1;

    for (let i = 0; i < rafterCount; i++) {
      const rz = -depth / 2 - overhang + rafterThickness / 2 + i * actualSpacing;
      // Slanted rafters centered at X=0, sloping around Z-axis rotation
      members.push({
        id: `roof-rafter-flat-${i}`,
        type: 'rafter',
        position: [0, topElevation + (width / 2 + wallThickness / 2) * Math.tan(angleRad) + (rafterHeight / 2) / Math.cos(angleRad), rz],
        rotation: [0, 0, -angleRad],
        size: [rafterLength, rafterHeight, rafterThickness],
      });
    }
  } else {
    // Saddle roof trusses running along depth Z
    const rafterSpacing = 0.6;
    const rafterThickness = 0.04;
    const rafterHeight = 0.14; // 2x6 rafters
    
    // Ridge beam along the Z center line
    const ridgeLength = depth + overhang * 2;
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

    const spanningWidth = depth + overhang * 2 - rafterThickness;
    const numSpaces = Math.max(1, Math.ceil(spanningWidth / rafterSpacing));
    const actualSpacing = spanningWidth / numSpaces;
    const rafterCount = numSpaces + 1;

    for (let i = 0; i < rafterCount; i++) {
      const rz = -depth / 2 - overhang + rafterThickness / 2 + i * actualSpacing;

      // Right slope rafters
      const rightX = halfRoofWidth / 2;
      const rightY = topElevation + (halfGableWidth - halfRoofWidth / 2) * Math.tan(angleRad) + (rafterHeight / 2) / Math.cos(angleRad);
      members.push({
        id: `roof-rafter-saddle-right-${i}`,
        type: 'rafter',
        position: [rightX, rightY, rz],
        rotation: [0, 0, -angleRad],
        size: [slopeLength, rafterHeight, rafterThickness],
      });

      // Left slope rafters
      const leftX = -halfRoofWidth / 2;
      const leftY = topElevation + (halfGableWidth - halfRoofWidth / 2) * Math.tan(angleRad) + (rafterHeight / 2) / Math.cos(angleRad);
      members.push({
        id: `roof-rafter-saddle-left-${i}`,
        type: 'rafter',
        position: [leftX, leftY, rz],
        rotation: [0, 0, angleRad],
        size: [slopeLength, rafterHeight, rafterThickness],
      });

      // Collar tie (horizontal bracing joist across rafters)
      if (i > 0 && i < rafterCount - 1) {
        const collarY = topElevation + 0.6; // 60cm above wall plates
        const yOffset = collarY - topElevation;
        const maxWidth = 2 * (halfGableWidth - yOffset / Math.tan(angleRad));
        const collarWidth = Math.max(0.5, maxWidth - 0.02);

        members.push({
          id: `roof-collar-tie-${i}`,
          type: 'joist',
          position: [0, collarY, rz + rafterThickness],
          rotation: [0, 0, 0],
          size: [collarWidth, 0.09, rafterThickness],
        });
      }
    }
  }

  return members;
}
