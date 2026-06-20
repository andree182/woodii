import { DoubleSide, FrontSide, Shape, Path, Plane, Vector3 } from 'three';
import { useProjectStore } from '../store';
import { Wall, Floor } from '../types';
import { generateFraming } from '../utils/framingEngine';

export default function BuildingRenderer() {
  const dimensions = useProjectStore((state) => state.dimensions);
  const floors = useProjectStore((state) => state.floors);
  const roof = useProjectStore((state) => state.roof);
  const uiState = useProjectStore((state) => state.uiState);
  const selectObject = useProjectStore((state) => state.selectObject);
  const startDragging = useProjectStore((state) => state.startDragging);
  const stopDragging = useProjectStore((state) => state.stopDragging);
  const updateDragPosition = useProjectStore((state) => state.updateDragPosition);

  const { width, depth, heightPerFloor } = dimensions;
  const totalFloors = floors.length;
  const topElevation = totalFloors * heightPerFloor;

  // Helper to determine material properties based on selection and see-through mode
  const getMaterialProps = (id: string, _type: 'wall' | 'subObject' | 'roof' | 'floor', defaultColor: string) => {
    const isSelected = uiState.selectedId === id;
    const mode = uiState.seeThroughMode;
    
    let color = isSelected ? '#ff8c00' : defaultColor;
    let opacity = 1.0;
    let transparent = false;
    let wireframe = false;
    let side = 0; // FrontSide by default

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
        {uiState.seeThroughMode !== 'studsOnly' && (
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
    const matProps = getMaterialProps(wallId, 'wall', '#b0a090');

    // Check if we need to apply flat roof slope adjustment to this wall
    const isTopFloor = level === totalFloors - 1;
    const isFlatRoof = roof.type === 'flat';
    const angleRad = (roof.inclination * Math.PI) / 180;
    
    let customHeight = heightPerFloor;

    if (isTopFloor && isFlatRoof) {
      if (wall.id === 'wall-left') {
        customHeight = heightPerFloor + width * Math.tan(angleRad);
      } else if (wall.id === 'wall-right') {
        customHeight = heightPerFloor;
      }
    }

    // Compute flat roof heights for front/back walls
    const hLeft = heightPerFloor + (width + wall.thickness) * Math.tan(angleRad);
    const hRight = heightPerFloor;

    const createWallShape = (xStartOffset: number, xEndOffset: number) => {
      const shape = new Shape();
      shape.moveTo(xStartOffset, 0);
      shape.lineTo(length - xEndOffset, 0);

      const isBack = wall.id === 'wall-back';
      if (isTopFloor && isFlatRoof && (wall.id === 'wall-front' || wall.id === 'wall-back')) {
        const slopeStartHeight = isBack ? hRight : hLeft;
        const slopeEndHeight = isBack ? hLeft : hRight;
        
        const yStart = slopeStartHeight + (xStartOffset / length) * (slopeEndHeight - slopeStartHeight);
        const yEnd = slopeStartHeight + ((length - xEndOffset) / length) * (slopeEndHeight - slopeStartHeight);

        shape.lineTo(length - xEndOffset, yEnd);
        shape.lineTo(xStartOffset, yStart);
      } else {
        shape.lineTo(length - xEndOffset, customHeight);
        shape.lineTo(xStartOffset, customHeight);
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
          const T = wall.thickness;
          const isSelected = uiState.selectedId === wallId;
          const mode = uiState.seeThroughMode;

          // Layer definitions: [keySuffix, localZOffset, depth, defaultColor, defaultOpacity]
          // Outer cladding is on the positive local Z side (+T/2), inner drywall is on the negative local Z side (-T/2)
          const isSideWall = wall.id === 'wall-left' || wall.id === 'wall-right';
          const layers = [
            {
              suffix: 'outer',
              zOffset: T / 2 - T * 0.15,
              depth: T * 0.15,
              color: '#8b5a2b', // Wood siding brown
              opacity: mode === 'seeThrough' ? 0.15 : 1.0,
              xStartOffset: isSideWall ? -T : T * 0.15,
              xEndOffset: isSideWall ? -T : T * 0.15,
            },
            {
              suffix: 'middle',
              zOffset: -T / 2 + T * 0.15,
              depth: T * 0.70,
              color: '#ded29e', // Rockwool insulation yellow
              opacity: mode === 'seeThrough' ? 0.25 : 1.0,
              xStartOffset: isSideWall ? -T * 0.15 : T * 0.15,
              xEndOffset: isSideWall ? -T * 0.15 : T * 0.15,
            },
            {
              suffix: 'inner',
              zOffset: -T / 2,
              depth: T * 0.15,
              color: '#e6e6e6', // Drywall off-white
              opacity: mode === 'seeThrough' ? 0.5 : 1.0,
              xStartOffset: isSideWall ? -T * 0.15 : T * 0.85,
              xEndOffset: isSideWall ? -T * 0.15 : T * 0.85,
            }
          ];

          return (
            <group>
              {layers.map((layer) => {
                const layerColor = isSelected ? '#ff8c00' : layer.color;
                const layerOpacity = isSelected ? Math.min(1.0, layer.opacity + 0.15) : layer.opacity;
                const isTransparent = mode === 'seeThrough';
                const shape = createWallShape(layer.xStartOffset, layer.xEndOffset);

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
              startDragging(wallId, 'wallHandle');
              e.target.setPointerCapture(e.pointerId);
            }}
            onPointerUp={(e) => {
              e.stopPropagation();
              stopDragging();
              e.target.releasePointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (uiState.isDragging && uiState.draggedId === wallId) {
                e.stopPropagation();
                const floorPlane = new Plane(new Vector3(0, 1, 0), -(level * heightPerFloor + customHeight / 2));
                const intersection = new Vector3();
                e.ray.intersectPlane(floorPlane, intersection);
                updateDragPosition([intersection.x, intersection.y, intersection.z]);
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
        {wall.subObjects.map((obj) => {
          const isDoor = obj.type === 'door';
          const isWindow = obj.type === 'window';
          const isOpening = obj.type === 'opening';

          const defaultElevation = isDoor ? 0 : (isWindow ? 0.9 : 0);
          const currentElevation = obj.elevation !== undefined ? obj.elevation : defaultElevation;
          
          let localWallHeightAtObj = customHeight;
          if (isTopFloor && isFlatRoof && (wall.id === 'wall-front' || wall.id === 'wall-back')) {
            localWallHeightAtObj = isBack
              ? hRight + obj.position * Math.tan(angleRad)
              : hLeft - obj.position * Math.tan(angleRad);
          }
          const clampedElevation = Math.max(0, Math.min(Math.max(0, localWallHeightAtObj - obj.height), currentElevation));
          
          const localY = clampedElevation + obj.height / 2;
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
                  startDragging(objId, 'subObject');
                  e.target.setPointerCapture(e.pointerId);
                }}
                onPointerUp={(e) => {
                  e.stopPropagation();
                  stopDragging();
                  e.target.releasePointerCapture(e.pointerId);
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
                    e.ray.intersectPlane(wallPlane, intersection);
                    updateDragPosition([intersection.x, intersection.y, intersection.z]);
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
                const T = wallThickness;
                const isSelected = uiState.selectedId === 'roof';
                const mode = uiState.seeThroughMode;
                const layers = [
                  { suffix: 'outer', zOffset: T * 0.85, depth: T * 0.15, color: '#8b5a2b', opacity: mode === 'seeThrough' ? 0.15 : 1.0, xOffset: T * 0.15 },
                  { suffix: 'middle', zOffset: T * 0.15, depth: T * 0.70, color: '#ded29e', opacity: mode === 'seeThrough' ? 0.25 : 1.0, xOffset: T * 0.15 },
                  { suffix: 'inner', zOffset: 0, depth: T * 0.15, color: '#e6e6e6', opacity: mode === 'seeThrough' ? 0.5 : 1.0, xOffset: T * 0.85 }
                ];
                return (
                  <group position={[0, topElevation, depth / 2 - T / 2]} rotation={[0, 0, 0]}>
                    {layers.map((layer) => {
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
                const T = wallThickness;
                const isSelected = uiState.selectedId === 'roof';
                const mode = uiState.seeThroughMode;
                const layers = [
                  { suffix: 'outer', zOffset: T * 0.85, depth: T * 0.15, color: '#8b5a2b', opacity: mode === 'seeThrough' ? 0.15 : 1.0, xOffset: T * 0.15 },
                  { suffix: 'middle', zOffset: T * 0.15, depth: T * 0.70, color: '#ded29e', opacity: mode === 'seeThrough' ? 0.25 : 1.0, xOffset: T * 0.15 },
                  { suffix: 'inner', zOffset: 0, depth: T * 0.15, color: '#e6e6e6', opacity: mode === 'seeThrough' ? 0.5 : 1.0, xOffset: T * 0.85 }
                ];
                return (
                  <group position={[0, topElevation, -depth / 2 + T / 2]} rotation={[0, Math.PI, 0]}>
                    {layers.map((layer) => {
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

  // Hide components if single floor view is active and we are on a higher floor
  const visibleFloors = uiState.currentFloorView === -1
    ? floors
    : floors.filter((f) => f.level === uiState.currentFloorView);

  return (
    <group>
      {/* Floors and their walls */}
      {visibleFloors.map((floor) => (
        <group key={floor.id}>
          {renderFloorSlab(floor)}
          {floor.walls.map((wall) => renderWall(wall, floor.level, floor.id))}
        </group>
      ))}

      {/* Roof: only render if we are viewing all floors or the highest floor */}
      {(uiState.currentFloorView === -1 || uiState.currentFloorView === totalFloors - 1) && renderRoof()}

      {/* 2x4 Framing Layer: render in studsOnly and seeThrough modes */}
      {uiState.seeThroughMode !== 'solid' && (() => {
        const state = useProjectStore.getState();
        const framingMembers = generateFraming(state);

        return (
          <group>
            {framingMembers.map((member) => {
              if (uiState.currentFloorView !== -1) {
                const isFloorMember = member.id.includes(`floor-${uiState.currentFloorView}`) || 
                                      member.id.includes(`-floor-${uiState.currentFloorView}`) ||
                                      (member.type === 'joist' && member.id.endsWith(`-${uiState.currentFloorView}`));
                
                const isWallMember = member.id.includes(`floor-${uiState.currentFloorView}`);
                
                const isRoofMember = member.type === 'rafter' || member.type === 'ridge';
                const isTopFloorView = uiState.currentFloorView === totalFloors - 1;

                if (!isFloorMember && !isWallMember && !(isRoofMember && isTopFloorView)) {
                  return null;
                }
              }

              let woodColor = '#d2b48c'; // standard lumber tan
              if (member.type === 'plate') woodColor = '#cdaa7d'; // slightly darker
              if (member.type === 'header') woodColor = '#b58a5c'; // structural header color
              if (member.type === 'rafter' || member.type === 'ridge') woodColor = '#cd853f'; // rafters color
              
              const wallMatch = member.id.match(/(floor-\d+-wall-(?:front|back|left|right))/);
              const isSelected = uiState.selectedId && (
                uiState.selectedId === member.id || 
                (wallMatch && uiState.selectedId === wallMatch[1]) ||
                (member.id.includes('roof') && uiState.selectedId === 'roof') ||
                (member.id.includes('floor-') && uiState.selectedId === `floor-${member.id.match(/floor-.*?-(\d+)/)?.[1]}`)
              );
              
              const memberColor = isSelected ? '#ff8c00' : woodColor;

              const handleClick = (e: any) => {
                e.stopPropagation();
                if (wallMatch) {
                  selectObject(wallMatch[1], 'wall');
                } else if (member.id.includes('roof')) {
                  selectObject('roof', 'roof');
                } else {
                  const fMatch = member.id.match(/floor-.*?-(\d+)/) || member.id.match(/floor-joist-(\d+)/) || member.id.match(/floor-opening-.*?-\d+-(\d+)/);
                  if (fMatch) {
                    selectObject(`floor-${fMatch[1]}`, 'floor');
                  }
                }
              };

              const handlePointerOver = (e: any) => {
                e.stopPropagation();
                document.body.style.cursor = 'pointer';
              };
              const handlePointerOut = (e: any) => {
                e.stopPropagation();
                document.body.style.cursor = 'default';
              };

              if (member.type === 'rafter') {
                const L = member.size[0];
                const H = member.size[1];
                const rafterThickness = member.size[2];
                const theta = member.rotation[2]; // Z rotation is the tilt angle

                const rafterShape = new Shape();
                const halfL = L / 2;
                const halfH = H / 2;
                const tanTheta = Math.tan(theta);

                rafterShape.moveTo(-halfL - halfH * tanTheta, -halfH);
                rafterShape.lineTo(halfL - halfH * tanTheta, -halfH);
                rafterShape.lineTo(halfL + halfH * tanTheta, halfH);
                rafterShape.lineTo(-halfL + halfH * tanTheta, halfH);
                rafterShape.closePath();

                return (
                  <mesh
                    key={member.id}
                    position={[member.position[0], member.position[1], member.position[2] - rafterThickness / 2]}
                    rotation={member.rotation}
                    rotationOrder="YXZ"
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
                  rotation={member.rotation}
                  rotationOrder="YXZ"
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
