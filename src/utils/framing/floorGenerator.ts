import { ProjectState } from '../../types';
import { FramingMember, getWallLayers } from '../framingEngine';

export function generateFloorJoists(state: ProjectState): FramingMember[] {
  const members: FramingMember[] = [];
  const { width, depth, heightPerFloor } = state.dimensions;
  const totalFloors = state.floors.length;
  const joistThickness = 0.04;

  for (let level = 0; level <= totalFloors; level++) {
    const floorY = level * heightPerFloor;
    const joistHeight = 0.14; // 2x6 floor joists
    
    // Find the floor at this level (or the top-most floor if level = totalFloors)
    const floor = state.floors.find(f => f.level === level) || state.floors[state.floors.length - 1];
    if (!floor) continue;

    const { outer, middle, inner } = getWallLayers(state);
    const T_total = outer + middle + inner;
    const outerW = width + T_total - 2 * outer;
    const outerD = depth + T_total - 2 * outer;

    // Front and Back Rim Joists
    members.push({
      id: `floor-rim-front-${level}`,
      type: 'joist',
      position: [0, floorY - joistHeight / 2, outerD / 2 - joistThickness / 2],
      rotation: [0, 0, 0],
      size: [outerW, joistHeight, joistThickness],
    });
    members.push({
      id: `floor-rim-back-${level}`,
      type: 'joist',
      position: [0, floorY - joistHeight / 2, -outerD / 2 + joistThickness / 2],
      rotation: [0, 0, 0],
      size: [outerW, joistHeight, joistThickness],
    });

    // Regular floor joists running along Z (depth)
    const joistSpacing = 0.4; // 40cm spacing
    const halfWidth = outerW / 2;
    
    // Space the joists symmetrically and flush with the outer left and right faces of the floor slab
    const spacingWidth = outerW - joistThickness;
    const numSpaces = Math.max(1, Math.ceil(spacingWidth / joistSpacing));
    const actualSpacing = spacingWidth / numSpaces;
    const joistCount = numSpaces + 1;

    const opening = level === totalFloors ? state.roof.roofOpening : floor.floorOpening;

    for (let i = 0; i < joistCount; i++) {
      const joistX = -halfWidth + joistThickness / 2 + i * actualSpacing;

      // Check if this joist intersects with the floor opening (stairwell)
      if (opening && joistX > (opening.x - opening.width / 2 - 0.02) && joistX < (opening.x + opening.width / 2 + 0.02)) {
        // Cut the joist: render front and back segments
        const zStartOpening = opening.z - opening.depth / 2;
        const zEndOpening = opening.z + opening.depth / 2;

        // Front segment
        const frontLength = (outerD / 2 - joistThickness) - zEndOpening;
        if (frontLength > 0.1) {
          members.push({
            id: `floor-joist-${level}-${i}-front`,
            type: 'joist',
            position: [joistX, floorY - joistHeight / 2, zEndOpening + frontLength / 2],
            rotation: [0, 0, 0],
            size: [joistThickness, joistHeight, frontLength],
          });
        }

        // Back segment
        const backLength = zStartOpening - (-outerD / 2 + joistThickness);
        if (backLength > 0.1) {
          members.push({
            id: `floor-joist-${level}-${i}-back`,
            type: 'joist',
            position: [joistX, floorY - joistHeight / 2, -outerD / 2 + joistThickness + backLength / 2],
            rotation: [0, 0, 0],
            size: [joistThickness, joistHeight, backLength],
          });
        }
      } else {
        // Regular uncut joist
        members.push({
          id: `floor-joist-${level}-${i}`,
          type: 'joist',
          position: [joistX, floorY - joistHeight / 2, 0],
          rotation: [0, 0, 0],
          size: [joistThickness, joistHeight, outerD - joistThickness * 2],
        });
      }
    }

    // Floor blocking (Joist bridging) along centerline (Z = 0)
    if (state.structuralConfig?.floorBlocking) {
      for (let i = 0; i < joistCount - 1; i++) {
        const x1 = -halfWidth + joistThickness / 2 + i * actualSpacing;
        const x2 = x1 + actualSpacing;
        const blockX = (x1 + x2) / 2;
        const blockWidth = actualSpacing - joistThickness;

        // Determine Z stagger: even bays at -0.02, odd at +0.02
        const zOffset = (i % 2 === 0) ? -0.02 : 0.02;

        if (opening) {
          // Check if this block falls inside the opening area
          const overlaps = blockX + blockWidth/2 > (opening.x - opening.width / 2 - 0.02) &&
                           blockX - blockWidth/2 < (opening.x + opening.width / 2 + 0.02) &&
                           zOffset > (opening.z - opening.depth / 2 - 0.02) &&
                           zOffset < (opening.z + opening.depth / 2 + 0.02);
          if (overlaps) continue;
        }

        members.push({
          id: `floor-blocking-${level}-${i}`,
          type: 'joist',
          position: [blockX, floorY - joistHeight / 2, zOffset],
          rotation: [0, 0, 0],
          size: [blockWidth, joistHeight, joistThickness],
          floorId: floor.id,
        });
      }
    }

    // Floor Opening Headers
    if (opening) {
      const zStartOpening = opening.z - opening.depth / 2;
      const zEndOpening = opening.z + opening.depth / 2;
      
      // Header at front of opening
      members.push({
        id: `floor-header-front-${level}`,
        type: 'header',
        position: [opening.x, floorY - joistHeight / 2, zEndOpening - joistThickness / 2],
        rotation: [0, 0, 0],
        size: [opening.width, joistHeight, joistThickness],
      });
      // Header at back of opening
      members.push({
        id: `floor-header-back-${level}`,
        type: 'header',
        position: [opening.x, floorY - joistHeight / 2, zStartOpening + joistThickness / 2],
        rotation: [0, 0, 0],
        size: [opening.width, joistHeight, joistThickness],
      });
    }
  }

  return members;
}
