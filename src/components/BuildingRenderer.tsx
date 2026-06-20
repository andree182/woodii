import { DoubleSide, Shape } from 'three';
import { useProjectStore } from '../store';
import { Wall, Floor } from '../types';

export default function BuildingRenderer() {
  const dimensions = useProjectStore((state) => state.dimensions);
  const floors = useProjectStore((state) => state.floors);
  const roof = useProjectStore((state) => state.roof);
  const uiState = useProjectStore((state) => state.uiState);
  const selectObject = useProjectStore((state) => state.selectObject);

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

    return (
      <group key={floor.id}>
        <mesh
          position={[0, floorY - 0.075, 0]}
          castShadow
          receiveShadow
          onClick={(e) => {
            e.stopPropagation();
            selectObject(floor.id, 'floor');
          }}
        >
          <boxGeometry args={[width, 0.15, depth]} />
          <meshStandardMaterial {...matProps} roughness={0.8} />
        </mesh>
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

    // Direction vector for placing sub-objects
    const ux = dx / length;
    const uz = dz / length;

    // Check if we need to apply flat roof slope adjustment to this wall
    const isTopFloor = level === totalFloors - 1;
    const isFlatRoof = roof.type === 'flat';
    const angleRad = (roof.inclination * Math.PI) / 180;
    
    // Sloped wall specific calculations
    let useSlopeGeometry = false;
    let slopedWallShape: Shape | null = null;
    let customHeight = heightPerFloor;
    let customCenterY = level * heightPerFloor + heightPerFloor / 2;

    if (isTopFloor && isFlatRoof) {
      if (wall.id === 'wall-left') {
        customHeight = heightPerFloor + (width / 2) * Math.tan(angleRad);
        customCenterY = level * heightPerFloor + customHeight / 2;
      } else if (wall.id === 'wall-right') {
        customHeight = heightPerFloor - (width / 2) * Math.tan(angleRad);
        customCenterY = level * heightPerFloor + customHeight / 2;
      } else if (wall.id === 'wall-front' || wall.id === 'wall-back') {
        useSlopeGeometry = true;
        const halfWallW = length / 2;
        const hLeft = heightPerFloor + (width / 2 + wall.thickness * 0.5) * Math.tan(angleRad);
        const hRight = heightPerFloor - (width / 2 + wall.thickness * 0.5) * Math.tan(angleRad);

        // Wall Back is mirror-inverted because its coordinates run in the opposite direction (from right to left)
        const isBack = wall.id === 'wall-back';
        const hStart = isBack ? hRight : hLeft;
        const hEnd = isBack ? hLeft : hRight;

        slopedWallShape = new Shape();
        slopedWallShape.moveTo(-halfWallW, 0);
        slopedWallShape.lineTo(halfWallW, 0);
        slopedWallShape.lineTo(halfWallW, hEnd);
        slopedWallShape.lineTo(-halfWallW, hStart);
        slopedWallShape.closePath();
      }
    }

    // Wall center coordinates
    const wallCenterX = (startX + endX) / 2;
    const wallCenterZ = (startZ + endZ) / 2;

    return (
      <group key={wallId}>
        {/* Wall body */}
        {useSlopeGeometry && slopedWallShape ? (
          <group position={[wallCenterX, 0, wallCenterZ]} rotation={[0, rotationY, 0]}>
            <mesh
              position={[0, level * heightPerFloor, -wall.thickness / 2]}
              castShadow
              receiveShadow
              onClick={(e) => {
                e.stopPropagation();
                selectObject(wallId, 'wall');
              }}
            >
              <extrudeGeometry args={[slopedWallShape, { depth: wall.thickness, bevelEnabled: false }]} />
              <meshStandardMaterial {...matProps} roughness={0.7} />
            </mesh>
          </group>
        ) : (
          <group
            position={[wallCenterX, customCenterY, wallCenterZ]}
            rotation={[0, rotationY, 0]}
          >
            <mesh
              castShadow
              receiveShadow
              onClick={(e) => {
                e.stopPropagation();
                selectObject(wallId, 'wall');
              }}
            >
              <boxGeometry args={[length, customHeight, wall.thickness]} />
              <meshStandardMaterial {...matProps} roughness={0.7} />
            </mesh>
          </group>
        )}

        {/* Sub-objects (windows and doors) */}
        {wall.subObjects.map((obj) => {
          // Object 2D position along the wall
          const objX = startX + ux * obj.position;
          const objZ = startZ + uz * obj.position;
          
          // Y positioning: doors touch the floor, windows are centered or elevated
          const isDoor = obj.type === 'door';
          let localWallHeight = customHeight;

          if (isTopFloor && isFlatRoof && (wall.id === 'wall-front' || wall.id === 'wall-back')) {
            const isBack = wall.id === 'wall-back';
            const hLeft = heightPerFloor + (width / 2 + wall.thickness * 0.5) * Math.tan(angleRad);
            const hRight = heightPerFloor - (width / 2 + wall.thickness * 0.5) * Math.tan(angleRad);
            localWallHeight = isBack
              ? hRight + obj.position * Math.tan(angleRad)
              : hLeft - obj.position * Math.tan(angleRad);
          }

          const objY = level * heightPerFloor + (isDoor ? obj.height / 2 : localWallHeight / 2);
          
          const objId = obj.id;
          const objMatProps = getMaterialProps(objId, 'subObject', obj.color || '#a0d0f0');

          return (
            <mesh
              key={objId}
              position={[objX, objY, objZ]}
              rotation={[0, rotationY, 0]}
              castShadow
              receiveShadow
              onClick={(e) => {
                e.stopPropagation();
                selectObject(objId, 'subObject');
              }}
            >
              {/* Box representation for Phase 2 */}
              <boxGeometry args={[obj.width, obj.height, wall.thickness + 0.04]} />
              <meshStandardMaterial 
                {...objMatProps} 
                roughness={0.3} 
                metalness={obj.type === 'window' ? 0.9 : 0.1}
              />
            </mesh>
          );
        })}
      </group>
    );
  };

  // Render the roof
  const renderRoof = () => {
    const matProps = getMaterialProps('roof', 'roof', '#a05040');
    const { overhang, inclination, thickness, type } = roof;
    const angleRad = (inclination * Math.PI) / 180;

    if (type === 'flat') {
      const roofWidth = width / Math.cos(angleRad) + overhang * 2;
      const roofDepth = depth + overhang * 2;
      const tVertical = thickness / Math.cos(angleRad);
      
      return (
        <mesh
          position={[0, topElevation + tVertical * 0.5, 0]}
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
      const halfRoofWidth = width / 2 + overhang;
      const tVertical = thickness / Math.cos(angleRad);
      
      const roofDepth = depth + overhang * 2;

      // Create mitered shapes in X-Y plane where bottom face rests exactly on top-plate (Y = topElevation) at X = +/- W/2
      const rightSlopeShape = new Shape();
      rightSlopeShape.moveTo(0, topElevation + (width / 2) * Math.tan(angleRad) + tVertical);
      rightSlopeShape.lineTo(0, topElevation + (width / 2) * Math.tan(angleRad));
      rightSlopeShape.lineTo(halfRoofWidth, topElevation - overhang * Math.tan(angleRad));
      rightSlopeShape.lineTo(halfRoofWidth, topElevation - overhang * Math.tan(angleRad) + tVertical);
      rightSlopeShape.closePath();

      const leftSlopeShape = new Shape();
      leftSlopeShape.moveTo(0, topElevation + (width / 2) * Math.tan(angleRad) + tVertical);
      leftSlopeShape.lineTo(0, topElevation + (width / 2) * Math.tan(angleRad));
      leftSlopeShape.lineTo(-halfRoofWidth, topElevation - overhang * Math.tan(angleRad));
      leftSlopeShape.lineTo(-halfRoofWidth, topElevation - overhang * Math.tan(angleRad) + tVertical);
      leftSlopeShape.closePath();

      // Create a flat triangular shape for the gable wall (spans exactly wall width + thickness)
      const wallThickness = floors[0]?.walls[0]?.thickness || 0.15;
      const halfGableWidth = width / 2 + wallThickness * 0.5;
      const gableShape = new Shape();
      gableShape.moveTo(-halfGableWidth, 0);
      gableShape.lineTo(0, halfGableWidth * Math.tan(angleRad));
      gableShape.lineTo(halfGableWidth, 0);
      gableShape.closePath();

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

          {/* Gable walls (flat triangular front and back closures) */}
          {!matProps.wireframe && (
            <>
              {/* Front Gable */}
              <mesh position={[0, topElevation, depth / 2]} rotation={[0, 0, 0]}>
                <shapeGeometry args={[gableShape]} />
                <meshStandardMaterial color="#b0a090" roughness={0.7} side={DoubleSide} />
              </mesh>
              {/* Back Gable */}
              <mesh position={[0, topElevation, -depth / 2]} rotation={[0, Math.PI, 0]}>
                <shapeGeometry args={[gableShape]} />
                <meshStandardMaterial color="#b0a090" roughness={0.7} side={DoubleSide} />
              </mesh>
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
    </group>
  );
}
