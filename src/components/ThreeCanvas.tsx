import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import { useProjectStore } from '../store';
import BuildingRenderer from './BuildingRenderer';

export default function ThreeCanvas() {
  const selectObject = useProjectStore((state) => state.selectObject);

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

        <OrbitControls makeDefault maxPolarAngle={Math.PI / 2 - 0.05} minDistance={2} maxDistance={30} />
        
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
    </div>
  );
}
