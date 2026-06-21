import { DoubleSide, FrontSide, Side, Shape, Path, Plane, Vector3 } from 'three';
import { useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { useProjectStore } from '../store';
import { Wall, Floor, InternalWall } from '../types';
import { generateFraming } from '../utils/framingEngine';

export default function BuildingRenderer() {
  const { controls } = useThree();
  const dimensions = useProjectStore((state) => state.dimensions);
  const floors = useProjectStore((state) => state.floors);
  const roof = useProjectStore((state) => state.roof);
  const uiState = useProjectStore((state) => state.uiState);
  const foundation = useProjectStore((state) => state.foundation);
  const wallLayers = useProjectStore((state) => state.wallLayers);
  const wallPreset = useProjectStore((state) => state.wallPreset);
  const selectObject = useProjectStore((state) => state.selectObject);
  const startDragging = useProjectStore((state) => state.startDragging);
  const stopDragging = useProjectStore((state) => state.stopDragging);
  const updateDragPosition = useProjectStore((state) => state.updateDragPosition);

  const { width, depth, heightPerFloor } = dimensions;
  const totalFloors = floors.length;
  const topElevation = totalFloors * heightPerFloor;

  console.log("RENDERING BuildingRenderer. internalWalls:", floors.map(f => f.internalWalls?.map(w => ({ id: w.id, start: w.start, end: w.end, subObjects: w.subObjects.map(o => o.id) }))));


  // Helper to determine material properties based on selection and see-through mode
  const getMaterialProps = (id: string, _type: 'wall' | 'subObject' | 'roof' | 'floor', defaultColor: string) => {
    const isSelected = uiState.selectedId === id;
    const mode = uiState.seeThroughMode;
    
    let color = isSelected ? '#ff8c00' : defaultColor;
    let opacity = 1.0;
    let transparent = false;
    let wireframe = false;
    let side: Side = FrontSide; // FrontSide by default

    if (mode === 'seeThrough') {
      // 30% transparent means 70% opacity (0.7)
      opacity = isSelected ? 0.85 : 0.7;
      transparent = true;
      side = DoubleSide; // Show both sides when transparent
    } else if (mode === 'studsOnly') {
      opacity = isSelected ? 0.6 : 0.1;
      transparent = true;
      wireframe = true;
    }

    return { color, opacity, transparent, wireframe, depthWrite: !transparent, side };
  };

  // Render a single floor slab
  const renderFloorSlab = (floor: Floor) => {
    const floorY = floor.level * heightPerFloor;
    const matProps = getMaterialProps(floor.id, 'floor', '#555555');

    const wallThickness = floor.walls[0]?.thickness || 0.15;
    const outerW = width + wallThickness * 0.70; // aligned with inner face of cladding
    const outerD = depth + wallThickness * 0.70;

    // Build the 2D Shape of the floor footprint (X-Z plane, drawn in local X-Y)
    const floorShape = new Shape();
    floorShape.moveTo(-outerW / 2, -outerD / 2);
    floorShape.lineTo(outerW / 2, -outerD / 2);
    floorShape.lineTo(outerW / 2, outerD / 2);
    floorShape.lineTo(-outerW / 2, outerD / 2);
    floorShape.closePath();

    // Carve out a hole for the stairwell opening if it exists
    if (floor.floorOpening) {
      const opening = floor.floorOpening;
      const xStart = opening.x - opening.width / 2;
      const xEnd = opening.x + opening.width / 2;
      const yStart = opening.z - opening.depth / 2;
      const yEnd = opening.z + opening.depth / 2;

      const holePath = new Path();
      // Clockwise drawing to subtract from CCW floorShape
      holePath.moveTo(xStart, yStart);
      holePath.lineTo(xStart, yEnd);
      holePath.lineTo(xEnd, yEnd);
      holePath.lineTo(xEnd, yStart);
      holePath.closePath();
      
      floorShape.holes.push(holePath);
    }

    return (
      <group key={floor.id}>
        {/* Floor Slab */}
        {uiState.seeThroughMode !== 'studsOnly' && !(floor.level === 0 && foundation.type === 'screws') && (
          <mesh
            position={[0, floorY, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            castShadow
            receiveShadow
            onClick={(e) => {
              e.stopPropagation();
              selectObject(floor.id, 'floor');
            }}
          >
            <extrudeGeometry args={[floorShape, { depth: 0.15, bevelEnabled: false }]} />
            <meshStandardMaterial {...matProps} roughness={0.8} />
          </mesh>
        )}

        {/* Staircase leading up to the opening from the floor below */}
        {floor.level > 0 && floor.floorOpening && (() => {
          const opening = floor.floorOpening;
          const numSteps = 12;
          const stepHeight = heightPerFloor / numSteps;
          const stepDepth = opening.depth / numSteps;
          const steps = [];
          
          for (let i = 0; i < numSteps; i++) {
            // Steps start at floor level below and lead up to current floor level
            const stepY = (floor.level - 1) * heightPerFloor + i * stepHeight + stepHeight / 2;
            const stepZ = opening.z - opening.depth / 2 + i * stepDepth + stepDepth / 2;
            const stepX = opening.x;
            
            steps.push(
              <mesh
                key={`step-${floor.id}-${i}`}
                position={[stepX, stepY, stepZ]}
                castShadow
                receiveShadow
              >
                <boxGeometry args={[opening.width - 0.05, 0.04, stepDepth]} />
                <meshStandardMaterial color="#8b5a2b" roughness={0.9} />
              </mesh>
            );
          }
          return <group>{steps}</group>;
        })()}
      </group>
    );
  };

  // Render a wall with start/end coordinates and sub-objects
  const renderWall = (wall: Wall, level: number, floorId: string) => {
    const startX = wall.start[0];
    const startZ = wall.start[1];
    const endX = wall.end[0];
    const endZ = wall.end[1];

    // Compute length and rotation
    const dx = endX - startX;
    const dz = endZ - startZ;
    const length = Math.sqrt(dx * dx + dz * dz);
    const rotationY = -Math.atan2(dz, dx);

    const wallId = `${floorId}-${wall.id}`;
    const isBack = wall.id === 'wall-back';

    // Check if we need to apply flat roof slope adjustment to this wall
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

    // Compute flat roof heights for front/back walls
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
      <group key={wallId} position={[startX, level * heightPerFloor, startZ]} rotation={[0, rotationY, 0]}>
        {/* Wall body with cutouts - 3 Layers (Outer, Middle/Insulation, Inner) */}
        {uiState.seeThroughMode !== 'studsOnly' && (() => {
          const { outer, middle, inner } = wallLayers;
          const T = outer + middle + inner;
          const isSelected = uiState.selectedId === wallId;
          const mode = uiState.seeThroughMode;

          // Layer definitions: [keySuffix, localZOffset, depth, defaultColor, defaultOpacity]
          // Outer cladding is on the positive local Z side (+T/2), inner drywall is on the negative local Z side (-T/2)
          const isSideWall = wall.id === 'wall-left' || wall.id === 'wall-right';
          const layers = [
            {
              suffix: 'outer',
              zOffset: T / 2 - outer,
              depth: outer,
              color: wallPreset === 'diffusion_closed' ? '#5c3a21' : '#8b5a2b', // Wood siding brown
              opacity: mode === 'seeThrough' ? 0.15 : 1.0,
              xStartOffset: isSideWall ? -T : outer,
              xEndOffset: isSideWall ? -T : outer,
            },
            {
              suffix: 'middle',
              zOffset: -T / 2 + inner,
              depth: wallPreset === 'diffusion_closed' ? 0 : middle,
              color: '#ded29e', // Rockwool insulation yellow
              opacity: mode === 'seeThrough' ? 0.25 : 1.0,
              xStartOffset: isSideWall ? -inner : outer,
              xEndOffset: isSideWall ? -inner : outer,
            },
            {
              suffix: 'inner',
              zOffset: -T / 2,
              depth: inner,
              color: wallPreset === 'diffusion_open' ? '#d2b48c' : '#e6e6e6', // OSB tan or Drywall off-white
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

        {/* Drag handle for resizing wall depth/width */}
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

        {/* Sub-objects (windows, doors, openings) nested in wall space */}
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
          const localY = obj.elevation + obj.height / 2;
          const objId = obj.id;

          const defaultColor = isOpening ? '#222222' : (obj.color || '#a0d0f0');
          const objMatProps = getMaterialProps(objId, 'subObject', defaultColor);
          
          if (isOpening) {
            objMatProps.transparent = true;
            objMatProps.opacity = uiState.selectedId === objId ? 0.3 : 0.0;
            objMatProps.depthWrite = false;
          } else if (isWindow) {
            objMatProps.transparent = true;
            objMatProps.opacity = uiState.selectedId === objId ? 0.8 : 0.4;
          }

          return (
            <group
              key={objId}
              position={[obj.position, localY, 0]}
            >
              {/* Raycast block for selection and dragging */}
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
                <meshBasicMaterial 
                  transparent={true} 
                  opacity={0} 
                  depthWrite={false} 
                />
              </mesh>

              {/* Rendering Opening Border Frame */}
              {isOpening && (
                <group>
                  {/* Top Bar */}
                  <mesh position={[0, obj.height / 2 - 0.02, 0]}>
                    <boxGeometry args={[obj.width, 0.04, wall.thickness + 0.02]} />
                    <meshStandardMaterial color={uiState.selectedId === objId ? '#ff8c00' : '#444444'} roughness={0.7} />
                  </mesh>
                  {/* Bottom Bar */}
                  <mesh position={[0, -obj.height / 2 + 0.02, 0]}>
                    <boxGeometry args={[obj.width, 0.04, wall.thickness + 0.02]} />
                    <meshStandardMaterial color={uiState.selectedId === objId ? '#ff8c00' : '#444444'} roughness={0.7} />
                  </mesh>
                  {/* Left Bar */}
                  <mesh position={[-obj.width / 2 + 0.02, 0, 0]}>
                    <boxGeometry args={[0.04, obj.height - 0.08, wall.thickness + 0.02]} />
                    <meshStandardMaterial color={uiState.selectedId === objId ? '#ff8c00' : '#444444'} roughness={0.7} />
                  </mesh>
                  {/* Right Bar */}
                  <mesh position={[obj.width / 2 - 0.02, 0, 0]}>
                    <boxGeometry args={[0.04, obj.height - 0.08, wall.thickness + 0.02]} />
                    <meshStandardMaterial color={uiState.selectedId === objId ? '#ff8c00' : '#444444'} roughness={0.7} />
                  </mesh>
                </group>
              )}

              {/* Rendering Window Glass & Frame */}
              {isWindow && (
                <group>
                  {/* Frame */}
                  {/* Top Bar */}
                  <mesh position={[0, obj.height / 2 - 0.04, 0]}>
                    <boxGeometry args={[obj.width, 0.08, wall.thickness + 0.02]} />
                    <meshStandardMaterial color={uiState.selectedId === objId ? '#ff8c00' : '#eeeeee'} roughness={0.5} />
                  </mesh>
                  {/* Bottom Bar */}
                  <mesh position={[0, -obj.height / 2 + 0.04, 0]}>
                    <boxGeometry args={[obj.width, 0.08, wall.thickness + 0.02]} />
                    <meshStandardMaterial color={uiState.selectedId === objId ? '#ff8c00' : '#eeeeee'} roughness={0.5} />
                  </mesh>
                  {/* Left Bar */}
                  <mesh position={[-obj.width / 2 + 0.04, 0, 0]}>
                    <boxGeometry args={[0.08, obj.height - 0.16, wall.thickness + 0.02]} />
                    <meshStandardMaterial color={uiState.selectedId === objId ? '#ff8c00' : '#eeeeee'} roughness={0.5} />
                  </mesh>
                  {/* Right Bar */}
                  <mesh position={[obj.width / 2 - 0.04, 0, 0]}>
                    <boxGeometry args={[0.08, obj.height - 0.16, wall.thickness + 0.02]} />
                    <meshStandardMaterial color={uiState.selectedId === objId ? '#ff8c00' : '#eeeeee'} roughness={0.5} />
                  </mesh>
                  {/* Glass Pane */}
                  <mesh position={[0, 0, 0]}>
                    <boxGeometry args={[obj.width - 0.08, obj.height - 0.08, 0.02]} />
                    <meshStandardMaterial color="#a0d0f0" transparent opacity={0.4} roughness={0.1} metalness={0.9} />
                  </mesh>
                </group>
              )}

              {/* Rendering Door Panel & Frame */}
              {isDoor && (
                <group>
                  {/* Frame */}
                  {/* Top Bar */}
                  <mesh position={[0, obj.height / 2 - 0.02, 0]}>
                    <boxGeometry args={[obj.width, 0.04, wall.thickness + 0.02]} />
                    <meshStandardMaterial color={uiState.selectedId === objId ? '#ff8c00' : '#333333'} roughness={0.5} />
                  </mesh>
                  {/* Left Bar */}
                  <mesh position={[-obj.width / 2 + 0.02, 0, 0]}>
                    <boxGeometry args={[0.04, obj.height - 0.04, wall.thickness + 0.02]} />
                    <meshStandardMaterial color={uiState.selectedId === objId ? '#ff8c00' : '#333333'} roughness={0.5} />
                  </mesh>
                  {/* Right Bar */}
                  <mesh position={[obj.width / 2 - 0.02, 0, 0]}>
                    <boxGeometry args={[0.04, obj.height - 0.04, wall.thickness + 0.02]} />
                    <meshStandardMaterial color={uiState.selectedId === objId ? '#ff8c00' : '#333333'} roughness={0.5} />
                  </mesh>
                  {/* Door Panel */}
                  <mesh position={[0, 0, 0]}>
                    <boxGeometry args={[obj.width - 0.04, obj.height - 0.04, 0.04]} />
                    <meshStandardMaterial color={uiState.selectedId === objId ? '#ff8c00' : (obj.color || '#8B4513')} roughness={0.8} />
                  </mesh>
                </group>
              )}

              <OpeningDragGuides
                obj={obj}
                length={length}
                wallThickness={wall.thickness}
                isDragging={uiState.isDragging && uiState.draggedId === objId}
                showDimensions={useProjectStore.getState().structuralConfig?.showDimensionsOnDrag !== false}
              />
            </group>
          );
        })}
      </group>
    );
  };

  // Render an internal partition wall
  const renderInternalWall = (wall: InternalWall, level: number) => {
    const startX = wall.start[0];
    const startZ = wall.start[1];
    const endX = wall.end[0];
    const endZ = wall.end[1];

    // Compute length and rotation
    const dx = endX - startX;
    const dz = endZ - startZ;
    const length = Math.sqrt(dx * dx + dz * dz);
    if (length < 0.05) return null;
    const rotationY = -Math.atan2(dz, dx);

    const wallId = wall.id; // Internal wall IDs are already globally unique
    const isSelected = uiState.selectedId === wallId;

    // Const height
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
      <group key={wallId} position={[startX, level * heightPerFloor, startZ]} rotation={[0, rotationY, 0]}>
        {/* Partition Drywall Layers - 2 Layers (Left, Right) */}
        {uiState.seeThroughMode !== 'studsOnly' && (() => {
          const mode = uiState.seeThroughMode;
          const { width: timberWidth } = wall.timberSize;
          const lining = wall.liningThickness;

          // lining layers are on both sides of the studs core
          const layers = [
            {
              suffix: 'left',
              zOffset: -timberWidth / 2 - lining,
              depth: lining,
              color: '#e6e6e6', // Drywall off-white
              opacity: mode === 'seeThrough' ? 0.5 : 1.0,
            },
            {
              suffix: 'right',
              zOffset: timberWidth / 2,
              depth: lining,
              color: '#e6e6e6', // Drywall off-white
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

        {/* Invisible raycast target for the wall body drag */}
        <mesh
          position={[length / 2, wallBaseHeight / 2, 0]}
          onClick={(e) => {
            e.stopPropagation();
            selectObject(wallId, 'wall');
          }}
          onPointerDown={(e) => {
            e.stopPropagation();
            selectObject(wallId, 'wall');
            
            // Calculate initial drag offset in world coordinates projected on floor plane
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

        {/* Selected Handles for Move and Rotation */}
        {isSelected && (
          <group>
            {/* Start point handle */}
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

            {/* End point handle */}
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

            {/* Rotation handle */}
            <group position={[length / 2, wallBaseHeight, 0]}>
              {/* Connector line */}
              <mesh position={[0, 0.15, 0]}>
                <cylinderGeometry args={[0.01, 0.01, 0.3, 8]} />
                <meshBasicMaterial color="#2ecc71" depthTest={false} />
              </mesh>
              {/* Rotation sphere */}
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

        {/* Sub-objects nested in internal wall space (Doors) */}
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
          const objMatProps = getMaterialProps(objId, 'subObject', defaultColor);
          
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
            <group
              key={objId}
              position={[obj.position, localY, 0]}
            >
              {/* Raycast block for selection and dragging */}
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
                <meshBasicMaterial 
                  transparent={true} 
                  opacity={0} 
                  depthWrite={false} 
                />
              </mesh>

              {/* Window glass and frame */}
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

              {/* Door panel (if selected, opens slightly) */}
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
                wallThickness={wallThickness}
                isDragging={uiState.isDragging && uiState.draggedId === objId}
                showDimensions={useProjectStore.getState().structuralConfig?.showDimensionsOnDrag !== false}
              />
            </group>
          );
        })}
      </group>
    );
  };

  // Render the roof
  const renderRoof = () => {
    if (uiState.seeThroughMode === 'studsOnly') return null;
    const matProps = getMaterialProps('roof', 'roof', '#a05040');
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
      // Saddle Roof: Ridge runs along Z-axis, slopes down on +/- X sides
      const wallThickness = floors[0]?.walls[0]?.thickness || 0.15;
      const halfGableWidth = width / 2 + wallThickness * 0.5;
      const halfRoofWidth = halfGableWidth + overhang;
      const tVertical = thickness / Math.cos(angleRad);
      
      const roofDepth = depth + overhang * 2;

      // Create mitered shapes in X-Y plane where bottom face rests exactly on top-plate (Y = topElevation) at X = +/- halfGableWidth
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

      // Helper to generate the triangular shape of each gable layer with custom side offsets
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
          {/* Right Slope (Extruded from X-Y shape along Z) */}
          <mesh castShadow receiveShadow position={[0, 0, -roofDepth / 2]}>
            <extrudeGeometry args={[rightSlopeShape, { depth: roofDepth, bevelEnabled: false }]} />
            <meshStandardMaterial {...matProps} roughness={0.5} />
          </mesh>

          {/* Left Slope (Extruded from X-Y shape along Z) */}
          <mesh castShadow receiveShadow position={[0, 0, -roofDepth / 2]}>
            <extrudeGeometry args={[leftSlopeShape, { depth: roofDepth, bevelEnabled: false }]} />
            <meshStandardMaterial {...matProps} roughness={0.5} />
          </mesh>

          {/* Gable walls (3D extruded triangular closures) */}
          {!matProps.wireframe && (
            <>
              {/* Front Gable */}
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

              {/* Back Gable */}
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
  };

  const getMemberLevel = (id: string): number => {
    const wallFloorMatch = id.match(/floor-(\d+)/);
    if (wallFloorMatch) return parseInt(wallFloorMatch[1]);
    const floorMatch = id.match(/floor-(?:rim-front-|rim-back-|header-front-|header-back-|joist-)?(\d+)/);
    if (floorMatch) return parseInt(floorMatch[1]);
    return -1;
  };

  // In topDown view, we only want to show the active floor (defaulting to floor 0 if none is selected)
  const activeFloorLevel = uiState.viewMode === 'topDown'
    ? (uiState.currentFloorView === -1 ? 0 : uiState.currentFloorView)
    : uiState.currentFloorView;

  const visibleFloors = activeFloorLevel === -1
    ? floors
    : floors.filter((f) => f.level === activeFloorLevel);

  return (
    <group>
      {/* Floors and their walls */}
      {visibleFloors.map((floor) => (
        <group key={floor.id}>
          {renderFloorSlab(floor)}
          {floor.walls.map((wall) => renderWall(wall, floor.level, floor.id))}
          {(floor.internalWalls || []).map((wall) => renderInternalWall(wall, floor.level))}
        </group>
      ))}

      {/* Ceiling Floor Slab (Attic floor / floor of roof) */}
      {uiState.viewMode !== 'topDown' && (uiState.currentFloorView === -1 || uiState.currentFloorView === totalFloors) && (() => {
        const matProps = getMaterialProps('floor-roof', 'floor', '#666666');
        const wallThickness = floors[0]?.walls[0]?.thickness || 0.15;
        const outerW = width + wallThickness * 0.70;
        const outerD = depth + wallThickness * 0.70;

        const ceilingShape = new Shape();
        ceilingShape.moveTo(-outerW / 2, -outerD / 2);
        ceilingShape.lineTo(outerW / 2, -outerD / 2);
        ceilingShape.lineTo(outerW / 2, outerD / 2);
        ceilingShape.lineTo(-outerW / 2, outerD / 2);
        ceilingShape.closePath();

        if (roof.roofOpening) {
          const opening = roof.roofOpening;
          const xStart = opening.x - opening.width / 2;
          const xEnd = opening.x + opening.width / 2;
          const yStart = opening.z - opening.depth / 2;
          const yEnd = opening.z + opening.depth / 2;

          const holePath = new Path();
          holePath.moveTo(xStart, yStart);
          holePath.lineTo(xStart, yEnd);
          holePath.lineTo(xEnd, yEnd);
          holePath.lineTo(xEnd, yStart);
          holePath.closePath();
          ceilingShape.holes.push(holePath);
        }

        return (
          <group key="floor-roof-group">
            {uiState.seeThroughMode !== 'studsOnly' && (
              <mesh
                position={[0, topElevation, 0]}
                rotation={[-Math.PI / 2, 0, 0]}
                castShadow
                receiveShadow
                onClick={(e) => {
                  e.stopPropagation();
                  selectObject('floor-roof', 'floor');
                }}
              >
                <extrudeGeometry args={[ceilingShape, { depth: 0.15, bevelEnabled: false }]} />
                <meshStandardMaterial {...matProps} roughness={0.8} />
              </mesh>
            )}
          </group>
        );
      })()}
      {/* Roof: only render if we are viewing all floors or the highest floor */}
      {uiState.viewMode !== 'topDown' && (uiState.currentFloorView === -1 || uiState.currentFloorView === totalFloors - 1 || uiState.currentFloorView === totalFloors) && renderRoof()}

      {/* 2x4 Framing & Foundation Layer */}
      {(() => {
        const state = useProjectStore.getState();
        const framingMembers = generateFraming(state);

        // Filter: in solid mode, only render screws. In seeThrough and studsOnly, render all.
        const visibleMembers = uiState.seeThroughMode === 'solid'
          ? framingMembers.filter(m => m.type === 'screw')
          : framingMembers;

        if (visibleMembers.length === 0) return null;

        return (
          <group>
            {visibleMembers.map((member) => {
              const memberLevel = getMemberLevel(member.id);
              const isRoofMember = member.type === 'rafter' || member.type === 'ridge' || member.id.includes('roof-');

              // If top-down view, hide roof members
              if (uiState.viewMode === 'topDown' && isRoofMember) {
                return null;
              }

              // In top-down view, we only show the active level (screws only on level 0)
              if (uiState.viewMode === 'topDown') {
                if (member.type === 'screw') {
                  if (activeFloorLevel !== 0) return null;
                } else {
                  if (memberLevel !== activeFloorLevel) return null;
                }
              } else if (uiState.currentFloorView !== -1) {
                const isTopFloorView = uiState.currentFloorView === totalFloors - 1 || uiState.currentFloorView === totalFloors;
                if (memberLevel !== uiState.currentFloorView && !(isRoofMember && isTopFloorView)) {
                  return null;
                }
              }

              let woodColor = '#d2b48c'; // standard lumber tan
              if (member.type === 'plate') woodColor = '#cdaa7d'; // slightly darker
              if (member.type === 'header') woodColor = '#b58a5c'; // structural header color
              if (member.type === 'rafter' || member.type === 'ridge') woodColor = '#cd853f'; // rafters color
              if (member.type === 'screw') woodColor = '#7f8c8d'; // steel gray for ground screws
              
              const wallMatch = member.id.match(/(floor-\d+-wall-(?:front|back|left|right))/);
              const isSelected = uiState.selectedId && (
                uiState.selectedId === member.id || 
                (wallMatch && uiState.selectedId === wallMatch[1]) ||
                (member.wallId && uiState.selectedId === member.wallId) ||
                (member.id.includes('roof') && !member.id.includes('floor-roof') && uiState.selectedId === 'roof') ||
                (() => {
                  const memberLevel = getMemberLevel(member.id);
                  if (memberLevel !== -1) {
                    const isFloorSelected = uiState.selectedId === (memberLevel === totalFloors ? 'floor-roof' : `floor-${memberLevel}`);
                    if (isFloorSelected) {
                      // Only highlight floor frame members, not wall members
                      return !member.id.startsWith('wall-');
                    }
                  }
                  return false;
                })()
              );
              
              const memberColor = isSelected ? '#ff8c00' : woodColor;

              const handleClick = (e: any) => {
                e.stopPropagation();
                if (member.wallId && member.wallId.startsWith('internal-')) {
                  selectObject(member.wallId, 'wall');
                } else if (wallMatch) {
                  selectObject(wallMatch[1], 'wall');
                } else if (member.id.includes('roof') && !member.id.includes('floor-roof')) {
                  selectObject('roof', 'roof');
                } else {
                  const memberLevel = getMemberLevel(member.id);
                  if (memberLevel !== -1) {
                    if (memberLevel === totalFloors) {
                      selectObject('floor-roof', 'floor');
                    } else {
                      selectObject(`floor-${memberLevel}`, 'floor');
                    }
                  }
                }
              };

              const handlePointerOver = (e: any) => {
                e.stopPropagation();
                document.body.style.cursor = 'pointer';
              };
              const handlePointerOut = (e: any) => {
                e.stopPropagation();
                document.body.style.cursor = 'auto';
              };

              // Render steel ground screws as cylinders
              if (member.type === 'screw') {
                const diameter = member.size[0];
                const length = member.size[1];
                return (
                  <mesh
                    key={member.id}
                    position={member.position}
                    rotation={[member.rotation[0], member.rotation[1], member.rotation[2], 'YXZ']}
                    castShadow
                    receiveShadow
                    onClick={handleClick}
                    onPointerOver={handlePointerOver}
                    onPointerOut={handlePointerOut}
                  >
                    <cylinderGeometry args={[diameter / 2, 0.005, length, 12]} />
                    <meshStandardMaterial color={memberColor} metalness={0.8} roughness={0.3} />
                  </mesh>
                );
              }

              // Special rendering for mitered rafters
              if (member.type === 'rafter' && member.id.includes('saddle')) {
                const [width, height, thickness] = member.size;
                const rafterLength = width;
                const rafterHeight = height;
                const rafterThickness = thickness;
                
                const theta = roof.inclination * Math.PI / 180;
                const tanTheta = Math.tan(theta);
                
                const isLeftRafter = member.id.includes('left');
                const sign = isLeftRafter ? -1 : 1;
                
                const rafterShape = new Shape();
                const halfL = rafterLength / 2;
                const halfH = rafterHeight / 2;
                
                rafterShape.moveTo(-halfL - sign * halfH * tanTheta, -halfH);
                rafterShape.lineTo(halfL - sign * halfH * tanTheta, -halfH);
                rafterShape.lineTo(halfL + sign * halfH * tanTheta, halfH);
                rafterShape.lineTo(-halfL + sign * halfH * tanTheta, halfH);
                rafterShape.closePath();

                return (
                  <mesh
                    key={member.id}
                    position={[member.position[0], member.position[1], member.position[2] - rafterThickness / 2]}
                    rotation={[member.rotation[0], member.rotation[1], member.rotation[2], 'YXZ']}
                    castShadow
                    receiveShadow
                    onClick={handleClick}
                    onPointerOver={handlePointerOver}
                    onPointerOut={handlePointerOut}
                  >
                    <extrudeGeometry args={[rafterShape, { depth: rafterThickness, bevelEnabled: false }]} />
                    <meshStandardMaterial color={memberColor} roughness={0.9} />
                  </mesh>
                );
              }

              return (
                <mesh
                  key={member.id}
                  position={member.position}
                  rotation={[member.rotation[0], member.rotation[1], member.rotation[2], 'YXZ']}
                  castShadow
                  receiveShadow
                  onClick={handleClick}
                  onPointerOver={handlePointerOver}
                  onPointerOut={handlePointerOut}
                >
                  <boxGeometry args={member.size} />
                  <meshStandardMaterial color={memberColor} roughness={0.9} />
                </mesh>
              );
            })}
          </group>
        );
      })()}
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

function OpeningDragGuides({
  obj,
  length,
  wallThickness,
  isDragging,
  showDimensions
}: {
  obj: any;
  length: number;
  wallThickness: number;
  isDragging: boolean;
  showDimensions: boolean;
}) {
  if (!isDragging || !showDimensions) return null;

  const gapL = obj.position - obj.width / 2;
  const gapR = length - (obj.position + obj.width / 2);
  const hasElevation = obj.elevation > 0.05;

  return (
    <group>
      {/* Left Gap Guide */}
      {gapL > 0.02 && (
        <group>
          {/* Horizontal guide line */}
          <mesh position={[(-obj.position - obj.width / 2) / 2, 0, 0]}>
            <boxGeometry args={[gapL, 0.015, 0.015]} />
            <meshBasicMaterial color="#ff8c00" opacity={0.6} transparent />
          </mesh>
          {/* Left tick mark (at wall start) */}
          <mesh position={[-obj.position, 0, 0]}>
            <boxGeometry args={[0.015, 0.1, 0.015]} />
            <meshBasicMaterial color="#ff8c00" opacity={0.8} transparent />
          </mesh>
          {/* Right tick mark (at opening left edge) */}
          <mesh position={[-obj.width / 2, 0, 0]}>
            <boxGeometry args={[0.015, 0.1, 0.015]} />
            <meshBasicMaterial color="#ff8c00" opacity={0.8} transparent />
          </mesh>
          {/* Left Gap Label */}
          <Html position={[(-obj.position - obj.width / 2) / 2, 0.12, 0]} center>
            <div style={labelStyle}>
              {(gapL * 100).toFixed(0)} cm
            </div>
          </Html>
        </group>
      )}

      {/* Right Gap Guide */}
      {gapR > 0.02 && (
        <group>
          {/* Horizontal guide line */}
          <mesh position={[(obj.width / 2 + (length - obj.position)) / 2, 0, 0]}>
            <boxGeometry args={[gapR, 0.015, 0.015]} />
            <meshBasicMaterial color="#ff8c00" opacity={0.6} transparent />
          </mesh>
          {/* Left tick mark (at opening right edge) */}
          <mesh position={[obj.width / 2, 0, 0]}>
            <boxGeometry args={[0.015, 0.1, 0.015]} />
            <meshBasicMaterial color="#ff8c00" opacity={0.8} transparent />
          </mesh>
          {/* Right tick mark (at wall end) */}
          <mesh position={[length - obj.position, 0, 0]}>
            <boxGeometry args={[0.015, 0.1, 0.015]} />
            <meshBasicMaterial color="#ff8c00" opacity={0.8} transparent />
          </mesh>
          {/* Right Gap Label */}
          <Html position={[(obj.width / 2 + (length - obj.position)) / 2, 0.12, 0]} center>
            <div style={labelStyle}>
              {(gapR * 100).toFixed(0)} cm
            </div>
          </Html>
        </group>
      )}

      {/* Width Label (top center of opening) */}
      <Html position={[0, obj.height / 2 + 0.12, 0]} center>
        <div style={labelStyle}>
          W: {(obj.width * 100).toFixed(0)} cm
        </div>
      </Html>

      {/* Height Label (right side of opening) */}
      <Html position={[obj.width / 2 + 0.15, 0, 0]} center>
        <div style={labelStyle}>
          H: {(obj.height * 100).toFixed(0)} cm
        </div>
      </Html>

      {/* Elevation Guide & Label */}
      {hasElevation && (
        <group>
          {/* Vertical guide line */}
          <mesh position={[-obj.width / 2 - 0.1, -obj.height / 2 - obj.elevation / 2, 0]}>
            <boxGeometry args={[0.015, obj.elevation, 0.015]} />
            <meshBasicMaterial color="#ff8c00" opacity={0.6} transparent />
          </mesh>
          {/* Bottom tick mark (at wall bottom) */}
          <mesh position={[-obj.width / 2 - 0.1, -obj.height / 2 - obj.elevation, 0]}>
            <boxGeometry args={[0.1, 0.015, 0.015]} />
            <meshBasicMaterial color="#ff8c00" opacity={0.8} transparent />
          </mesh>
          {/* Top tick mark (at opening bottom) */}
          <mesh position={[-obj.width / 2 - 0.1, -obj.height / 2, 0]}>
            <boxGeometry args={[0.1, 0.015, 0.015]} />
            <meshBasicMaterial color="#ff8c00" opacity={0.8} transparent />
          </mesh>
          {/* Elevation Label */}
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
