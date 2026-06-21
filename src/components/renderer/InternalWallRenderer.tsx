import { InternalWall } from '../../types';
import { useProjectStore } from '../../store';
import { DoubleSide, FrontSide, Shape, Path, Plane, Vector3 } from 'three';
import { useThree } from '@react-three/fiber';
import { getMaterialProps } from './materialProps';
import { OpeningDragGuides } from './WallRenderer';

export default function InternalWallRenderer({ wall, level }: { wall: InternalWall; level: number }) {
  const { controls } = useThree();
  const dimensions = useProjectStore((state) => state.dimensions);
  const floors = useProjectStore((state) => state.floors);
  const uiState = useProjectStore((state) => state.uiState);
  const selectObject = useProjectStore((state) => state.selectObject);
  const startDragging = useProjectStore((state) => state.startDragging);
  const stopDragging = useProjectStore((state) => state.stopDragging);
  const updateDragPosition = useProjectStore((state) => state.updateDragPosition);

  const { heightPerFloor } = dimensions;
  const totalFloors = floors.length;

  const startX = wall.start[0];
  const startZ = wall.start[1];
  const endX = wall.end[0];
  const endZ = wall.end[1];

  const dx = endX - startX;
  const dz = endZ - startZ;
  const length = Math.sqrt(dx * dx + dz * dz);
  if (length < 0.05) return null;
  const rotationY = -Math.atan2(dz, dx);

  const wallId = wall.id;
  const isSelected = uiState.selectedId === wallId;

  const joistHeight = 0.14;
  const isTopFloor = level === totalFloors - 1;
  const baseHeight = isTopFloor ? heightPerFloor : heightPerFloor - joistHeight;
  const wallBaseHeight = baseHeight;

  const createInternalWallShape = (xStartOffset: number, xEndOffset: number) => {
    const shape = new Shape();
    shape.moveTo(xStartOffset, 0);
    shape.lineTo(length - xEndOffset, 0);
    shape.lineTo(length - xEndOffset, wallBaseHeight);
    shape.lineTo(xStartOffset, wallBaseHeight);
    shape.closePath();

    wall.subObjects.forEach((obj) => {
      const isDoor = obj.type === 'door';
      const defaultElevation = isDoor ? 0 : 0.9;
      const currentElevation = obj.elevation !== undefined ? obj.elevation : defaultElevation;
      
      const lumberThickness = wall.timberSize.thickness;
      const doubleTopPlate = lumberThickness * 2;
      const headerThickness = 0.14;
      const topClearance = doubleTopPlate + headerThickness;
      const clampedElevation = Math.max(0, Math.min(Math.max(0, wallBaseHeight - topClearance - obj.height), currentElevation));

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

  return (
    <group position={[startX, level * heightPerFloor, startZ]} rotation={[0, rotationY, 0]}>
      {uiState.seeThroughMode !== 'studsOnly' && (() => {
        const mode = uiState.seeThroughMode;
        const { width: timberWidth } = wall.timberSize;
        const lining = wall.liningThickness;

        const layers = [
          {
            suffix: 'left',
            zOffset: -timberWidth / 2 - lining,
            depth: lining,
            color: '#e6e6e6',
            opacity: mode === 'seeThrough' ? 0.5 : 1.0,
          },
          {
            suffix: 'right',
            zOffset: timberWidth / 2,
            depth: lining,
            color: '#e6e6e6',
            opacity: mode === 'seeThrough' ? 0.5 : 1.0,
          }
        ];

        return (
          <group>
            {layers.filter(l => l.depth > 0.001).map((layer) => {
              const layerColor = isSelected ? '#ff8c00' : layer.color;
              const layerOpacity = isSelected ? Math.min(1.0, layer.opacity + 0.15) : layer.opacity;
              const isTransparent = mode === 'seeThrough';
              const shape = createInternalWallShape(0, 0);

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

      <mesh
        position={[length / 2, wallBaseHeight / 2, 0]}
        onClick={(e) => {
          e.stopPropagation();
          selectObject(wallId, 'wall');
        }}
        onPointerDown={(e) => {
          e.stopPropagation();
          selectObject(wallId, 'wall');
          
          const floorPlane = new Plane(new Vector3(0, 1, 0), -(level * heightPerFloor));
          const intersection = new Vector3();
          if (e.ray.intersectPlane(floorPlane, intersection)) {
            const offset: [number, number] = [
              wall.start[0] - intersection.x,
              wall.start[1] - intersection.z
            ];
            if (controls) (controls as any).enabled = false;
            startDragging(wallId, 'internalWall', offset);
            (e.target as any).setPointerCapture?.(e.pointerId);
          }
        }}
        onPointerUp={(e) => {
          e.stopPropagation();
          if (controls) (controls as any).enabled = true;
          stopDragging();
          (e.target as any).releasePointerCapture?.(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (uiState.isDragging && uiState.draggedId === wallId && uiState.draggedType === 'internalWall') {
            e.stopPropagation();
            const floorPlane = new Plane(new Vector3(0, 1, 0), -(level * heightPerFloor));
            const intersection = new Vector3();
            if (e.ray.intersectPlane(floorPlane, intersection)) {
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
          document.body.style.cursor = 'auto';
        }}
      >
        <boxGeometry args={[length, wallBaseHeight, wall.timberSize.width + 2 * wall.liningThickness + 0.08]} />
        <meshBasicMaterial transparent opacity={0.0} depthWrite={false} />
      </mesh>

      {isSelected && (
        <group>
          <mesh
            position={[0, wallBaseHeight / 2, 0]}
            onPointerDown={(e) => {
              e.stopPropagation();
              if (controls) (controls as any).enabled = false;
              startDragging(wallId, 'internalWallStart');
              (e.target as any).setPointerCapture?.(e.pointerId);
            }}
            onPointerUp={(e) => {
              e.stopPropagation();
              if (controls) (controls as any).enabled = true;
              stopDragging();
              (e.target as any).releasePointerCapture?.(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (uiState.isDragging && uiState.draggedId === wallId && uiState.draggedType === 'internalWallStart') {
                e.stopPropagation();
                const floorPlane = new Plane(new Vector3(0, 1, 0), -(level * heightPerFloor));
                const intersection = new Vector3();
                if (e.ray.intersectPlane(floorPlane, intersection)) {
                  updateDragPosition([intersection.x, intersection.y, intersection.z]);
                }
              }
            }}
            onPointerOver={(e) => {
              e.stopPropagation();
              document.body.style.cursor = 'crosshair';
            }}
            onPointerOut={(e) => {
              e.stopPropagation();
              document.body.style.cursor = 'auto';
            }}
          >
            <sphereGeometry args={[0.08, 16, 16]} />
            <meshBasicMaterial color="#3498db" transparent opacity={0.8} depthTest={false} />
          </mesh>

          <mesh
            position={[length, wallBaseHeight / 2, 0]}
            onPointerDown={(e) => {
              e.stopPropagation();
              if (controls) (controls as any).enabled = false;
              startDragging(wallId, 'internalWallEnd');
              (e.target as any).setPointerCapture?.(e.pointerId);
            }}
            onPointerUp={(e) => {
              e.stopPropagation();
              if (controls) (controls as any).enabled = true;
              stopDragging();
              (e.target as any).releasePointerCapture?.(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (uiState.isDragging && uiState.draggedId === wallId && uiState.draggedType === 'internalWallEnd') {
                e.stopPropagation();
                const floorPlane = new Plane(new Vector3(0, 1, 0), -(level * heightPerFloor));
                const intersection = new Vector3();
                if (e.ray.intersectPlane(floorPlane, intersection)) {
                  updateDragPosition([intersection.x, intersection.y, intersection.z]);
                }
              }
            }}
            onPointerOver={(e) => {
              e.stopPropagation();
              document.body.style.cursor = 'crosshair';
            }}
            onPointerOut={(e) => {
              e.stopPropagation();
              document.body.style.cursor = 'auto';
            }}
          >
            <sphereGeometry args={[0.08, 16, 16]} />
            <meshBasicMaterial color="#3498db" transparent opacity={0.8} depthTest={false} />
          </mesh>

          <group position={[length / 2, wallBaseHeight, 0]}>
            <mesh position={[0, 0.15, 0]}>
              <cylinderGeometry args={[0.01, 0.01, 0.3, 8]} />
              <meshBasicMaterial color="#2ecc71" depthTest={false} />
            </mesh>
            <mesh
              position={[0, 0.3, 0]}
              onPointerDown={(e) => {
                e.stopPropagation();
                const floorPlane = new Plane(new Vector3(0, 1, 0), -(level * heightPerFloor));
                const intersection = new Vector3();
                if (e.ray.intersectPlane(floorPlane, intersection)) {
                  const cx = (wall.start[0] + wall.end[0]) / 2;
                  const cz = (wall.start[1] + wall.end[1]) / 2;
                  const initialAngle = Math.atan2(intersection.z - cz, intersection.x - cx);
                  
                  if (controls) (controls as any).enabled = false;
                  startDragging(wallId, 'internalWallRotate', [initialAngle, rotationY]);
                  (e.target as any).setPointerCapture?.(e.pointerId);
                }
              }}
              onPointerUp={(e) => {
                e.stopPropagation();
                if (controls) (controls as any).enabled = true;
                stopDragging();
                (e.target as any).releasePointerCapture?.(e.pointerId);
              }}
              onPointerMove={(e) => {
                if (uiState.isDragging && uiState.draggedId === wallId && uiState.draggedType === 'internalWallRotate') {
                  e.stopPropagation();
                  const floorPlane = new Plane(new Vector3(0, 1, 0), -(level * heightPerFloor));
                  const intersection = new Vector3();
                  if (e.ray.intersectPlane(floorPlane, intersection)) {
                    updateDragPosition([intersection.x, intersection.y, intersection.z]);
                  }
                }
              }}
              onPointerOver={(e) => {
                e.stopPropagation();
                document.body.style.cursor = 'grab';
              }}
              onPointerOut={(e) => {
                e.stopPropagation();
                document.body.style.cursor = 'auto';
              }}
            >
              <sphereGeometry args={[0.08, 16, 16]} />
              <meshBasicMaterial color="#2ecc71" transparent opacity={0.8} depthTest={false} />
            </mesh>
          </group>
        </group>
      )}

      {wall.subObjects.map((rawObj) => {
        const isDoor = rawObj.type === 'door';
        const isWindow = rawObj.type === 'window';
        const isOpening = rawObj.type === 'opening';

        const defaultElevation = isDoor ? 0 : (isWindow ? 0.9 : 0);
        const currentElevation = rawObj.elevation !== undefined ? rawObj.elevation : defaultElevation;
        
        const lumberThickness = wall.timberSize.thickness;
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

        const wallCenterX = startX + obj.position * Math.cos(rotationY);
        const wallCenterZ = startZ - obj.position * Math.sin(rotationY);
        const wallThickness = wall.timberSize.width + wall.liningThickness * 2;

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
              <boxGeometry args={[obj.width, obj.height, wallThickness + 0.04]} />
              <meshBasicMaterial transparent={true} opacity={0} depthWrite={false} />
            </mesh>

            {isWindow && (
              <mesh>
                <boxGeometry args={[obj.width - 0.08, obj.height - 0.08, 0.02]} />
                <meshStandardMaterial
                  color={objMatProps.color}
                  transparent={objMatProps.transparent}
                  opacity={objMatProps.opacity}
                  roughness={0.1}
                  metalness={0.9}
                />
              </mesh>
            )}

            {isDoor && (
              <group position={[-obj.width / 2, 0, 0]} rotation={[0, isSelected ? Math.PI / 4 : 0, 0]}>
                <mesh position={[obj.width / 2, 0, 0]}>
                  <boxGeometry args={[obj.width - 0.02, obj.height - 0.02, 0.04]} />
                  <meshStandardMaterial
                    color={uiState.selectedId === objId ? '#ff8c00' : '#8b4513'}
                    roughness={0.6}
                  />
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
