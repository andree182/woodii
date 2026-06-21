import { FramingMember } from '../../../utils/framingEngine';

export const getWallMemberDetails = (member: FramingMember, wall: any) => {
  const [startX, startZ] = wall.start;
  const [endX, endZ] = wall.end;
  const dx = endX - startX;
  const dz = endZ - startZ;
  const wallLength = Math.sqrt(dx * dx + dz * dz);
  
  const unitX = dx / (wallLength || 1);
  const unitZ = dz / (wallLength || 1);

  const [px, , pz] = member.position;
  // Project member coordinates onto wall direction vector to get local offset
  const localX = (px - startX) * unitX + (pz - startZ) * unitZ;

  // Group label/role mapping
  let role = 'Stud';
  if (member.id.includes('bottom-plate')) role = 'Bottom Plate';
  else if (member.id.includes('top-plate-1')) role = 'Top Plate (Lower)';
  else if (member.id.includes('top-plate-2')) role = 'Top Plate (Upper)';
  else if (member.id.includes('stud-start') || member.id.includes('stud-end')) role = 'Corner Stud';
  else if (member.id.includes('corner-backing')) role = 'Corner Backing Stud';
  else if (member.id.includes('spaced')) role = 'Common Stud';
  else if (member.id.includes('king')) role = 'King Stud';
  else if (member.id.includes('jack')) role = 'Jack Stud';
  else if (member.id.includes('header')) role = 'Header';
  else if (member.id.includes('sill')) role = 'Window Sill';
  else if (member.id.includes('cripple-under')) role = 'Under-Sill Cripple';
  else if (member.id.includes('cripple-above')) role = 'Over-Header Cripple';

  const [w, h, d] = member.size;
  const len = Math.max(w, h, d);

  // Determine nominal size
  const sortedDims = [...member.size].sort((a, b) => a - b);
  const midDim = sortedDims[1];
  const nominal = midDim > 0.1 || member.type === 'header' ? '2x6 (40x140mm)' : '2x4 (40x90mm)';

  const isVertical = member.type === 'stud';

  return {
    nominal,
    role,
    len,
    localX,
    isVertical,
  };
};

export const generateWallSVGString = (
  wall: any,
  wallMembers: FramingMember[],
  heightPerFloor: number,
  getCutIdentifier: (nominal: string, length: number) => string,
  floorLevel: number,
  isPrintVariant: boolean,
  svgId: string
) => {
  const dx = wall.end[0] - wall.start[0];
  const dz = wall.end[1] - wall.start[1];
  const wallLength = Math.sqrt(dx * dx + dz * dz);
  const margin = 0.35;
  const svgWidth = wallLength + margin * 2;
  const svgHeight = heightPerFloor + margin * 2;

  // Decide colors based on print variant
  const bgColor = isPrintVariant ? '#ffffff' : '#151515';
  const gridLineColor = isPrintVariant ? '#f0f0f0' : '#222';
  const outlineStroke = isPrintVariant ? '#555' : '#333';
  const labelFillColor = isPrintVariant ? 'rgba(235, 140, 0, 0.8)' : 'rgba(255, 140, 0, 0.6)';
  const dimColor = isPrintVariant ? '#333' : '#888';

  let openingsStr = '';
  (wall.subObjects || []).forEach((obj: any) => {
    const w = obj.width;
    const h = obj.height;
    const x = obj.position - w / 2;
    const y = heightPerFloor - (obj.elevation !== undefined ? obj.elevation : (obj.type === 'window' ? 0.9 : 0)) - h;
    openingsStr += `
      <g>
        <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="rgba(255, 140, 0, 0.04)" stroke="rgba(255, 140, 0, 0.25)" stroke-width="0.012" stroke-dasharray="0.04, 0.02" />
        <text x="${obj.position}" y="${y + h / 2}" font-size="0.09" fill="${labelFillColor}" font-weight="bold" text-anchor="middle" dominant-baseline="middle" style="font-family: sans-serif; pointer-events: none; user-select: none;">${obj.type.toUpperCase()}</text>
      </g>
    `;
  });

  let membersStr = '';
  wallMembers.forEach((m) => {
    const details = getWallMemberDetails(m, wall);
    const [, py] = m.position;
    const localY = py - floorLevel * heightPerFloor;
    
    let x = 0;
    let y = 0;
    let w = 0;
    let h = 0;

    const isVertical = details.isVertical;
    const [mW, mH, mD] = m.size;

    if (isVertical) {
      const thickness = Math.min(mW, mD);
      w = thickness;
      h = details.len;
      x = details.localX - w / 2;
      y = heightPerFloor - localY - h / 2;
    } else {
      w = details.len;
      h = mH;
      x = details.localX - w / 2;
      y = heightPerFloor - localY - h / 2;
    }

    const idNum = getCutIdentifier(details.nominal, details.len);

    let fillColor = isPrintVariant ? '#fdf6eb' : '#d2b48c'; // default tan wood
    let strokeColor = isPrintVariant ? '#c5b095' : '#b58c54';
    if (details.role.includes('Plate')) {
      fillColor = isPrintVariant ? '#d2b48c' : '#b58c54'; // darker wood for plates
      strokeColor = isPrintVariant ? '#b58c54' : '#94703d';
    } else if (details.role.includes('Corner')) {
      fillColor = isPrintVariant ? '#c5a072' : '#c5a072';
      strokeColor = isPrintVariant ? '#a38053' : '#a38053';
    } else if (details.role.includes('Header') || details.role.includes('Sill')) {
      fillColor = isPrintVariant ? '#a28860' : '#a28860';
      strokeColor = isPrintVariant ? '#7f6640' : '#7f6640';
    } else if (details.role.includes('Blocking') || m.id.includes('blocking') || m.id.includes('nogging')) {
      fillColor = isPrintVariant ? '#caa376' : '#caa376';
      strokeColor = isPrintVariant ? '#a88359' : '#a88359';
    }

    let textStr = '';
    if (idNum) {
      const rotStr = isVertical && h > 0.4 ? `transform="rotate(-90, ${x + w / 2}, ${y + h / 2})"` : '';
      const textFill = isPrintVariant ? '#df7300' : '#ff8c00';
      const strokeVal = isPrintVariant ? '#ffffff' : '#151515';
      textStr = `<text x="${x + w / 2}" y="${y + h / 2}" font-size="${isVertical ? '0.08' : '0.07'}" fill="${textFill}" font-weight="900" text-anchor="middle" dominant-baseline="middle" paint-order="stroke fill" stroke="${strokeVal}" stroke-width="0.015" ${rotStr} style="font-family: monospace; pointer-events: none; user-select: none;">${idNum}</text>`;
    }

    membersStr += `
      <g>
        <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="0.008" rx="0.005" ry="0.005" />
        ${textStr}
      </g>
    `;
  });

  // Find all vertical members and get their unique localX positions, plus wall start and end
  const verticalXs: number[] = [0];
  wallMembers.forEach((m) => {
    const details = getWallMemberDetails(m, wall);
    if (details.isVertical) {
      const roundedX = Math.round(details.localX * 1000) / 1000;
      if (!verticalXs.includes(roundedX)) {
        verticalXs.push(roundedX);
      }
    }
  });

  const roundedLength = Math.round(wallLength * 1000) / 1000;
  if (!verticalXs.includes(roundedLength)) {
    verticalXs.push(roundedLength);
  }

  // Sort ascending
  verticalXs.sort((a, b) => a - b);

  let topDimensionChainStr = '';
  if (verticalXs.length > 1) {
    const chainY = -0.15; // horizontal line position above the wall
    
    // Draw the main horizontal line spanning from start to end
    topDimensionChainStr += `
      <line x1="${verticalXs[0]}" y1="${chainY}" x2="${verticalXs[verticalXs.length - 1]}" y2="${chainY}" stroke="${dimColor}" stroke-width="0.004" />
    `;
    
    // Draw vertical tick marks and text for each interval
    verticalXs.forEach((x, idx) => {
      // Tick mark
      topDimensionChainStr += `
        <line x1="${x}" y1="${chainY - 0.04}" x2="${x}" y2="${chainY + 0.04}" stroke="${dimColor}" stroke-width="0.004" />
      `;
      
      if (idx < verticalXs.length - 1) {
        const nextX = verticalXs[idx + 1];
        const dist = nextX - x;
        
        if (dist >= 0.05) { // Only show label for spacing >= 5cm to prevent overlapping
          const label = dist < 1.0 
            ? `${Math.round(dist * 100)} cm` 
            : `${dist.toFixed(2)} m`;
            
          const midX = (x + nextX) / 2;
          const labelFontSize = dist < 0.25 ? '0.05' : '0.065';
          
          topDimensionChainStr += `
            <g>
              <rect x="${midX - (dist < 0.25 ? 0.08 : 0.15)}" y="${chainY - 0.05}" width="${dist < 0.25 ? 0.16 : 0.3}" height="0.1" fill="${bgColor}" />
              <text x="${midX}" y="${chainY}" font-size="${labelFontSize}" fill="${dimColor}" font-weight="600" text-anchor="middle" dominant-baseline="middle" style="font-family: sans-serif; pointer-events: none; user-select: none;">${label}</text>
            </g>
          `;
        }
      }
    });
  }

  return `
    <svg id="${svgId}" width="100%" viewBox="${-margin} ${-margin} ${svgWidth} ${svgHeight}" style="background-color: ${bgColor}; border-radius: 4px; border: 1px solid ${isPrintVariant ? '#ccc' : '#222'}; display: block; max-height: 420px;">
      <defs>
        <pattern id="grid-${svgId}" width="0.2" height="0.2" patternUnits="userSpaceOnUse">
          <path d="M 0.2 0 L 0 0 0 0.2" fill="none" stroke="${gridLineColor}" stroke-width="0.005" />
        </pattern>
      </defs>
      <rect x="${-margin}" y="${-margin}" width="${svgWidth}" height="${svgHeight}" fill="url(#grid-${svgId})" />
      <rect x="0" y="0" width="${wallLength}" height="${heightPerFloor}" fill="rgba(0,0,0,0.01)" stroke="${outlineStroke}" stroke-width="0.01" />
      ${openingsStr}
      ${membersStr}
      ${topDimensionChainStr}
      <!-- Bottom Dimension -->
      <g>
        <line x1="0" y1="${heightPerFloor + 0.18}" x2="${wallLength}" y2="${heightPerFloor + 0.18}" stroke="${dimColor}" stroke-width="0.005" />
        <line x1="0" y1="${heightPerFloor + 0.12}" x2="0" y2="${heightPerFloor + 0.24}" stroke="${dimColor}" stroke-width="0.005" />
        <line x1="${wallLength}" y1="${heightPerFloor + 0.12}" x2="${wallLength}" y2="${heightPerFloor + 0.24}" stroke="${dimColor}" stroke-width="0.005" />
        <rect x="${wallLength / 2 - 0.25}" y="${heightPerFloor + 0.1}" width="0.5" height="0.16" fill="${bgColor}" />
        <text x="${wallLength / 2}" y="${heightPerFloor + 0.21}" font-size="0.09" fill="${dimColor}" font-weight="600" text-anchor="middle" dominant-baseline="middle" style="font-family: sans-serif;">${wallLength.toFixed(2)}m</text>
      </g>
      <!-- Left Dimension -->
      <g>
        <line x1="-0.18" y1="0" x2="-0.18" y2="${heightPerFloor}" stroke="${dimColor}" stroke-width="0.005" />
        <line x1="-0.24" y1="0" x2="-0.12" y2="0" stroke="${dimColor}" stroke-width="0.005" />
        <line x1="-0.24" y1="${heightPerFloor}" x2="-0.12" y2="${heightPerFloor}" stroke="${dimColor}" stroke-width="0.005" />
        <rect x="-0.28" y="${heightPerFloor / 2 - 0.25}" width="0.2" height="0.5" fill="${bgColor}" />
        <text x="-0.2" y="${heightPerFloor / 2}" font-size="0.09" fill="${dimColor}" font-weight="600" text-anchor="middle" transform="rotate(-90, -0.2, ${heightPerFloor / 2})" style="font-family: sans-serif;">${heightPerFloor.toFixed(2)}m</text>
      </g>
    </svg>
  `;
};
