import { useProjectStore } from '../../store';
import { DoubleSide, FrontSide, Shape } from 'three';
import { getMaterialProps } from './materialProps';

export default function RoofRenderer() {
  const dimensions = useProjectStore((state) => state.dimensions);
  const floors = useProjectStore((state) => state.floors);
  const roof = useProjectStore((state) => state.roof);
  const uiState = useProjectStore((state) => state.uiState);
  const wallLayers = useProjectStore((state) => state.wallLayers);
  const wallPreset = useProjectStore((state) => state.wallPreset);
  const topCover = useProjectStore((state) => state.topCover);
  const roofCovers = useProjectStore((state) => state.roofCovers) || {
    soffitMaterial: 'decking',
    soffitThickness: 0.015,
    soffitWidth: 0.12,
    fasciaMaterial: 'wood_board',
    fasciaThickness: 0.02,
    fasciaHeight: 0.18,
    gableMaterial: 'wood_board',
    gableThickness: 0.02,
    gableHeight: 0.18,
  };
  const selectObject = useProjectStore((state) => state.selectObject);

  const { width, depth, heightPerFloor } = dimensions;
  const totalFloors = floors.length;
  const topElevation = totalFloors * heightPerFloor;

  if (uiState.seeThroughMode === 'studsOnly') return null;

  const { overhang, inclination, thickness, type } = roof;
  const angleRad = (inclination * Math.PI) / 180;
  const wallThickness = floors[0]?.walls[0]?.thickness || 0.15;
  const gableThickness = roofCovers.gableMaterial !== 'none' ? roofCovers.gableThickness : 0;
  const roofDepth = depth + overhang * 2 + gableThickness * 2;

  // Slope Geometry details
  let slopeLength = 0;
  const halfGableWidth = width / 2 + wallThickness * 0.5;
  const halfRoofWidth = halfGableWidth + overhang;

  if (type === 'flat') {
    slopeLength = (width + wallThickness) / Math.cos(angleRad) + overhang * 2;
  } else {
    slopeLength = halfRoofWidth / Math.cos(angleRad);
  }

  const matProps = getMaterialProps(uiState.selectedId, uiState.seeThroughMode, 'roof', '#a05040');
  const mode = uiState.seeThroughMode;

  // Helper: Renders soffit ceiling boards under the overhang
  const renderSoffit = (lengthZ: number, lengthX: number) => {
    if (roofCovers.soffitMaterial === 'none') return null;
    const boardW = roofCovers.soffitWidth || 0.12;
    const boardT = roofCovers.soffitThickness || 0.015;
    const color = '#8b5a2b';

    const numBoards = Math.ceil(lengthX / boardW);
    const boards: React.ReactNode[] = [];

    for (let i = 0; i < numBoards; i++) {
      const bx = i * boardW;
      const w = Math.min(boardW, lengthX - bx) - 0.002;
      if (w <= 0.01) continue;

      boards.push(
        <mesh key={`soffit-${i}`} position={[bx + w / 2, -boardT / 2, 0]}>
          <boxGeometry args={[w, boardT, lengthZ]} />
          <meshStandardMaterial color={color} roughness={0.7} />
        </mesh>
      );
    }
    return <group>{boards}</group>;
  };

  // Helper: Renders sheathing panels (OSB sheets) laid horizontally across rafters
  const renderSheathingSlope = (slopeW: number, slopeL: number) => {
    if (topCover.sheetingMaterial === 'none') return null;
    const sheetW = 2.50; // length along Z
    const sheetH = topCover.sheetingMaterial === 'osb_625' ? 0.625 : 1.25; // width along slope X
    const sheetT = topCover.sheetingThickness || 0.015;
    const gap = 0.003;

    const numRows = Math.ceil(slopeL / (sheetH + gap));
    const panels: React.ReactNode[] = [];

    for (let r = 0; r < numRows; r++) {
      const px = r * (sheetH + gap);
      if (px >= slopeL - 0.01) break;
      const ph = Math.min(sheetH, slopeL - px) - gap;

      const zOffset = (r % 2) * (sheetW / 2);
      let pz = -slopeW / 2 - zOffset;
      let panelIdx = 0;

      while (pz < slopeW / 2) {
        const zStart = Math.max(-slopeW / 2, pz);
        const zEnd = Math.min(slopeW / 2, pz + sheetW);
        const pw = zEnd - zStart - gap;

        if (pw > 0.05 && ph > 0.05) {
          panels.push(
            <mesh
              key={`sheathing-${r}-${panelIdx}`}
              position={[px + ph / 2, 0.14 + sheetT / 2, (zStart + zEnd) / 2]}
            >
              <boxGeometry args={[ph, sheetT, pw]} />
              <meshStandardMaterial color="#bfa37a" roughness={0.8} />
            </mesh>
          );
        }
        pz += sheetW;
        panelIdx++;
      }
    }
    return <group>{panels}</group>;
  };

  // Helper: Renders repeating shingles/tiles with overlapping slope tilt
  const renderShinglesSlope = (slopeW: number, slopeL: number) => {
    const sW = topCover.width;
    const sH = topCover.height;
    const expW = topCover.visibleWidth || sW;
    const expH = topCover.visibleHeight || sH;

    const numRows = Math.ceil(slopeL / expH);
    const numCols = Math.ceil(slopeW / expW);
    const shingles: React.ReactNode[] = [];

    const color = topCover.material === 'shingles' ? '#3e3e3e' : (topCover.material === 'tiles' ? '#b24a2c' : '#7f8c8d');
    const sheetT = topCover.sheetingMaterial !== 'none' ? topCover.sheetingThickness : 0;
    const yOffset = 0.14 + sheetT + 0.005; // directly on top of sheathing

    for (let r = 0; r < numRows; r++) {
      const rx = slopeL - r * expH - expH / 2; // start from eave going up to ridge
      const tiltAngle = topCover.material === 'plates' ? 0 : -0.04; // slant shingle to simulate overlap

      for (let c = 0; c < numCols; c++) {
        const rz = -slopeW / 2 + c * expW + expW / 2;

        shingles.push(
          <mesh
            key={`shingle-${r}-${c}`}
            position={[rx, yOffset + r * 0.002, rz]}
            rotation={[0, 0, tiltAngle]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[sH, 0.005, expW - 0.002]} />
            <meshStandardMaterial color={color} roughness={0.6} metalness={topCover.material === 'plates' ? 0.8 : 0.1} />
          </mesh>
        );
      }
    }
    return <group>{shingles}</group>;
  };

  // Helper: creates a sloped parallelogram shape with plumb-cut vertical ends in local coordinates
  const createSlopeShape = (L: number, H: number) => {
    const shape = new Shape();
    const tanTheta = Math.tan(angleRad);
    
    // Bottom-left corner: y = 0
    shape.moveTo(0, 0);
    // Bottom-right corner: y = 0
    shape.lineTo(L, 0);
    // Top-right corner: y = H
    shape.lineTo(L - H * tanTheta, H);
    // Top-left corner: y = H
    shape.lineTo(-H * tanTheta, H);
    shape.closePath();
    return shape;
  };

  // Helper: Renders sloped trims (Gable Wind Board) with vertical plumb-cut ends
  const renderGableTrim = (slopeL: number, zPos: number, isLeft: boolean) => {
    if (roofCovers.gableMaterial === 'none') return null;
    const boardH = roofCovers.gableHeight || 0.18;
    const boardT = roofCovers.gableThickness || 0.02;
    const color = '#5c3a21';

    const trimShape = createSlopeShape(slopeL, boardH);

    return (
      <mesh position={[0, 0.14 - boardH + 0.04, zPos - boardT / 2]} rotation={[0, 0, 0]}>
        <extrudeGeometry args={[trimShape, { depth: boardT, bevelEnabled: false }]} />
        <meshStandardMaterial color={color} roughness={0.7} />
      </mesh>
    );
  };

  // Render method for a single slope group
  const renderSlopeAssembly = (posX: number, posY: number, rotation: [number, number, number], isLeft: boolean) => {
    const isSelected = uiState.selectedId === 'roof';
    const activeColor = isSelected ? '#ff8c00' : matProps.color;

    return (
      <group position={[posX, posY, 0]} rotation={rotation}>
        {mode === 'sheathing' ? (
          <>
            {/* 1. Rafter Soffit (Bottom Cover) */}
            {roofCovers.soffitMaterial !== 'none' && (
              <group position={[slopeLength - overhang, 0, 0]}>
                {renderSoffit(roofDepth - gableThickness * 2, overhang)}
              </group>
            )}

            {/* 2. Roof Sheathing */}
            {renderSheathingSlope(roofDepth - gableThickness * 2, slopeLength)}

            {/* 3. Roof Covering (Shingles/Tiles/Plates) */}
            {renderShinglesSlope(roofDepth - gableThickness * 2, slopeLength)}

            {/* 4. Gable Wind Boards */}
            {roofCovers.gableMaterial !== 'none' && (
              <>
                {renderGableTrim(slopeLength, roofDepth / 2 - gableThickness / 2, isLeft)}
                {renderGableTrim(slopeLength, -roofDepth / 2 + gableThickness / 2, isLeft)}
              </>
            )}
          </>
        ) : (
          /* Solid or See-through Mode: Render full slope block */
          <group>
            {(() => {
              const H = 0.14 + thickness;
              const shape = createSlopeShape(slopeLength, H);
              return (
                <mesh
                  position={[0, 0, -roofDepth / 2]}
                  castShadow
                  receiveShadow
                  onClick={(e) => {
                    e.stopPropagation();
                    selectObject('roof', 'roof');
                  }}
                >
                  <extrudeGeometry args={[shape, { depth: roofDepth, bevelEnabled: false }]} />
                  <meshStandardMaterial
                    {...matProps}
                    color={activeColor}
                    roughness={0.5}
                  />
                </mesh>
              );
            })()}
            
            {/* Show detailed shingles on top of Solid mode for extra premium look */}
            {mode === 'solid' && renderShinglesSlope(roofDepth - gableThickness * 2, slopeLength)}
          </group>
        )}
      </group>
    );
  };

  if (type === 'flat') {
    const posX = - (slopeLength / 2) * Math.cos(angleRad);
    const posY = topElevation + (width / 2 + wallThickness / 2) * Math.tan(angleRad) + (slopeLength / 2) * Math.sin(angleRad);

    const halfFlatRoofWidth = (slopeLength / 2) * Math.cos(angleRad);
    const rafterHeight = 0.14;
    const Y_rafter_top_right = posY - halfFlatRoofWidth * Math.tan(angleRad) + (rafterHeight / 2) / Math.cos(angleRad);
    const Y_rafter_top_left = posY + halfFlatRoofWidth * Math.tan(angleRad) + (rafterHeight / 2) / Math.cos(angleRad);

    return (
      <group onClick={(e) => { e.stopPropagation(); selectObject('roof', 'roof'); }}>
        {renderSlopeAssembly(posX, posY, [0, 0, -angleRad], false)}

        {/* Eaves Fascia Boards (Vertical Cladding) in sheathing mode */}
        {mode === 'sheathing' && roofCovers.fasciaMaterial !== 'none' && (
          <>
            {/* Low End (Right) Fascia */}
            <mesh
              position={[halfFlatRoofWidth + roofCovers.fasciaThickness / 2, Y_rafter_top_right - roofCovers.fasciaHeight / 2, 0]}
              rotation={[0, 0, 0]}
            >
              <boxGeometry args={[roofCovers.fasciaThickness, roofCovers.fasciaHeight, roofDepth]} />
              <meshStandardMaterial color="#5c3a21" roughness={0.7} />
            </mesh>

            {/* High End (Left) Fascia */}
            <mesh
              position={[-halfFlatRoofWidth - roofCovers.fasciaThickness / 2, Y_rafter_top_left - roofCovers.fasciaHeight / 2, 0]}
              rotation={[0, 0, 0]}
            >
              <boxGeometry args={[roofCovers.fasciaThickness, roofCovers.fasciaHeight, roofDepth]} />
              <meshStandardMaterial color="#5c3a21" roughness={0.7} />
            </mesh>
          </>
        )}
      </group>
    );
  } else {
    // Gable Shape for front/back triangle gables
    const createGableShape = (xOffset: number) => {
      const shape = new Shape();
      const w = halfGableWidth - xOffset;
      shape.moveTo(-w, 0);
      shape.lineTo(0, w * Math.tan(angleRad));
      shape.lineTo(w, 0);
      shape.closePath();
      return shape;
    };

    const Y_rafter_top_eave = topElevation - overhang * Math.tan(angleRad) + 0.14 / Math.cos(angleRad);

    return (
      <group
        onClick={(e) => {
          e.stopPropagation();
          selectObject('roof', 'roof');
        }}
      >
        {/* Right slope assembly */}
        {renderSlopeAssembly(0, topElevation + halfGableWidth * Math.tan(angleRad), [0, 0, -angleRad], false)}

        {/* Left slope assembly */}
        {renderSlopeAssembly(0, topElevation + halfGableWidth * Math.tan(angleRad), [0, Math.PI, -angleRad], true)}

        {/* Eaves Fascia Boards (Vertical Cladding) in sheathing mode */}
        {mode === 'sheathing' && roofCovers.fasciaMaterial !== 'none' && (
          <>
            {/* Right Eave Fascia */}
            <mesh
              position={[halfRoofWidth + roofCovers.fasciaThickness / 2, Y_rafter_top_eave - roofCovers.fasciaHeight / 2, 0]}
              rotation={[0, 0, 0]}
            >
              <boxGeometry args={[roofCovers.fasciaThickness, roofCovers.fasciaHeight, roofDepth]} />
              <meshStandardMaterial color="#5c3a21" roughness={0.7} />
            </mesh>

            {/* Left Eave Fascia */}
            <mesh
              position={[-halfRoofWidth - roofCovers.fasciaThickness / 2, Y_rafter_top_eave - roofCovers.fasciaHeight / 2, 0]}
              rotation={[0, 0, 0]}
            >
              <boxGeometry args={[roofCovers.fasciaThickness, roofCovers.fasciaHeight, roofDepth]} />
              <meshStandardMaterial color="#5c3a21" roughness={0.7} />
            </mesh>
          </>
        )}

        {/* Gable wall fillings */}
        {!matProps.wireframe && (
          <>
            {(() => {
              const { outer, middle, inner } = wallLayers;
              const T = outer + middle + inner;
              const isSelected = uiState.selectedId === 'roof';
              const layers = [
                { suffix: 'outer', zOffset: inner + middle, depth: outer, color: wallPreset === 'diffusion_closed' ? '#5c3a21' : '#8b5a2b', opacity: mode === 'seeThrough' ? 0.15 : 1.0, xOffset: outer },
                { suffix: 'middle', zOffset: inner, depth: wallPreset === 'diffusion_closed' ? 0 : middle, color: '#ded29e', opacity: mode === 'seeThrough' ? 0.25 : 1.0, xOffset: outer },
                { suffix: 'inner', zOffset: 0, depth: inner, color: wallPreset === 'diffusion_open' ? '#d2b48c' : '#e6e6e6', opacity: mode === 'seeThrough' ? 0.5 : 1.0, xOffset: outer + middle }
              ];
              return (
                <group position={[0, topElevation, depth / 2 - T / 2]} rotation={[0, 0, 0]}>
                  {layers.filter(layer => layer.depth > 0.001).map((layer) => {
                    const shape = createGableShape(layer.xOffset);
                    return (
                      <mesh key={`front-gable-${layer.suffix}`} position={[0, 0, layer.zOffset]} castShadow receiveShadow>
                        <extrudeGeometry args={[shape, { depth: layer.depth, bevelEnabled: false }]} />
                        <meshStandardMaterial
                          color={isSelected ? '#ff8c00' : layer.color}
                          roughness={0.7}
                          transparent={mode === 'seeThrough'}
                          opacity={layer.opacity}
                          depthWrite={mode !== 'seeThrough'}
                          side={mode === 'seeThrough' ? DoubleSide : FrontSide}
                        />
                      </mesh>
                    );
                  })}
                </group>
              );
            })()}

            {(() => {
              const { outer, middle, inner } = wallLayers;
              const T = outer + middle + inner;
              const isSelected = uiState.selectedId === 'roof';
              const layers = [
                { suffix: 'outer', zOffset: inner + middle, depth: outer, color: wallPreset === 'diffusion_closed' ? '#5c3a21' : '#8b5a2b', opacity: mode === 'seeThrough' ? 0.15 : 1.0, xOffset: outer },
                { suffix: 'middle', zOffset: inner, depth: wallPreset === 'diffusion_closed' ? 0 : middle, color: '#ded29e', opacity: mode === 'seeThrough' ? 0.25 : 1.0, xOffset: outer },
                { suffix: 'inner', zOffset: 0, depth: inner, color: wallPreset === 'diffusion_open' ? '#d2b48c' : '#e6e6e6', opacity: mode === 'seeThrough' ? 0.5 : 1.0, xOffset: outer + middle }
              ];
              return (
                <group position={[0, topElevation, -depth / 2 + T / 2]} rotation={[0, Math.PI, 0]}>
                  {layers.filter(layer => layer.depth > 0.001).map((layer) => {
                    const shape = createGableShape(layer.xOffset);
                    return (
                      <mesh key={`back-gable-${layer.suffix}`} position={[0, 0, layer.zOffset]} castShadow receiveShadow>
                        <extrudeGeometry args={[shape, { depth: layer.depth, bevelEnabled: false }]} />
                        <meshStandardMaterial
                          color={isSelected ? '#ff8c00' : layer.color}
                          roughness={0.7}
                          transparent={mode === 'seeThrough'}
                          opacity={layer.opacity}
                          depthWrite={mode !== 'seeThrough'}
                          side={mode === 'seeThrough' ? DoubleSide : FrontSide}
                        />
                      </mesh>
                    );
                  })}
                </group>
              );
            })()}
          </>
        )}
      </group>
    );
  }
}
