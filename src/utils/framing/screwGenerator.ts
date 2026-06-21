import { ProjectState } from '../../types';
import { FramingMember, getWallLayers } from '../framingEngine';

export function generateScrews(state: ProjectState): FramingMember[] {
  const members: FramingMember[] = [];
  const { width, depth } = state.dimensions;

  if (state.foundation && state.foundation.type === 'screws') {
    const floor = state.floors[0];
    if (floor) {
      const { outer, middle, inner } = getWallLayers(state);
      const T_total = outer + middle + inner;
      const outerW = width + T_total - 2 * outer;
      const outerD = depth + T_total - 2 * outer;

      const spacingLimit = 1.5; // Max 1.5m spacing between screws
      const numSpacesX = Math.max(1, Math.ceil(outerW / spacingLimit));
      const numSpacesZ = Math.max(1, Math.ceil(outerD / spacingLimit));
      const screwCountX = numSpacesX + 1;
      const screwCountZ = numSpacesZ + 1;

      const screwLength = 0.80; // 800mm length
      const screwDiameter = 0.08; // 80mm diameter
      const joistHeight = 0.14;

      for (let i = 0; i < screwCountX; i++) {
        const sx = -outerW / 2 + (i * (outerW / numSpacesX));
        for (let j = 0; j < screwCountZ; j++) {
          const sz = -outerD / 2 + (j * (outerD / numSpacesZ));
          members.push({
            id: `foundation-screw-${i}-${j}`,
            type: 'screw',
            position: [sx, -joistHeight - screwLength / 2, sz],
            rotation: [0, 0, 0],
            size: [screwDiameter, screwLength, screwDiameter],
            floorId: floor.id,
          });
        }
      }
    }
  }

  return members;
}
