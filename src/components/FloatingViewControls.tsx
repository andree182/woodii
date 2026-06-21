import { useProjectStore } from '../store';

export default function FloatingViewControls() {
  const { uiState, updateUIState, floors } = useProjectStore();

  const cameraMode = uiState.viewMode || '3D';
  const seeThroughMode = uiState.seeThroughMode || 'solid';
  const currentFloor = uiState.currentFloorView;

  return (
    <div style={{
      position: 'absolute',
      top: '20px',
      left: '20px',
      zIndex: 100,
      backgroundColor: 'rgba(26, 26, 26, 0.85)',
      backdropFilter: 'blur(8px)',
      borderRadius: '10px',
      border: '1px solid #444',
      padding: '12px 16px',
      width: '260px',
      fontFamily: 'Inter, system-ui, sans-serif',
      boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px'
    }}>
      {/* Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, color: '#ff8c00', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Viewport Controls</span>
      </div>

      {/* Camera Modes */}
      <div>
        <label style={{ fontSize: '9px', color: '#888', textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Camera View</label>
        <div style={{ display: 'flex', gap: '3px', backgroundColor: '#111', padding: '3px', borderRadius: '6px' }}>
          {([
            { id: '3D', label: '3D Orbit' },
            { id: 'topDown', label: 'Top-down' },
            { id: 'walking', label: 'Walking' }
          ] as const).map((mode) => (
            <button
              key={mode.id}
              onClick={(e) => {
                e.stopPropagation();
                updateUIState({ viewMode: mode.id });
              }}
              style={{
                flex: 1,
                padding: '6px 2px',
                fontSize: '10px',
                backgroundColor: cameraMode === mode.id ? '#ff8c00' : 'transparent',
                border: 'none',
                borderRadius: '4px',
                color: cameraMode === mode.id ? '#000' : '#888',
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'center'
              }}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      {/* Rendering Modes */}
      <div>
        <label style={{ fontSize: '9px', color: '#888', textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: '4px' }}>See-through Mode</label>
        <div style={{ display: 'flex', gap: '3px', backgroundColor: '#111', padding: '3px', borderRadius: '6px' }}>
          {([
            { id: 'solid', label: 'Solid' },
            { id: 'seeThrough', label: 'See-thru' },
            { id: 'studsOnly', label: 'Studs Only' }
          ] as const).map((mode) => (
            <button
              key={mode.id}
              onClick={(e) => {
                e.stopPropagation();
                updateUIState({ seeThroughMode: mode.id });
              }}
              style={{
                flex: 1,
                padding: '6px 2px',
                fontSize: '10px',
                backgroundColor: seeThroughMode === mode.id ? '#ff8c00' : 'transparent',
                border: 'none',
                borderRadius: '4px',
                color: seeThroughMode === mode.id ? '#000' : '#888',
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'center'
              }}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      {/* Viewed Floor */}
      <div>
        <label style={{ fontSize: '9px', color: '#888', textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Active Floor View</label>
        <div style={{ display: 'flex', gap: '3px', backgroundColor: '#111', padding: '3px', borderRadius: '6px', flexWrap: 'wrap' }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              updateUIState({ currentFloorView: -1 });
            }}
            style={{
              flex: '1 1 auto',
              padding: '6px 4px',
              fontSize: '10px',
              backgroundColor: currentFloor === -1 ? '#ff8c00' : 'transparent',
              border: 'none',
              borderRadius: '4px',
              color: currentFloor === -1 ? '#000' : '#888',
              fontWeight: 600,
              cursor: 'pointer',
              textAlign: 'center'
            }}
          >
            All Floors
          </button>
          {floors.map((floor) => (
            <button
              key={floor.id}
              onClick={(e) => {
                e.stopPropagation();
                updateUIState({ currentFloorView: floor.level });
              }}
              style={{
                flex: '1 1 auto',
                padding: '6px 4px',
                fontSize: '10px',
                backgroundColor: currentFloor === floor.level ? '#ff8c00' : 'transparent',
                border: 'none',
                borderRadius: '4px',
                color: currentFloor === floor.level ? '#000' : '#888',
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'center'
              }}
            >
              Lvl {floor.level}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
