import { ProjectState } from '../../types';
import { FramingMember, getWallLayers } from '../framingEngine';

export function generateWalls(state: ProjectState): FramingMember[] {
  const members: FramingMember[] = [];
  const { width, heightPerFloor } = state.dimensions;
  const totalFloors = state.floors.length;
  const lumberThickness = 0.04; // 40mm

  state.floors.forEach((floor) => {
    const isTopFloor = floor.level === totalFloors - 1;
    const isFlatRoof = state.roof.type === 'flat';
    const angleRad = (state.roof.inclination * Math.PI) / 180;

    // External walls loop
    floor.walls.forEach((wall) => {
      const startX = wall.start[0];
      const startZ = wall.start[1];
      const endX = wall.end[0];
      const endZ = wall.end[1];

      const dx = endX - startX;
      const dz = endZ - startZ;
      const length = Math.sqrt(dx * dx + dz * dz);
      const rotationY = -Math.atan2(dz, dx);

      const { outer, middle, inner } = getWallLayers(state);
      const wallLz = (inner - outer) / 2;

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

      const wallYOffset = floor.level * heightPerFloor;

      // Helper to transform local coordinates [lx, ly, lz] to world space
      const toWorld = (lx: number, ly: number, lz: number): [number, number, number] => {
        const cosY = Math.cos(rotationY);
        const sinY = Math.sin(rotationY);
        const wx = startX + lx * cosY - lz * sinY;
        const wz = startZ - lx * sinY - lz * cosY;
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
        
        if ((isDoor || isOpening) && currentElevation < 0.05) {
          const xStart = obj.position - obj.width / 2;
          const xEnd = obj.position + obj.width / 2;
          cuts.push({ start: xStart, end: xEnd });
        }
      });

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
          position: toWorld((seg.start + seg.end) / 2, lumberThickness / 2, wallLz),
          rotation: [0, rotationY, 0],
          size: [segLen, lumberThickness, middle],
          floorId: floor.id,
          wallId: wall.id,
        });
      });

      // B. Top Plates (Double)
      const renderTopPlates = (x1: number, x2: number, y1: number, y2: number) => {
        const segLen = x2 - x1;
        const avgY = (y1 + y2) / 2;
        const slopeAngle = Math.atan2(y2 - y1, segLen);
        
        let plate1Len = segLen;
        let plate2Len = segLen;

        if (wall.id === 'wall-front' || wall.id === 'wall-back') {
          plate2Len = segLen - 2 * wall.thickness;
        } else if (wall.id === 'wall-left' || wall.id === 'wall-right') {
          plate2Len = segLen + 2 * wall.thickness;
        }

        // Double top plates
        members.push({
          id: `wall-top-plate-1-${floor.id}-${wall.id}-${x1.toFixed(2)}`,
          type: 'plate',
          position: toWorld((x1 + x2) / 2, avgY - lumberThickness / 2, wallLz),
          rotation: [0, rotationY, slopeAngle],
          size: [plate2Len, lumberThickness, middle],
          floorId: floor.id,
          wallId: wall.id,
        });
        members.push({
          id: `wall-top-plate-2-${floor.id}-${wall.id}-${x1.toFixed(2)}`,
          type: 'plate',
          position: toWorld((x1 + x2) / 2, avgY - lumberThickness * 1.5, wallLz),
          rotation: [0, rotationY, slopeAngle],
          size: [plate1Len, lumberThickness, middle],
          floorId: floor.id,
          wallId: wall.id,
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

      const startStudX = lumberThickness / 2;
      const endStudX = length - lumberThickness / 2;

      const cornersBacking: number[] = [];
      if (wall.id === 'wall-front' || wall.id === 'wall-back') {
        cornersBacking.push(wall.thickness - lumberThickness / 2);
        cornersBacking.push(length - wall.thickness + lumberThickness / 2);
      }

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

      const getWallHeightAtX = (x: number): number => {
        if (isTopFloor && isFlatRoof && (wall.id === 'wall-front' || wall.id === 'wall-back')) {
          return hLeft + (x / length) * (hRight - hLeft);
        }
        return wallBaseHeight;
      };

      const renderStud = (id: string, localX: number) => {
        const wHeight = getWallHeightAtX(localX);
        const studHeight = wHeight - lumberThickness * 3; // Subtract bottom plate (1) + double top plate (2)
        const studY = lumberThickness + studHeight / 2;
        members.push({
          id,
          type: 'stud',
          position: toWorld(localX, studY, wallLz),
          rotation: [0, rotationY, 0],
          size: [lumberThickness, studHeight, middle],
          floorId: floor.id,
          wallId: wall.id,
        });
      };

      // Place Californian Corner & End studs
      renderStud(`wall-stud-start-${floor.id}-${wall.id}`, startStudX);
      renderStud(`wall-stud-end-${floor.id}-${wall.id}`, endStudX);
      cornersBacking.forEach((bx, idx) => {
        renderStud(`wall-stud-corner-backing-${idx}-${floor.id}-${wall.id}`, bx);
      });

      // Place Standard spacing studs
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
        
        const doubleTopPlate = 0.08;
        const headerThickness = 0.14;
        const topClearance = doubleTopPlate + headerThickness;
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

        // 1. King Studs
        const kingLeftX = xStart - lumberThickness - lumberThickness / 2;
        const kingRightX = xEnd + lumberThickness + lumberThickness / 2;
        renderStud(`wall-stud-king-left-${floor.id}-${wall.id}-${obj.id}`, kingLeftX);
        renderStud(`wall-stud-king-right-${floor.id}-${wall.id}-${obj.id}`, kingRightX);

        // 2. Jack Studs
        const jackLeftX = xStart - lumberThickness / 2;
        const jackRightX = xEnd + lumberThickness / 2;
        const headerBottomY = yEnd;
        
        const jackLeftHeight = headerBottomY - lumberThickness;
        members.push({
          id: `wall-stud-jack-left-${floor.id}-${wall.id}-${obj.id}`,
          type: 'stud',
          position: toWorld(jackLeftX, lumberThickness + jackLeftHeight / 2, wallLz),
          rotation: [0, rotationY, 0],
          size: [lumberThickness, jackLeftHeight, middle],
          floorId: floor.id,
          wallId: wall.id,
        });

        const jackRightHeight = headerBottomY - lumberThickness;
        members.push({
          id: `wall-stud-jack-right-${floor.id}-${wall.id}-${obj.id}`,
          type: 'stud',
          position: toWorld(jackRightX, lumberThickness + jackRightHeight / 2, wallLz),
          rotation: [0, rotationY, 0],
          size: [lumberThickness, jackRightHeight, middle],
          floorId: floor.id,
          wallId: wall.id,
        });

        // 3. Header
        const headerWidth = obj.width + lumberThickness * 2;
        members.push({
          id: `wall-header-${floor.id}-${wall.id}-${obj.id}`,
          type: 'header',
          position: toWorld(obj.position, yEnd + headerThickness / 2, wallLz),
          rotation: [0, rotationY, 0],
          size: [headerWidth, headerThickness, middle],
          floorId: floor.id,
          wallId: wall.id,
        });

        // 4. Window Sill
        if (!isDoor && yStart >= 0.05) {
          members.push({
            id: `wall-sill-${floor.id}-${wall.id}-${obj.id}`,
            type: 'sill',
            position: toWorld(obj.position, yStart - lumberThickness / 2, wallLz),
            rotation: [0, rotationY, 0],
            size: [obj.width, lumberThickness, middle],
            floorId: floor.id,
            wallId: wall.id,
          });

          // Under Sill Cripples
          const underSillSpacing = 0.4;
          const underSillStuds = Math.floor(obj.width / underSillSpacing) + 1;
          for (let i = 0; i < underSillStuds; i++) {
            const cx = xStart + (i / Math.max(1, underSillStuds - 1)) * obj.width;
            const crippleHeight = yStart - lumberThickness * 2;
            if (crippleHeight > 0.05) {
              members.push({
                id: `wall-cripple-under-${i}-${floor.id}-${wall.id}-${obj.id}`,
                type: 'stud',
                position: toWorld(cx, lumberThickness + crippleHeight / 2, wallLz),
                rotation: [0, rotationY, 0],
                size: [lumberThickness, crippleHeight, middle],
                floorId: floor.id,
                wallId: wall.id,
              });
            }
          }
        }

        // 5. Cripple Studs above the header
        const headerTopY = yEnd + headerThickness;
        const wallTopYAtObj = getWallHeightAtX(obj.position);
        const crippleAboveHeight = (wallTopYAtObj - lumberThickness * 2) - headerTopY;

        if (crippleAboveHeight > 0.05) {
          const aboveHeaderSpacing = 0.4;
          const aboveHeaderStuds = Math.floor(obj.width / aboveHeaderSpacing) + 1;
          for (let i = 0; i < aboveHeaderStuds; i++) {
            const cx = xStart + (i / Math.max(1, aboveHeaderStuds - 1)) * obj.width;
            members.push({
              id: `wall-cripple-above-${i}-${floor.id}-${wall.id}-${obj.id}`,
              type: 'stud',
              position: toWorld(cx, headerTopY + crippleAboveHeight / 2, wallLz),
              rotation: [0, rotationY, 0],
              size: [lumberThickness, crippleAboveHeight, middle],
              floorId: floor.id,
              wallId: wall.id,
            });
          }
        }
      });

      // D. Staggered Wall blocking (Noggings)
      if (state.structuralConfig?.wallBlocking) {
        const studXCoords: number[] = [];
        studXCoords.push(lumberThickness / 2);
        studXCoords.push(length - lumberThickness / 2);
        cornersBacking.forEach(bx => studXCoords.push(bx));
        studLocations.forEach(sx => {
          if (!isInsideOpening(sx)) studXCoords.push(sx);
        });
        wall.subObjects.forEach(obj => {
          const xStart = obj.position - obj.width / 2;
          const xEnd = obj.position + obj.width / 2;
          const kingLeftX = xStart - lumberThickness - lumberThickness / 2;
          const kingRightX = xEnd + lumberThickness + lumberThickness / 2;
          const jackLeftX = xStart - lumberThickness / 2;
          const jackRightX = xEnd + lumberThickness / 2;
          studXCoords.push(kingLeftX);
          studXCoords.push(kingRightX);
          studXCoords.push(jackLeftX);
          studXCoords.push(jackRightX);
        });

        const sortedX = Array.from(new Set(studXCoords.map(x => Math.round(x * 1000) / 1000))).sort((a, b) => a - b);

        let bayIndex = 0;
        for (let j = 0; j < sortedX.length - 1; j++) {
          const x1 = sortedX[j];
          const x2 = sortedX[j + 1];
          const blockWidth = x2 - x1 - lumberThickness;
          
          if (blockWidth < 0.02) continue;

          const blockX = (x1 + x2) / 2;

          let insideObj = false;
          wall.subObjects.forEach((obj) => {
            const xStart = obj.position - obj.width / 2;
            const xEnd = obj.position + obj.width / 2;
            if (blockX > xStart - 0.01 && blockX < xEnd + 0.01) {
              insideObj = true;
            }
          });
          if (insideObj) continue;

          const wHeight = getWallHeightAtX(blockX);
          const studHeight = wHeight - lumberThickness * 3;
          const midHeight = lumberThickness + studHeight / 2;

          const blockY = midHeight + (bayIndex % 2 === 0 ? -0.02 : 0.02);
          bayIndex++;

          members.push({
            id: `wall-blocking-${floor.id}-${wall.id}-${j}`,
            type: 'plate',
            position: toWorld(blockX, blockY, wallLz),
            rotation: [0, rotationY, 0],
            size: [blockWidth, lumberThickness, middle],
            floorId: floor.id,
            wallId: wall.id,
          });
        }
      }
    });

    const wallYOffset = floor.level * heightPerFloor;
      
    // Internal Walls loop
    (floor.internalWalls || []).forEach((wall) => {
      const startX = wall.start[0];
      const startZ = wall.start[1];
      const endX = wall.end[0];
      const endZ = wall.end[1];

      const dx = endX - startX;
      const dz = endZ - startZ;
      const length = Math.sqrt(dx * dx + dz * dz);
      if (length < 0.05) return;
      const rotationY = -Math.atan2(dz, dx);

      const lumberThickness = wall.timberSize.thickness;
      const middle = wall.timberSize.width;
      const wallLz = 0;

      const joistHeight = 0.14;
      const baseHeight = isTopFloor ? heightPerFloor : heightPerFloor - joistHeight;
      const wallBaseHeight = baseHeight;

      const toWorld = (lx: number, ly: number, lz: number): [number, number, number] => {
        const cosY = Math.cos(rotationY);
        const sinY = Math.sin(rotationY);
        const wx = startX + lx * cosY - lz * sinY;
        const wz = startZ - lx * sinY - lz * cosY;
        const wy = wallYOffset + ly;
        return [wx, wy, wz];
      };

      // A. Bottom Plate
      const cuts: { start: number; end: number }[] = [];
      wall.subObjects.forEach((obj) => {
        const isDoor = obj.type === 'door';
        const isOpening = obj.type === 'opening';
        const defaultElevation = isDoor ? 0 : (isOpening ? 0 : 0.9);
        const currentElevation = obj.elevation !== undefined ? obj.elevation : defaultElevation;
        
        if ((isDoor || isOpening) && currentElevation < 0.05) {
          const xStart = obj.position - obj.width / 2;
          const xEnd = obj.position + obj.width / 2;
          cuts.push({ start: xStart, end: xEnd });
        }
      });

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
          position: toWorld((seg.start + seg.end) / 2, lumberThickness / 2, wallLz),
          rotation: [0, rotationY, 0],
          size: [segLen, lumberThickness, middle],
          floorId: floor.id,
          wallId: wall.id,
        });
      });

      // B. Top Plates (Double)
      const renderTopPlates = (x1: number, x2: number, y1: number, y2: number) => {
        const segLen = x2 - x1;
        const avgY = (y1 + y2) / 2;
        const slopeAngle = Math.atan2(y2 - y1, segLen);
        
        members.push({
          id: `wall-top-plate-1-${floor.id}-${wall.id}-${x1.toFixed(2)}`,
          type: 'plate',
          position: toWorld((x1 + x2) / 2, avgY - lumberThickness / 2, wallLz),
          rotation: [0, rotationY, slopeAngle],
          size: [segLen, lumberThickness, middle],
          floorId: floor.id,
          wallId: wall.id,
        });
        members.push({
          id: `wall-top-plate-2-${floor.id}-${wall.id}-${x1.toFixed(2)}`,
          type: 'plate',
          position: toWorld((x1 + x2) / 2, avgY - lumberThickness * 1.5, wallLz),
          rotation: [0, rotationY, slopeAngle],
          size: [segLen, lumberThickness, middle],
          floorId: floor.id,
          wallId: wall.id,
        });
      };
      renderTopPlates(0, length, wallBaseHeight, wallBaseHeight);

      // C. Studs
      const studSpacing = 0.6;
      const studCount = Math.floor(length / studSpacing) + 1;
      const studLocations: number[] = [];

      for (let i = 0; i < studCount; i++) {
        const x = i * studSpacing;
        if (x > 0.05 && x < length - 0.05) {
          studLocations.push(x);
        }
      }

      const startStudX = lumberThickness / 2;
      const endStudX = length - lumberThickness / 2;

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

      const renderStud = (id: string, localX: number) => {
        const studHeight = wallBaseHeight - lumberThickness * 3;
        const studY = lumberThickness + studHeight / 2;
        members.push({
          id,
          type: 'stud',
          position: toWorld(localX, studY, wallLz),
          rotation: [0, rotationY, 0],
          size: [lumberThickness, studHeight, middle],
          floorId: floor.id,
          wallId: wall.id,
        });
      };

      renderStud(`wall-stud-start-${floor.id}-${wall.id}`, startStudX);
      renderStud(`wall-stud-end-${floor.id}-${wall.id}`, endStudX);

      studLocations.forEach((sx, idx) => {
        if (!isInsideOpening(sx)) {
          renderStud(`wall-stud-spaced-${idx}-${floor.id}-${wall.id}`, sx);
        }
      });

      // Openings framing
      wall.subObjects.forEach((rawObj) => {
        const isDoor = rawObj.type === 'door';
        const isWindow = rawObj.type === 'window';
        const defaultElevation = isDoor ? 0 : (isWindow ? 0.9 : 0);
        const currentElevation = rawObj.elevation !== undefined ? rawObj.elevation : defaultElevation;
        
        const doubleTopPlate = lumberThickness * 2;
        const headerThickness = 0.14;
        const topClearance = doubleTopPlate + headerThickness;
        let clampedElevation = currentElevation;
        let clampedHeight = rawObj.height;

        if (isDoor) {
          clampedElevation = 0;
          clampedHeight = Math.max(0.1, Math.min(wallBaseHeight - topClearance, rawObj.height));
        } else if (isWindow) {
          const minElevation = lumberThickness;
          clampedHeight = Math.max(0.1, Math.min(wallBaseHeight - topClearance - minElevation, rawObj.height));
          clampedElevation = Math.max(minElevation, Math.min(wallBaseHeight - topClearance - clampedHeight, currentElevation));
        } else {
          if (currentElevation < 0.05) {
            clampedElevation = 0;
            clampedHeight = Math.max(0.1, Math.min(wallBaseHeight - topClearance, rawObj.height));
          } else {
            const minElevation = lumberThickness;
            clampedHeight = Math.max(0.1, Math.min(wallBaseHeight - topClearance - minElevation, rawObj.height));
            clampedElevation = Math.max(minElevation, Math.min(wallBaseHeight - topClearance - clampedHeight, currentElevation));
          }
        }

        const obj = { ...rawObj, height: clampedHeight, elevation: clampedElevation };
        const xStart = obj.position - obj.width / 2;
        const xEnd = obj.position + obj.width / 2;
        const yEnd = obj.elevation + obj.height;

        // King Studs
        const kingLeftX = xStart - lumberThickness - lumberThickness / 2;
        const kingRightX = xEnd + lumberThickness + lumberThickness / 2;
        renderStud(`wall-stud-king-left-${floor.id}-${wall.id}-${obj.id}`, kingLeftX);
        renderStud(`wall-stud-king-right-${floor.id}-${wall.id}-${obj.id}`, kingRightX);

        // Jack Studs
        const jackLeftX = xStart - lumberThickness / 2;
        const jackRightX = xEnd + lumberThickness / 2;
        const jackHeight = yEnd - lumberThickness;
        
        members.push({
          id: `wall-stud-jack-left-${floor.id}-${wall.id}-${obj.id}`,
          type: 'stud',
          position: toWorld(jackLeftX, lumberThickness + jackHeight / 2, wallLz),
          rotation: [0, rotationY, 0],
          size: [lumberThickness, jackHeight, middle],
          floorId: floor.id,
          wallId: wall.id,
        });
        members.push({
          id: `wall-stud-jack-right-${floor.id}-${wall.id}-${obj.id}`,
          type: 'stud',
          position: toWorld(jackRightX, lumberThickness + jackHeight / 2, wallLz),
          rotation: [0, rotationY, 0],
          size: [lumberThickness, jackHeight, middle],
          floorId: floor.id,
          wallId: wall.id,
        });

        // Header
        const headerWidth = obj.width + lumberThickness * 2;
        members.push({
          id: `wall-header-${floor.id}-${wall.id}-${obj.id}`,
          type: 'header',
          position: toWorld(obj.position, yEnd + headerThickness / 2, wallLz),
          rotation: [0, rotationY, 0],
          size: [headerWidth, headerThickness, middle],
          floorId: floor.id,
          wallId: wall.id,
        });

        // Sill
        if (!isDoor && obj.elevation >= 0.05) {
          members.push({
            id: `wall-sill-${floor.id}-${wall.id}-${obj.id}`,
            type: 'sill',
            position: toWorld(obj.position, obj.elevation - lumberThickness / 2, wallLz),
            rotation: [0, rotationY, 0],
            size: [obj.width, lumberThickness, middle],
            floorId: floor.id,
            wallId: wall.id,
          });

          // Under Sill Cripples
          const underSillSpacing = 0.4;
          const underSillStuds = Math.floor(obj.width / underSillSpacing) + 1;
          for (let i = 0; i < underSillStuds; i++) {
            const cx = xStart + (i / Math.max(1, underSillStuds - 1)) * obj.width;
            const crippleHeight = obj.elevation - lumberThickness * 2;
            if (crippleHeight > 0.05) {
              members.push({
                id: `wall-cripple-under-${i}-${floor.id}-${wall.id}-${obj.id}`,
                type: 'stud',
                position: toWorld(cx, lumberThickness + crippleHeight / 2, wallLz),
                rotation: [0, rotationY, 0],
                size: [lumberThickness, crippleHeight, middle],
                floorId: floor.id,
                wallId: wall.id,
              });
            }
          }
        }

        // Cripples above header
        const headerTopY = yEnd + headerThickness;
        const crippleAboveHeight = (wallBaseHeight - lumberThickness * 2) - headerTopY;
        if (crippleAboveHeight > 0.05) {
          const aboveHeaderSpacing = 0.4;
          const aboveHeaderStuds = Math.floor(obj.width / aboveHeaderSpacing) + 1;
          for (let i = 0; i < aboveHeaderStuds; i++) {
            const cx = xStart + (i / Math.max(1, aboveHeaderStuds - 1)) * obj.width;
            members.push({
              id: `wall-cripple-above-${i}-${floor.id}-${wall.id}-${obj.id}`,
              type: 'stud',
              position: toWorld(cx, headerTopY + crippleAboveHeight / 2, wallLz),
              rotation: [0, rotationY, 0],
              size: [lumberThickness, crippleAboveHeight, middle],
              floorId: floor.id,
              wallId: wall.id,
            });
          }
        }
      });

      // Staggered Blocking
      if (state.structuralConfig?.wallBlocking) {
        const studXCoords: number[] = [];
        studXCoords.push(lumberThickness / 2);
        studXCoords.push(length - lumberThickness / 2);
        studLocations.forEach(sx => {
          if (!isInsideOpening(sx)) studXCoords.push(sx);
        });
        wall.subObjects.forEach(obj => {
          const xStart = obj.position - obj.width / 2;
          const xEnd = obj.position + obj.width / 2;
          const kingLeftX = xStart - lumberThickness - lumberThickness / 2;
          const kingRightX = xEnd + lumberThickness + lumberThickness / 2;
          const jackLeftX = xStart - lumberThickness / 2;
          const jackRightX = xEnd + lumberThickness / 2;
          studXCoords.push(kingLeftX);
          studXCoords.push(kingRightX);
          studXCoords.push(jackLeftX);
          studXCoords.push(jackRightX);
        });

        const sortedX = Array.from(new Set(studXCoords.map(x => Math.round(x * 1000) / 1000))).sort((a, b) => a - b);
        let bayIndex = 0;
        for (let j = 0; j < sortedX.length - 1; j++) {
          const x1 = sortedX[j];
          const x2 = sortedX[j + 1];
          const blockWidth = x2 - x1 - lumberThickness;
          if (blockWidth < 0.02) continue;

          const blockX = (x1 + x2) / 2;

          let insideObj = false;
          wall.subObjects.forEach((obj) => {
            const xStart = obj.position - obj.width / 2;
            const xEnd = obj.position + obj.width / 2;
            if (blockX > xStart - 0.01 && blockX < xEnd + 0.01) {
              insideObj = true;
            }
          });
          if (insideObj) continue;

          const studHeight = wallBaseHeight - lumberThickness * 3;
          const midHeight = lumberThickness + studHeight / 2;
          const blockY = midHeight + (bayIndex % 2 === 0 ? -0.02 : 0.02);
          bayIndex++;

          members.push({
            id: `wall-blocking-${floor.id}-${wall.id}-${j}`,
            type: 'plate',
            position: toWorld(blockX, blockY, wallLz),
            rotation: [0, rotationY, 0],
            size: [blockWidth, lumberThickness, middle],
            floorId: floor.id,
            wallId: wall.id,
          });
        }
      }
    });
  });

  return members;
}
