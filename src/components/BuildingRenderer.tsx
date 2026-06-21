import { Shape, Path } from 'three';
import { useProjectStore } from '../store';
import FloorRenderer from './renderer/FloorRenderer';
import WallRenderer from './renderer/WallRenderer';
import InternalWallRenderer from './renderer/InternalWallRenderer';
import RoofRenderer from './renderer/RoofRenderer';
import FramingRenderer from './renderer/FramingRenderer';
import { getMaterialProps } from './renderer/materialProps';

export default function BuildingRenderer() {
  const dimensions = useProjectStore((state) => state.dimensions);
  const floors = useProjectStore((state) => state.floors);
  const roof = useProjectStore((state) => state.roof);
  const uiState = useProjectStore((state) => state.uiState);
  const selectObject = useProjectStore((state) => state.selectObject);

  const { width, depth, heightPerFloor } = dimensions;
  const totalFloors = floors.length;
  const topElevation = totalFloors * heightPerFloor;

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
          <FloorRenderer floor={floor} />
          {floor.walls.map((wall) => (
            <WallRenderer key={wall.id} wall={wall} level={floor.level} floorId={floor.id} />
          ))}
          {(floor.internalWalls || []).map((wall) => (
            <InternalWallRenderer key={wall.id} wall={wall} level={floor.level} />
          ))}
        </group>
      ))}

      {/* Ceiling Floor Slab (Attic floor / floor of roof) */}
      {uiState.viewMode !== 'topDown' && (uiState.currentFloorView === -1 || uiState.currentFloorView === totalFloors) && (() => {
        const matProps = getMaterialProps(uiState.selectedId, uiState.seeThroughMode, 'floor-roof', '#666666');
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
      {uiState.viewMode !== 'topDown' && (uiState.currentFloorView === -1 || uiState.currentFloorView === totalFloors - 1 || uiState.currentFloorView === totalFloors) && <RoofRenderer />}

      {/* 2x4 Framing & Foundation Layer */}
      <FramingRenderer />
    </group>
  );
}
