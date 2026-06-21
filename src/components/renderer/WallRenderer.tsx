import { Wall } from '../../types';
import { useProjectStore } from '../../store';
import { DoubleSide, FrontSide, Shape, Path, Plane, Vector3 } from 'three';
import { useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { getMaterialProps } from './materialProps';

export default function WallRenderer({ wall, level, floorId }: { wall: Wall; level: number; floorId: string }) {
  const { controls } = useThree();
  const dimensions = useProjectStore((state) => state.dimensions);
  const floors = useProjectStore((state) => state.floors);
  const roof = useProjectStore((state) => state.roof);
  const uiState = useProjectStore((state) => state.uiState);
  const wallLayers = useProjectStore((state) => state.wallLayers);
  const wallPreset = useProjectStore((state) => state.wallPreset);
  const selectObject = useProjectStore((state) => state.selectObject);
  const startDragging = useProjectStore((state) => state.startDragging);
  const stopDragging = useProjectStore((state) => state.stopDragging);
  const updateDragPosition = useProjectStore((state) => state.updateDragPosition);

  const { width, heightPerFloor } = dimensions;
  const totalFloors = floors.length;

  const startX = wall.start[0];
  const startZ = wall.start[1];
  const endX = wall.end[0];
  const endZ = wall.end[1];

  const dx = endX - startX;
  const dz = endZ - startZ;
  const length = Math.sqrt(dx * dx + dz * dz);
  const rotationY = -Math.atan2(dz, dx);

  const wallId = `${floorId}-${wall.id}`;
  const isBack = wall.id === 'wall-back';

  const isTopFloor = level === totalFloors - 1;
  const isFlatRoof = roof.type === 'flat';
  const angleRad = (roof.inclination * Math.PI) / 180;
  
  const joistHeight = 0.14;
  const baseHeight = isTopFloor ? heightPerFloor : heightPerFloor - joistHeight;
  let customHeight = baseHeight;

  if (isTopFloor && isFlatRoof) {
    if (wall.id === 'wall-left') {
      customHeight = baseHeight + width * Math.tan(angleRad);
    } else if (wall.id === 'wall-right') {
      customHeight = baseHeight;
    }
  }

  const hLeft = baseHeight + (width + wall.thickness) * Math.tan(angleRad);
  const hRight = baseHeight;

  const createWallShape = (xStartOffset: number, xEndOffset: number, yHeightOffset = 0) => {
    const shape = new Shape();
    shape.moveTo(xStartOffset, 0);
    shape.lineTo(length - xEndOffset, 0);

    const targetHeight = customHeight + yHeightOffset;

    if (isTopFloor && isFlatRoof && (wall.id === 'wall-front' || wall.id === 'wall-back')) {
      const slopeStartHeight = isBack ? hRight : hLeft;
      const slopeEndHeight = isBack ? hLeft : hRight;
      
      const yStart = slopeStartHeight + (xStartOffset / length) * (slopeEndHeight - slopeStartHeight) + yHeightOffset;
      const yEnd = slopeStartHeight + ((length - xEndOffset) / length) * (slopeEndHeight - slopeStartHeight) + yHeightOffset;

      shape.lineTo(length - xEndOffset, yEnd);
      shape.lineTo(xStartOffset, yStart);
    } else {
      shape.lineTo(length - xEndOffset, targetHeight);
      shape.lineTo(xStartOffset, targetHeight);
    }
    shape.closePath();

    wall.subObjects.forEach((obj) => {
      const isDoor = obj.type === 'door';
      const defaultElevation = isDoor ? 0 : (obj.type === 'window' ? 0.9 : 0);
      const currentElevation = obj.elevation !== undefined ? obj.elevation : defaultElevation;
      
      let localWallHeightAtObj = customHeight;
      if (isTopFloor && isFlatRoof && (wall.id === 'wall-front' || wall.id === 'wall-back')) {
        localWallHeightAtObj = isBack
          ? hRight + obj.position * Math.tan(angleRad)
          : hLeft - obj.position * Math.tan(angleRad);
      }
      const clampedElevation = Math.max(0, Math.min(Math.max(0, localWallHeightAtObj - obj.height), currentElevation));

      const objLeft = obj.position - obj.width / 2;
      const objRight = obj.position + obj.width / 2;
      if (objRight > xStartOffset && objLeft < length - xEndOffset) {
        const holePath = new Path();
        const xStart = Math.max(xStartOffset, objLeft);
        const xEnd = Math.min(length - xEndOffset, objRight);
        const yStart = clampedElevation;
        const yEnd = clampedElevation + obj.height;

        holePath.moveTo(xStart, yStart);
        holePath.lineTo(xStart, yEnd);
        holePath.lineTo(xEnd, yEnd);
        holePath.lineTo(xEnd, yStart);
        holePath.closePath();

        shape.holes.push(holePath);
      }
    });

    return shape;
  };

  const wallCenterX = (startX + endX) / 2;
  const wallCenterZ = (startZ + endZ) / 2;

  return (
    <group position={[startX, level * heightPerFloor, startZ]} rotation={[0, rotationY, 0]}>
      {uiState.seeThroughMode !== 'studsOnly' && (() => {
        const { outer, middle, inner } = wallLayers;
        const T = outer + middle + inner;
        const isSelected = uiState.selectedId === wallId;
        const mode = uiState.seeThroughMode;

        const isSideWall = wall.id === 'wall-left' || wall.id === 'wall-right';
        const layers = [
          {
            suffix: 'outer',
            zOffset: T / 2 - outer,
            depth: outer,
            color: wallPreset === 'diffusion_closed' ? '#5c3a21' : '#8b5a2b',
            opacity: mode === 'seeThrough' ? 0.15 : 1.0,
            xStartOffset: isSideWall ? -T : outer,
            xEndOffset: isSideWall ? -T : outer,
          },
          {
            suffix: 'middle',
            zOffset: -T / 2 + inner,
            depth: wallPreset === 'diffusion_closed' ? 0 : middle,
            color: '#ded29e',
            opacity: mode === 'seeThrough' ? 0.25 : 1.0,
            xStartOffset: isSideWall ? -inner : outer,
            xEndOffset: isSideWall ? -inner : outer,
          },
          {
            suffix: 'inner',
            zOffset: -T / 2,
            depth: inner,
            color: wallPreset === 'diffusion_open' ? '#d2b48c' : '#e6e6e6',
            opacity: mode === 'seeThrough' ? 0.5 : 1.0,
            xStartOffset: isSideWall ? -inner : inner + middle,
            xEndOffset: isSideWall ? -inner : inner + middle,
          }
        ];

        return (
          <group>
            {layers.filter(layer => layer.depth > 0.001).map((layer) => {
              const layerColor = isSelected ? '#ff8c00' : layer.color;
              const layerOpacity = isSelected ? Math.min(1.0, layer.opacity + 0.15) : layer.opacity;
              const isTransparent = mode === 'seeThrough';
              const shape = createWallShape(layer.xStartOffset, layer.xEndOffset, layer.suffix === 'outer' && !isTopFloor ? 0.14 : 0);

              return (
                <mesh
                  key={`${wallId}-${layer.suffix}`}
                  position={[0, 0, layer.zOffset]}
                  castShadow
                  receiveShadow
                  onClick={(e) => {
                    e.stopPropagation();
                    selectObject(wallId, 'wall');
                  }}
                >
                  <extrudeGeometry args={[shape, { depth: layer.depth, bevelEnabled: false }]} />
                  <meshStandardMaterial
                    color={layerColor}
                    roughness={0.7}
                    transparent={isTransparent}
                    opacity={layerOpacity}
                    depthWrite={!isTransparent}
                    side={isTransparent ? DoubleSide : FrontSide}
                  />
                </mesh>
              );
            })}
          </group>
        );
      })()}

      {uiState.selectedId === wallId && (
        <mesh
          position={[length / 2, customHeight / 2, wall.thickness / 2 + 0.2]}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => {
            e.stopPropagation();
            if (controls) (controls as any).enabled = false;
            startDragging(wallId, 'wallHandle');
            (e.target as any).setPointerCapture?.(e.pointerId);
          }}
          onPointerUp={(e) => {
            e.stopPropagation();
            if (controls) (controls as any).enabled = true;
            stopDragging();
            (e.target as any).releasePointerCapture?.(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (uiState.isDragging && uiState.draggedId === wallId) {
              e.stopPropagation();
              const floorPlane = new Plane(new Vector3(0, 1, 0), -(level * heightPerFloor + customHeight / 2));
              const intersection = new Vector3();
              if (e.ray.intersectPlane(floorPlane, intersection)) {
                updateDragPosition([intersection.x, intersection.y, intersection.z]);
              }
            }
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            document.body.style.cursor = 'ew-resize';
          }}
          onPointerOut={(e) => {
            e.stopPropagation();
            document.body.style.cursor = 'default';
          }}
        >
          <sphereGeometry args={[0.12, 16, 16]} />
          <meshStandardMaterial color="#ff8c00" emissive="#ff8c00" emissiveIntensity={0.5} roughness={0.3} />
        </mesh>
      )}

      {wall.subObjects.map((rawObj) => {
        const isDoor = rawObj.type === 'door';
        const isWindow = rawObj.type === 'window';
        const isOpening = rawObj.type === 'opening';

        const defaultElevation = isDoor ? 0 : (isWindow ? 0.9 : 0);
        const currentElevation = rawObj.elevation !== undefined ? rawObj.elevation : defaultElevation;
        
        let localWallHeightAtObj = customHeight;
        if (isTopFloor && isFlatRoof && (wall.id === 'wall-front' || wall.id === 'wall-back')) {
          localWallHeightAtObj = isBack
            ? hRight + rawObj.position * Math.tan(angleRad)
            : hLeft - rawObj.position * Math.tan(angleRad);
        }

        const lumberThickness = 0.04;
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
        const localY = obj.elevation + obj.height / 2;
        const objId = obj.id;

        const defaultColor = isOpening ? '#222222' : (obj.color || '#a0d0f0');
        const objMatProps = getMaterialProps(uiState.selectedId, uiState.seeThroughMode, objId, defaultColor);
        
        if (isOpening) {
          objMatProps.transparent = true;
          objMatProps.opacity = uiState.selectedId === objId ? 0.3 : 0.0;
          objMatProps.depthWrite = false;
        } else if (isWindow) {
          objMatProps.transparent = true;
          objMatProps.opacity = uiState.selectedId === objId ? 0.8 : 0.4;
        }

        return (
          <group key={objId} position={[obj.position, localY, 0]}>
            <mesh
              castShadow={false}
              receiveShadow={false}
              onClick={(e) => {
                e.stopPropagation();
                selectObject(objId, 'subObject');
              }}
              onPointerDown={(e) => {
                e.stopPropagation();
                selectObject(objId, 'subObject');
                if (controls) (controls as any).enabled = false;
                startDragging(objId, 'subObject');
                (e.target as any).setPointerCapture?.(e.pointerId);
              }}
              onPointerUp={(e) => {
                e.stopPropagation();
                if (controls) (controls as any).enabled = true;
                stopDragging();
                (e.target as any).releasePointerCapture?.(e.pointerId);
              }}
              onPointerMove={(e) => {
                if (uiState.isDragging && uiState.draggedId === objId) {
                  e.stopPropagation();
                  const normal = new Vector3(-dz, 0, dx).normalize();
                  const wallPlane = new Plane().setFromNormalAndCoplanarPoint(
                    normal,
                    new Vector3(wallCenterX, 0, wallCenterZ)
                  );
                  const intersection = new Vector3();
                  if (e.ray.intersectPlane(wallPlane, intersection)) {
                    updateDragPosition([intersection.x, intersection.y, intersection.z]);
                  }
                }
              }}
              onPointerOver={(e) => {
                e.stopPropagation();
                document.body.style.cursor = 'move';
              }}
              onPointerOut={(e) => {
                e.stopPropagation();
                document.body.style.cursor = 'default';
              }}
            >
              <boxGeometry args={[obj.width, obj.height, wall.thickness + 0.04]} />
              <meshBasicMaterial transparent={true} opacity={0} depthWrite={false} />
            </mesh>

            {isOpening && (
              <group>
                <mesh position={[0, obj.height / 2 - 0.02, 0]}>
                  <boxGeometry args={[obj.width, 0.04, wall.thickness + 0.02]} />
                  <meshStandardMaterial color={uiState.selectedId === objId ? '#ff8c00' : '#444444'} roughness={0.7} />
                </mesh>
                <mesh position={[0, -obj.height / 2 + 0.02, 0]}>
                  <boxGeometry args={[obj.width, 0.04, wall.thickness + 0.02]} />
                  <meshStandardMaterial color={uiState.selectedId === objId ? '#ff8c00' : '#444444'} roughness={0.7} />
                </mesh>
                <mesh position={[-obj.width / 2 + 0.02, 0, 0]}>
                  <boxGeometry args={[0.04, obj.height - 0.08, wall.thickness + 0.02]} />
                  <meshStandardMaterial color={uiState.selectedId === objId ? '#ff8c00' : '#444444'} roughness={0.7} />
                </mesh>
                <mesh position={[obj.width / 2 - 0.02, 0, 0]}>
                  <boxGeometry args={[0.04, obj.height - 0.08, wall.thickness + 0.02]} />
                  <meshStandardMaterial color={uiState.selectedId === objId ? '#ff8c00' : '#444444'} roughness={0.7} />
                </mesh>
              </group>
            )}

            {isWindow && (
              <group>
                <mesh position={[0, obj.height / 2 - 0.04, 0]}>
                  <boxGeometry args={[obj.width, 0.08, wall.thickness + 0.02]} />
                  <meshStandardMaterial color={uiState.selectedId === objId ? '#ff8c00' : '#eeeeee'} roughness={0.5} />
                </mesh>
                <mesh position={[0, -obj.height / 2 + 0.04, 0]}>
                  <boxGeometry args={[obj.width, 0.08, wall.thickness + 0.02]} />
                  <meshStandardMaterial color={uiState.selectedId === objId ? '#ff8c00' : '#eeeeee'} roughness={0.5} />
                </mesh>
                <mesh position={[-obj.width / 2 + 0.04, 0, 0]}>
                  <boxGeometry args={[0.08, obj.height - 0.16, wall.thickness + 0.02]} />
                  <meshStandardMaterial color={uiState.selectedId === objId ? '#ff8c00' : '#eeeeee'} roughness={0.5} />
                </mesh>
                <mesh position={[obj.width / 2 - 0.04, 0, 0]}>
                  <boxGeometry args={[0.08, obj.height - 0.16, wall.thickness + 0.02]} />
                  <meshStandardMaterial color={uiState.selectedId === objId ? '#ff8c00' : '#eeeeee'} roughness={0.5} />
                </mesh>
                <mesh position={[0, 0, 0]}>
                  <boxGeometry args={[obj.width - 0.08, obj.height - 0.08, 0.02]} />
                  <meshStandardMaterial color="#a0d0f0" transparent opacity={0.4} roughness={0.1} metalness={0.9} />
                </mesh>
              </group>
            )}

            {isDoor && (
              <group>
                <mesh position={[0, obj.height / 2 - 0.02, 0]}>
                  <boxGeometry args={[obj.width, 0.04, wall.thickness + 0.02]} />
                  <meshStandardMaterial color={uiState.selectedId === objId ? '#ff8c00' : '#333333'} roughness={0.5} />
                </mesh>
                <mesh position={[-obj.width / 2 + 0.02, 0, 0]}>
                  <boxGeometry args={[0.04, obj.height - 0.04, wall.thickness + 0.02]} />
                  <meshStandardMaterial color={uiState.selectedId === objId ? '#ff8c00' : '#333333'} roughness={0.5} />
                </mesh>
                <mesh position={[obj.width / 2 - 0.02, 0, 0]}>
                  <boxGeometry args={[0.04, obj.height - 0.04, wall.thickness + 0.02]} />
                  <meshStandardMaterial color={uiState.selectedId === objId ? '#ff8c00' : '#333333'} roughness={0.5} />
                </mesh>
                <mesh position={[0, 0, 0]}>
                  <boxGeometry args={[obj.width - 0.04, obj.height - 0.04, 0.04]} />
                  <meshStandardMaterial color={uiState.selectedId === objId ? '#ff8c00' : (obj.color || '#8B4513')} roughness={0.8} />
                </mesh>
              </group>
            )}

            <OpeningDragGuides
              obj={obj}
              length={length}
              isDragging={uiState.isDragging && uiState.draggedId === objId}
              showDimensions={useProjectStore.getState().structuralConfig?.showDimensionsOnDrag !== false}
            />
          </group>
        );
      })}
    </group>
  );
}

const labelStyle = {
  background: 'rgba(0, 0, 0, 0.85)',
  color: '#ff8c00',
  border: '1px solid #ff8c00',
  padding: '2px 6px',
  borderRadius: '4px',
  fontSize: '10px',
  fontWeight: 'bold' as const,
  whiteSpace: 'nowrap' as const,
  pointerEvents: 'none' as const,
  boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
  fontFamily: 'monospace'
};

export function OpeningDragGuides({
  obj,
  length,
  isDragging,
  showDimensions
}: {
  obj: any;
  length: number;
  isDragging: boolean;
  showDimensions: boolean;
}) {
  if (!isDragging || !showDimensions) return null;

  const gapL = obj.position - obj.width / 2;
  const gapR = length - (obj.position + obj.width / 2);
  const hasElevation = obj.elevation > 0.05;

  return (
    <group>
      {gapL > 0.02 && (
        <group>
          <mesh position={[(-obj.position - obj.width / 2) / 2, 0, 0]}>
            <boxGeometry args={[gapL, 0.015, 0.015]} />
            <meshBasicMaterial color="#ff8c00" opacity={0.6} transparent />
          </mesh>
          <mesh position={[-obj.position, 0, 0]}>
            <boxGeometry args={[0.015, 0.1, 0.015]} />
            <meshBasicMaterial color="#ff8c00" opacity={0.8} transparent />
          </mesh>
          <mesh position={[-obj.width / 2, 0, 0]}>
            <boxGeometry args={[0.015, 0.1, 0.015]} />
            <meshBasicMaterial color="#ff8c00" opacity={0.8} transparent />
          </mesh>
          <Html position={[(-obj.position - obj.width / 2) / 2, 0.12, 0]} center>
            <div style={labelStyle}>
              {(gapL * 100).toFixed(0)} cm
            </div>
          </Html>
        </group>
      )}

      {gapR > 0.02 && (
        <group>
          <mesh position={[(obj.width / 2 + (length - obj.position)) / 2, 0, 0]}>
            <boxGeometry args={[gapR, 0.015, 0.015]} />
            <meshBasicMaterial color="#ff8c00" opacity={0.6} transparent />
          </mesh>
          <mesh position={[obj.width / 2, 0, 0]}>
            <boxGeometry args={[0.015, 0.1, 0.015]} />
            <meshBasicMaterial color="#ff8c00" opacity={0.8} transparent />
          </mesh>
          <mesh position={[length - obj.position, 0, 0]}>
            <boxGeometry args={[0.015, 0.1, 0.015]} />
            <meshBasicMaterial color="#ff8c00" opacity={0.8} transparent />
          </mesh>
          <Html position={[(obj.width / 2 + (length - obj.position)) / 2, 0.12, 0]} center>
            <div style={labelStyle}>
              {(gapR * 100).toFixed(0)} cm
            </div>
          </Html>
        </group>
      )}

      <Html position={[0, obj.height / 2 + 0.12, 0]} center>
        <div style={labelStyle}>
          W: {(obj.width * 100).toFixed(0)} cm
        </div>
      </Html>

      <Html position={[obj.width / 2 + 0.15, 0, 0]} center>
        <div style={labelStyle}>
          H: {(obj.height * 100).toFixed(0)} cm
        </div>
      </Html>

      {hasElevation && (
        <group>
          <mesh position={[-obj.width / 2 - 0.1, -obj.height / 2 - obj.elevation / 2, 0]}>
            <boxGeometry args={[0.015, obj.elevation, 0.015]} />
            <meshBasicMaterial color="#ff8c00" opacity={0.6} transparent />
          </mesh>
          <mesh position={[-obj.width / 2 - 0.1, -obj.height / 2 - obj.elevation, 0]}>
            <boxGeometry args={[0.1, 0.015, 0.015]} />
            <meshBasicMaterial color="#ff8c00" opacity={0.8} transparent />
          </mesh>
          <mesh position={[-obj.width / 2 - 0.1, -obj.height / 2, 0]}>
            <boxGeometry args={[0.1, 0.015, 0.015]} />
            <meshBasicMaterial color="#ff8c00" opacity={0.8} transparent />
          </mesh>
          <Html position={[-obj.width / 2 - 0.1, -obj.height / 2 - obj.elevation / 2, 0]} center>
            <div style={labelStyle}>
              Elev: {(obj.elevation * 100).toFixed(0)} cm
            </div>
          </Html>
        </group>
      )}
    </group>
  );
}
