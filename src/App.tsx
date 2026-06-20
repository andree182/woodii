import ThreeCanvas from './components/ThreeCanvas';
import Sidebar from './components/Sidebar';

function App() {
  return (
    <div style={{
      display: 'flex',
      width: '100vw',
      height: '100vh',
      overflow: 'hidden',
      backgroundColor: '#111'
    }}>
      {/* 3D Canvas occupy all remaining space */}
      <div style={{ flex: 1, height: '100%' }}>
        <ThreeCanvas />
      </div>
      
      {/* Controls sidebar */}
      <Sidebar />
    </div>
  );
}

export default App;
