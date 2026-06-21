import { useEffect } from 'react';
import ThreeCanvas from './components/ThreeCanvas';
import Sidebar from './components/Sidebar';
import FloatingViewControls from './components/FloatingViewControls';
import HelpModal from './components/HelpModal';
import { useProjectStore } from './store';

function App() {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input element
      const activeEl = document.activeElement;
      if (activeEl && (
        activeEl.tagName === 'INPUT' ||
        activeEl.tagName === 'TEXTAREA' ||
        activeEl.tagName === 'SELECT' ||
        (activeEl as HTMLElement).isContentEditable
      )) {
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        const state = useProjectStore.getState();
        const { selectedId, selectedType } = state.uiState;
        if (selectedType === 'subObject' && selectedId) {
          let parentWallId = '';
          for (const floor of state.floors) {
            for (const wall of floor.walls) {
              if (wall.subObjects.some(obj => obj.id === selectedId)) {
                parentWallId = `${floor.id}-${wall.id}`;
                break;
              }
            }
            if (parentWallId) break;
          }

          if (parentWallId) {
            e.preventDefault();
            state.removeSubObject(parentWallId, selectedId);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <div style={{
      display: 'flex',
      width: '100vw',
      height: '100vh',
      overflow: 'hidden',
      backgroundColor: '#111'
    }}>
      {/* 3D Canvas occupy all remaining space */}
      <div style={{ flex: 1, height: '100%', position: 'relative' }}>
        <ThreeCanvas />
        <FloatingViewControls />
      </div>
      
      {/* Controls sidebar */}
      <Sidebar />

      {/* Interactive Guide Overlay */}
      <HelpModal />
    </div>
  );
}

export default App;
