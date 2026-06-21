import { Suspense, useEffect, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, PointerLockControls, OrthographicCamera, PerspectiveCamera } from '@react-three/drei';
import { useProjectStore } from '../store';
import BuildingRenderer from './BuildingRenderer';
import { Vector3 } from 'three';

const ORTHO_POS: [number, number, number] = [0, 15, 0.001];
const PERSPECT_POS: [number, number, number] = [6, 6, 8];

// walking controller handles keyboard movement inside house footprints
function WalkingController({ heightPerFloor, currentFloor, buildingWidth, buildingDepth }: { heightPerFloor: number, currentFloor: number, buildingWidth: number, buildingDepth: number }) {
  const { camera } = useThree();
  const keys = useRef<{ [key: string]: boolean }>({});
  
  useEffect(() => {
    const floorY = Math.max(0, currentFloor) * heightPerFloor;
    camera.position.set(0, floorY + 1.6, 2.5); // look from entrance
    camera.lookAt(0, floorY + 1.6, 0);
  }, [currentFloor, heightPerFloor, camera]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        keys.current[key] = true;
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        keys.current[key] = false;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const moveDirection = new Vector3();
  const forward = new Vector3();
  const right = new Vector3();

  useFrame((_, delta) => {
    const speed = 2.5;
    const moveSpeed = speed * delta;
    
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    
    right.crossVectors(forward, camera.up);
    right.y = 0;
    right.normalize();

    moveDirection.set(0, 0, 0);

    if (keys.current['w'] || keys.current['arrowup']) moveDirection.add(forward);
    if (keys.current['s'] || keys.current['arrowdown']) moveDirection.sub(forward);
    if (keys.current['d'] || keys.current['arrowright']) moveDirection.add(right);
    if (keys.current['a'] || keys.current['arrowleft']) moveDirection.sub(right);

    if (moveDirection.lengthSq() > 0) {
      moveDirection.normalize().multiplyScalar(moveSpeed);
      camera.position.add(moveDirection);
    }

    // footprint clamping with safety bounds (e.g. wall thickness 0.15 + clearance)
    const margin = 0.25;
    const maxX = buildingWidth / 2 - margin;
    const maxZ = buildingDepth / 2 - margin;
    camera.position.x = Math.max(-maxX, Math.min(maxX, camera.position.x));
    camera.position.z = Math.max(-maxZ, Math.min(maxZ, camera.position.z));

    const floorY = Math.max(0, currentFloor) * heightPerFloor;
    camera.position.y = floorY + 1.6;
  });

  return null;
}

// camera updater resets views and focus targets when view mode changes
function CameraUpdater({ viewMode, currentFloor, heightPerFloor }: { viewMode: string; currentFloor: number; heightPerFloor: number }) {
  const { camera, controls } = useThree();
  const lastViewMode = useRef<string | null>(null);

  useEffect(() => {
    if (viewMode === 'topDown') {
      const targetY = Math.max(0, currentFloor) * heightPerFloor;
      camera.position.set(0, targetY + 12, 0.001); // 0.001 to prevent lookAt gimbal skew
      camera.lookAt(0, targetY, 0);
      if (controls && (controls as any).target) {
        (controls as any).target.set(0, targetY, 0);
        (controls as any).update();
      }
    } else if (viewMode === '3D' && lastViewMode.current !== '3D') {
      camera.position.set(6, 6, 8);
      camera.lookAt(0, 1.2, 0);
      if (controls && (controls as any).target) {
        (controls as any).target.set(0, 1.2, 0);
        (controls as any).update();
      }
    }
    lastViewMode.current = viewMode;
  }, [viewMode, currentFloor, heightPerFloor, camera, controls]);

  return null;
}

export default function ThreeCanvas() {
  const selectObject = useProjectStore((state) => state.selectObject);
  const isDragging = useProjectStore((state) => state.uiState.isDragging);
  const viewMode = useProjectStore((state) => state.uiState.viewMode || '3D');
  const currentFloor = useProjectStore((state) => state.uiState.currentFloorView);
  const dimensions = useProjectStore((state) => state.dimensions);

  const { width, depth, heightPerFloor } = dimensions;

  // Release pointer lock when switching away from walking mode
  useEffect(() => {
    if (viewMode !== 'walking' && document.pointerLockElement) {
      try {
        document.exitPointerLock();
      } catch (err) {
        console.error("Failed to exit pointer lock:", err);
      }
    }
  }, [viewMode]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#1a1a1a' }}>
      <Canvas
        camera={{ position: [6, 6, 8], fov: 50 }}
        shadows
        onPointerMissed={() => selectObject(null, null)}
      >
        <ambientLight intensity={0.6} />
        <directionalLight
          position={[10, 15, 10]}
          intensity={1.2}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.0001}
        />
        <directionalLight position={[-10, 8, -10]} intensity={0.4} />
        
        <Suspense fallback={null}>
          <BuildingRenderer />
        </Suspense>

        {viewMode === 'topDown' ? (
          <OrthographicCamera
            makeDefault
            position={ORTHO_POS}
            zoom={60}
            near={0.1}
            far={100}
          />
        ) : (
          <PerspectiveCamera
            makeDefault
            position={PERSPECT_POS}
            fov={50}
            near={0.1}
            far={100}
          />
        )}

        <CameraUpdater viewMode={viewMode} currentFloor={currentFloor} heightPerFloor={heightPerFloor} />

        {viewMode === '3D' && (
          <OrbitControls makeDefault enabled={!isDragging} maxPolarAngle={Math.PI / 2 - 0.05} minDistance={2} maxDistance={30} />
        )}
        {viewMode === 'topDown' && (
          <OrbitControls makeDefault enableRotate={false} enabled={!isDragging} minZoom={10} maxZoom={300} />
        )}
        {viewMode === 'walking' && (
          <>
            <PointerLockControls makeDefault />
            <WalkingController heightPerFloor={heightPerFloor} currentFloor={currentFloor} buildingWidth={width} buildingDepth={depth} />
          </>
        )}
        
        {/* Ground grid for architectural scale */}
        <Grid
          renderOrder={-1}
          position={[0, -0.01, 0]}
          args={[30, 30]}
          cellSize={0.5}
          cellThickness={0.5}
          cellColor="#6f6f6f"
          sectionSize={2.5}
          sectionThickness={1.2}
          sectionColor="#9f9f9f"
          fadeDistance={30}
        />
      </Canvas>

      {/* Walking Controls Overlay */}
      {viewMode === 'walking' && (
        <div style={{
          position: 'absolute',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          color: '#ffffff',
          padding: '10px 20px',
          borderRadius: '8px',
          fontFamily: 'sans-serif',
          fontSize: '12px',
          pointerEvents: 'none',
          zIndex: 10,
          textAlign: 'center',
          border: '1px solid #ff8c00',
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
        }}>
          <strong>Walking Mode Active</strong><br />
          Click view to lock cursor & look around<br />
          Move with <strong>W, A, S, D</strong> / <strong>Arrows</strong><br />
          Press <strong>ESC</strong> to unlock cursor
        </div>
      )}
    </div>
  );
}
