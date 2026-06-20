import { ProjectState } from '../types';

export interface FramingMember {
  id: string;
  type: 'stud' | 'plate' | 'joist' | 'rafter' | 'header' | 'sill' | 'ridge';
  position: [number, number, number]; // Center in world coordinates [X, Y, Z]
  rotation: [number, number, number]; // Rotation angles [X, Y, Z] in radians
  size: [number, number, number];     // Size dimensions [width, height, depth]
  floorId?: string;                   // Optional association to specific Floor
  wallId?: string;                    // Optional association to specific Wall
}

export function generateFraming(state: ProjectState): FramingMember[] {
  const members: FramingMember[] = [];
  const { width, depth, heightPerFloor } = state.dimensions;
  const totalFloors = state.floors.length;

  const lumberThickness = 0.04; // 40mm
  const lumberWidth = 0.09;     // 90mm (2x4 standard)

  // ----------------------------------------------------
  // 1. FLOOR JOISTS GENERATION (For each floor)
  // ----------------------------------------------------
  for (let level = 0; level <= totalFloors; level++) {
    const floorY = level * heightPerFloor;
    const joistHeight = 0.14; // 2x6 floor joists
    const joistThickness = 0.04;
    
    // Find the floor at this level (or the top-most floor if level = totalFloors)
    const floor = state.floors.find(f => f.level === level) || state.floors[state.floors.length - 1];
    if (!floor) continue;

    const wallThickness = floor.walls[0]?.thickness || 0.15;
    const outerW = width + wallThickness * 0.70;
    const outerD = depth + wallThickness * 0.70;

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

  // ----------------------------------------------------
  // 2. WALL FRAMING GENERATION (For each wall & floor)
  // ----------------------------------------------------
  state.floors.forEach((floor) => {
    const isTopFloor = floor.level === totalFloors - 1;
    const isFlatRoof = state.roof.type === 'flat';
    const angleRad = (state.roof.inclination * Math.PI) / 180;

    floor.walls.forEach((wall) => {
      const startX = wall.start[0];
      const startZ = wall.start[1];
      const endX = wall.end[0];
      const endZ = wall.end[1];

      const dx = endX - startX;
      const dz = endZ - startZ;
      const length = Math.sqrt(dx * dx + dz * dz);
      const rotationY = -Math.atan2(dz, dx);

      // Determine heights
      const joistHeight = 0.14;
      const baseHeight = isTopFloor ? heightPerFloor : heightPerFloor - joistHeight;
      let wallBaseHeight = baseHeight;
      let hLeft = baseHeight;
      let hRight = baseHeight;
      const isBack = wall.id === 'wall-back';

      if (isTopFloor && isFlatRoof) {
        if (wall.id === 'wall-left') {
          wallBaseHeight = baseHeight + width * Math.tan(angleRad);
        } else if (wall.id === 'wall-right') {
          wallBaseHeight = baseHeight;
        } else if (wall.id === 'wall-front' || wall.id === 'wall-back') {
          const hl = baseHeight + (width + wall.thickness) * Math.tan(angleRad);
          const hr = baseHeight;
          hLeft = isBack ? hr : hl;
          hRight = isBack ? hl : hr;
        }
      }

      // Plates and studs positions inside local wall space
      // Local X: 0 to length
      // Local Y: 0 to wallBaseHeight
      // Local Z: 0 (center of wall thickness)

      const wallYOffset = floor.level * heightPerFloor;

      // Helper to transform local coordinates [lx, ly, lz] to world space
      const toWorld = (lx: number, ly: number, lz: number): [number, number, number] => {
        // Rotate local coordinate around Y
        const cosY = Math.cos(rotationY);
        const sinY = Math.sin(rotationY);
        const wx = startX + lx * cosY - lz * sinY;
        const wz = startZ - lx * sinY - lz * cosY; // Note matching R3F Z space direction
        const wy = wallYOffset + ly;
        return [wx, wy, wz];
      };

      // A. Bottom Plate (segmented around doors and floor-level openings)
      const cuts: { start: number; end: number }[] = [];
      wall.subObjects.forEach((obj) => {
        const isDoor = obj.type === 'door';
        const isOpening = obj.type === 'opening';
        const defaultElevation = isDoor ? 0 : (isOpening ? 0 : 0.9);
        const currentElevation = obj.elevation !== undefined ? obj.elevation : defaultElevation;
        
        // If it starts at the bottom of the wall (clampedElevation < 0.05), we cut the bottom plate
        if ((isDoor || isOpening) && currentElevation < 0.05) {
          const xStart = obj.position - obj.width / 2;
          const xEnd = obj.position + obj.width / 2;
          cuts.push({ start: xStart, end: xEnd });
        }
      });

      // Sort cuts by start coordinate
      cuts.sort((a, b) => a.start - b.start);

      const bottomSegments: { start: number; end: number }[] = [];
      let currentX = 0;

      cuts.forEach((cut) => {
        if (cut.start - currentX > 0.02) {
          bottomSegments.push({ start: currentX, end: cut.start });
        }
        currentX = Math.max(currentX, cut.end);
      });

      if (length - currentX > 0.02) {
        bottomSegments.push({ start: currentX, end: length });
      }

      bottomSegments.forEach((seg, idx) => {
        const segLen = seg.end - seg.start;
        members.push({
          id: `wall-bottom-plate-${floor.id}-${wall.id}-${idx}`,
          type: 'plate',
          position: toWorld((seg.start + seg.end) / 2, lumberThickness / 2, 0),
          rotation: [0, rotationY, 0],
          size: [segLen, lumberThickness, wall.thickness - 0.02],
        });
      });

      // B. Top Plates (Double)
      const renderTopPlates = (x1: number, x2: number, y1: number, y2: number) => {
        const segLen = x2 - x1;
        const avgY = (y1 + y2) / 2;
        const slopeAngle = Math.atan2(y2 - y1, segLen);
        
        // Double top plates
        members.push({
          id: `wall-top-plate-1-${floor.id}-${wall.id}-${x1.toFixed(2)}`,
          type: 'plate',
          position: toWorld((x1 + x2) / 2, avgY - lumberThickness / 2, 0),
          rotation: [0, rotationY, slopeAngle],
          size: [segLen, lumberThickness, wall.thickness - 0.02],
        });
        members.push({
          id: `wall-top-plate-2-${floor.id}-${wall.id}-${x1.toFixed(2)}`,
          type: 'plate',
          position: toWorld((x1 + x2) / 2, avgY - lumberThickness * 1.5, 0),
          rotation: [0, rotationY, slopeAngle],
          size: [segLen, lumberThickness, wall.thickness - 0.02],
        });
      };

      if (isTopFloor && isFlatRoof && (wall.id === 'wall-front' || wall.id === 'wall-back')) {
        renderTopPlates(0, length, hLeft, hRight);
      } else {
        renderTopPlates(0, length, wallBaseHeight, wallBaseHeight);
      }

      // Compute stud heights and locations
      const studSpacing = 0.6; // 60cm stud spacing
      const studCount = Math.floor(length / studSpacing) + 1;
      const studLocations: number[] = [];

      for (let i = 0; i < studCount; i++) {
        const x = i * studSpacing;
        if (x > 0.05 && x < length - 0.05) {
          studLocations.push(x);
        }
      }

      // Californian corner end studs:
      // Always place studs at start (0.02) and end (length - 0.02) of the wall
      const startStudX = lumberThickness / 2;
      const endStudX = length - lumberThickness / 2;

      // Californian corner backing stud:
      // Front and back walls receive the backing stud to support drywall/cladding
      const cornersBacking: number[] = [];
      if (wall.id === 'wall-front' || wall.id === 'wall-back') {
        cornersBacking.push(wall.thickness - lumberThickness / 2);
        cornersBacking.push(length - wall.thickness + lumberThickness / 2);
      }

      // Collect opening regions to filter out overlapping standard studs
      const openingRanges: { start: number; end: number }[] = [];
      wall.subObjects.forEach((obj) => {
        openingRanges.push({
          start: obj.position - obj.width / 2 - 0.1,
          end: obj.position + obj.width / 2 + 0.1,
        });
      });

      const isInsideOpening = (x: number) => {
        return openingRanges.some(r => x >= r.start && x <= r.end);
      };

      // Get wall height at a given local X offset
      const getWallHeightAtX = (x: number): number => {
        if (isTopFloor && isFlatRoof && (wall.id === 'wall-front' || wall.id === 'wall-back')) {
          return hLeft + (x / length) * (hRight - hLeft);
        }
        return wallBaseHeight;
      };

      // Helper to render a vertical stud between bottom plate and top plates
      const renderStud = (id: string, localX: number) => {
        const wHeight = getWallHeightAtX(localX);
        const studHeight = wHeight - lumberThickness * 3; // Subtract bottom plate (1) + double top plate (2)
        const studY = lumberThickness + studHeight / 2;
        members.push({
          id,
          type: 'stud',
          position: toWorld(localX, studY, 0),
          rotation: [0, rotationY, 0],
          size: [lumberThickness, studHeight, lumberWidth],
        });
      };

      // Place Californian Corner & End studs
      renderStud(`wall-stud-start-${floor.id}-${wall.id}`, startStudX);
      renderStud(`wall-stud-end-${floor.id}-${wall.id}`, endStudX);
      cornersBacking.forEach((bx, idx) => {
        renderStud(`wall-stud-corner-backing-${idx}-${floor.id}-${wall.id}`, bx);
      });

      // Place Standard spacing studs if they do not clash with openings
      studLocations.forEach((sx, idx) => {
        if (!isInsideOpening(sx)) {
          renderStud(`wall-stud-spaced-${idx}-${floor.id}-${wall.id}`, sx);
        }
      });

      // C. Render openings framing (King studs, Jack studs, Headers, Sills, Cripples)
      wall.subObjects.forEach((rawObj) => {
        const isDoor = rawObj.type === 'door';
        const isWindow = rawObj.type === 'window';
        const defaultElevation = isDoor ? 0 : (isWindow ? 0.9 : 0);
        const currentElevation = rawObj.elevation !== undefined ? rawObj.elevation : defaultElevation;
        const localWallHeightAtObj = getWallHeightAtX(rawObj.position);
        
        const lumberThickness = 0.04;
        const doubleTopPlate = 0.08;
        const headerThickness = 0.14;
        const topClearance = doubleTopPlate + headerThickness; // 0.22
        let clampedElevation = currentElevation;
        let clampedHeight = rawObj.height;

        if (isDoor) {
          clampedElevation = 0;
          clampedHeight = Math.max(0.1, Math.min(localWallHeightAtObj - topClearance, rawObj.height));
        } else if (isWindow) {
          const minElevation = lumberThickness;
          clampedHeight = Math.max(0.1, Math.min(localWallHeightAtObj - topClearance - minElevation, rawObj.height));
          clampedElevation = Math.max(minElevation, Math.min(localWallHeightAtObj - topClearance - clampedHeight, currentElevation));
        } else {
          // opening
          if (currentElevation < 0.05) {
            clampedElevation = 0;
            clampedHeight = Math.max(0.1, Math.min(localWallHeightAtObj - topClearance, rawObj.height));
          } else {
            const minElevation = lumberThickness;
            clampedHeight = Math.max(0.1, Math.min(localWallHeightAtObj - topClearance - minElevation, rawObj.height));
            clampedElevation = Math.max(minElevation, Math.min(localWallHeightAtObj - topClearance - clampedHeight, currentElevation));
          }
        }

        const obj = { ...rawObj, height: clampedHeight, elevation: clampedElevation };
        const xStart = obj.position - obj.width / 2;
        const xEnd = obj.position + obj.width / 2;
        
        const yStart = obj.elevation;
        const yEnd = obj.elevation + obj.height;

        // 1. King Studs (Full-height on both sides)
        const kingLeftX = xStart - lumberThickness - lumberThickness / 2;
        const kingRightX = xEnd + lumberThickness + lumberThickness / 2;
        renderStud(`wall-stud-king-left-${floor.id}-${wall.id}-${obj.id}`, kingLeftX);
        renderStud(`wall-stud-king-right-${floor.id}-${wall.id}-${obj.id}`, kingRightX);

        // 2. Jack Studs (Support the header, height runs from bottom plate to bottom of header)
        const jackLeftX = xStart - lumberThickness / 2;
        const jackRightX = xEnd + lumberThickness / 2;
        const headerBottomY = yEnd;
        
        // Left Jack stud
        const jackLeftHeight = headerBottomY - lumberThickness;
        members.push({
          id: `wall-stud-jack-left-${floor.id}-${wall.id}-${obj.id}`,
          type: 'stud',
          position: toWorld(jackLeftX, lumberThickness + jackLeftHeight / 2, 0),
          rotation: [0, rotationY, 0],
          size: [lumberThickness, jackLeftHeight, lumberWidth],
        });

        // Right Jack stud
        const jackRightHeight = headerBottomY - lumberThickness;
        members.push({
          id: `wall-stud-jack-right-${floor.id}-${wall.id}-${obj.id}`,
          type: 'stud',
          position: toWorld(jackRightX, lumberThickness + jackRightHeight / 2, 0),
          rotation: [0, rotationY, 0],
          size: [lumberThickness, jackRightHeight, lumberWidth],
        });

        // 3. Header (horizontal load-bearing beam, double width)
        const headerWidth = obj.width + lumberThickness * 2;
        members.push({
          id: `wall-header-${floor.id}-${wall.id}-${obj.id}`,
          type: 'header',
          position: toWorld(obj.position, yEnd + headerThickness / 2, 0),
          rotation: [0, rotationY, 0],
          size: [headerWidth, headerThickness, wall.thickness - 0.01],
        });

        // 4. Window Sill (if not a door and is elevated)
        if (!isDoor && yStart >= 0.05) {
          members.push({
            id: `wall-sill-${floor.id}-${wall.id}-${obj.id}`,
            type: 'sill',
            position: toWorld(obj.position, yStart - lumberThickness / 2, 0),
            rotation: [0, rotationY, 0],
            size: [obj.width, lumberThickness, lumberWidth],
          });

          // Cripple studs underneath the sill (spaced every 0.4m)
          const underSillSpacing = 0.4;
          const underSillStuds = Math.floor(obj.width / underSillSpacing) + 1;
          for (let i = 0; i < underSillStuds; i++) {
            const cx = xStart + (i / Math.max(1, underSillStuds - 1)) * obj.width;
            const crippleHeight = yStart - lumberThickness * 2; // Between bottom plate and sill
            if (crippleHeight > 0.05) {
              members.push({
                id: `wall-cripple-under-${i}-${floor.id}-${wall.id}-${obj.id}`,
                type: 'stud',
                position: toWorld(cx, lumberThickness + crippleHeight / 2, 0),
                rotation: [0, rotationY, 0],
                size: [lumberThickness, crippleHeight, lumberWidth],
              });
            }
          }
        }

        // 5. Cripple Studs above the header (to double top plates)
        const headerTopY = yEnd + headerThickness;
        const wallTopYAtObj = getWallHeightAtX(obj.position);
        const crippleAboveHeight = (wallTopYAtObj - lumberThickness * 2) - headerTopY; // below top plates

        if (crippleAboveHeight > 0.05) {
          const aboveHeaderSpacing = 0.4;
          const aboveHeaderStuds = Math.floor(obj.width / aboveHeaderSpacing) + 1;
          for (let i = 0; i < aboveHeaderStuds; i++) {
            const cx = xStart + (i / Math.max(1, aboveHeaderStuds - 1)) * obj.width;
            members.push({
              id: `wall-cripple-above-${i}-${floor.id}-${wall.id}-${obj.id}`,
              type: 'stud',
              position: toWorld(cx, headerTopY + crippleAboveHeight / 2, 0),
              rotation: [0, rotationY, 0],
              size: [lumberThickness, crippleAboveHeight, lumberWidth],
            });
          }
        }
      });
    });
  });

  // ----------------------------------------------------
  // 3. ROOF FRAMING GENERATION
  // ----------------------------------------------------
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
        const collarY = topElevation + 0.6; // 60cm above wall plates (shorter and higher up)
        const yOffset = collarY - topElevation;
        const maxWidth = 2 * (halfGableWidth - yOffset / Math.tan(angleRad) - rafterHeight / Math.cos(angleRad));
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

  // Post-process to associate members with specific floors and walls for localized cut lists
  members.forEach((member) => {
    if (member.id.startsWith('floor-')) {
      const match = member.id.match(/floor-.*?-(\d+)/) || member.id.match(/-(\d+)(?:-|$)/);
      if (match) {
        const level = parseInt(match[1], 10);
        const floor = state.floors.find(f => f.level === level);
        if (floor) {
          member.floorId = floor.id;
        }
      }
    } else if (member.id.startsWith('wall-')) {
      const floorMatch = member.id.match(/(floor-\d+)/);
      const wallMatch = member.id.match(/(wall-(?:front|back|left|right))/);
      if (floorMatch) member.floorId = floorMatch[1];
      if (wallMatch) member.wallId = wallMatch[1];
    }
  });

  return members;
}
