import { Floor } from '../../types';
import { useProjectStore } from '../../store';
import { Shape, Path } from 'three';
import { getMaterialProps } from './materialProps';

export default function FloorRenderer({ floor }: { floor: Floor }) {
  const dimensions = useProjectStore((state) => state.dimensions);
  const selectObject = useProjectStore((state) => state.selectObject);
  const uiState = useProjectStore((state) => state.uiState);
  const foundation = useProjectStore((state) => state.foundation);

  const { width, depth, heightPerFloor } = dimensions;
  const floorY = floor.level * heightPerFloor;
  const matProps = getMaterialProps(uiState.selectedId, uiState.seeThroughMode, floor.id, '#555555');

  const wallThickness = floor.walls[0]?.thickness || 0.15;
  const outerW = width + wallThickness * 0.70;
  const outerD = depth + wallThickness * 0.70;

  const floorShape = new Shape();
  floorShape.moveTo(-outerW / 2, -outerD / 2);
  floorShape.lineTo(outerW / 2, -outerD / 2);
  floorShape.lineTo(outerW / 2, outerD / 2);
  floorShape.lineTo(-outerW / 2, outerD / 2);
  floorShape.closePath();

  if (floor.floorOpening) {
    const opening = floor.floorOpening;
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
    
    floorShape.holes.push(holePath);
  }

  return (
    <group>
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

      {floor.level > 0 && floor.floorOpening && (() => {
        const opening = floor.floorOpening;
        const numSteps = 12;
        const stepHeight = heightPerFloor / numSteps;
        const stepDepth = opening.depth / numSteps;
        const steps = [];
        
        for (let i = 0; i < numSteps; i++) {
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
}
