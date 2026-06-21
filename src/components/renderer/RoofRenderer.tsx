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
  const selectObject = useProjectStore((state) => state.selectObject);

  const { width, depth, heightPerFloor } = dimensions;
  const totalFloors = floors.length;
  const topElevation = totalFloors * heightPerFloor;

  if (uiState.seeThroughMode === 'studsOnly') return null;
  const matProps = getMaterialProps(uiState.selectedId, uiState.seeThroughMode, 'roof', '#a05040');
  const { overhang, inclination, thickness, type } = roof;
  const angleRad = (inclination * Math.PI) / 180;

  if (type === 'flat') {
    const wallThickness = floors[0]?.walls[0]?.thickness || 0.15;
    const roofWidth = (width + wallThickness) / Math.cos(angleRad) + overhang * 2;
    const roofDepth = depth + overhang * 2;
    const tVertical = thickness / Math.cos(angleRad);
    
    return (
      <mesh
        position={[0, topElevation + (width / 2 + wallThickness / 2) * Math.tan(angleRad) + tVertical * 0.5, 0]}
        rotation={[0, 0, -angleRad]}
        castShadow
        receiveShadow
        onClick={(e) => {
          e.stopPropagation();
          selectObject('roof', 'roof');
        }}
      >
        <boxGeometry args={[roofWidth, thickness, roofDepth]} />
        <meshStandardMaterial {...matProps} roughness={0.5} />
      </mesh>
    );
  } else {
    const wallThickness = floors[0]?.walls[0]?.thickness || 0.15;
    const halfGableWidth = width / 2 + wallThickness * 0.5;
    const halfRoofWidth = halfGableWidth + overhang;
    const tVertical = thickness / Math.cos(angleRad);
    
    const roofDepth = depth + overhang * 2;

    const rightSlopeShape = new Shape();
    rightSlopeShape.moveTo(0, topElevation + halfGableWidth * Math.tan(angleRad) + tVertical);
    rightSlopeShape.lineTo(0, topElevation + halfGableWidth * Math.tan(angleRad));
    rightSlopeShape.lineTo(halfRoofWidth, topElevation - overhang * Math.tan(angleRad));
    rightSlopeShape.lineTo(halfRoofWidth, topElevation - overhang * Math.tan(angleRad) + tVertical);
    rightSlopeShape.closePath();

    const leftSlopeShape = new Shape();
    leftSlopeShape.moveTo(0, topElevation + halfGableWidth * Math.tan(angleRad) + tVertical);
    leftSlopeShape.lineTo(0, topElevation + halfGableWidth * Math.tan(angleRad));
    leftSlopeShape.lineTo(-halfRoofWidth, topElevation - overhang * Math.tan(angleRad));
    leftSlopeShape.lineTo(-halfRoofWidth, topElevation - overhang * Math.tan(angleRad) + tVertical);
    leftSlopeShape.closePath();

    const createGableShape = (xOffset: number) => {
      const shape = new Shape();
      const w = halfGableWidth - xOffset;
      shape.moveTo(-w, 0);
      shape.lineTo(0, w * Math.tan(angleRad));
      shape.lineTo(w, 0);
      shape.closePath();
      return shape;
    };

    return (
      <group
        onClick={(e) => {
          e.stopPropagation();
          selectObject('roof', 'roof');
        }}
      >
        <mesh castShadow receiveShadow position={[0, 0, -roofDepth / 2]}>
          <extrudeGeometry args={[rightSlopeShape, { depth: roofDepth, bevelEnabled: false }]} />
          <meshStandardMaterial {...matProps} roughness={0.5} />
        </mesh>

        <mesh castShadow receiveShadow position={[0, 0, -roofDepth / 2]}>
          <extrudeGeometry args={[leftSlopeShape, { depth: roofDepth, bevelEnabled: false }]} />
          <meshStandardMaterial {...matProps} roughness={0.5} />
        </mesh>

        {!matProps.wireframe && (
          <>
            {(() => {
              const { outer, middle, inner } = wallLayers;
              const T = outer + middle + inner;
              const isSelected = uiState.selectedId === 'roof';
              const mode = uiState.seeThroughMode;
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
              const mode = uiState.seeThroughMode;
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
