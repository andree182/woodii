import { useProjectStore } from '../store';
import { BuildingType } from '../types';

export default function Sidebar() {
  const {
    buildingType,
    dimensions,
    roof,
    uiState,
    floors,
    setBuildingType,
    setDimensions,
    setRoofConfig,
    updateUIState,
    addFloor,
    removeLastFloor,
    selectObject,
    addSubObject,
    removeSubObject,
    updateSubObject,
    resetProject,
  } = useProjectStore();

  const selectedId = uiState.selectedId;
  const selectedType = uiState.selectedType;

  // Find currently selected object if any
  let selectedWall: any = null;
  let selectedSubObj: any = null;
  let parentWallIdOfSubObj: string = '';

  if (selectedType === 'wall' && selectedId) {
    // Expected id format: floorId-wallId (e.g. floor-0-wall-front)
    const parts = selectedId.split('-');
    const floorId = `${parts[0]}-${parts[1]}`;
    const wallId = parts.slice(2).join('-');
    const floor = floors.find(f => f.id === floorId);
    if (floor) {
      selectedWall = floor.walls.find(w => w.id === wallId);
    }
  } else if (selectedType === 'subObject' && selectedId) {
    for (const floor of floors) {
      for (const wall of floor.walls) {
        const found = wall.subObjects.find(obj => obj.id === selectedId);
        if (found) {
          selectedSubObj = found;
          selectedWall = wall;
          parentWallIdOfSubObj = wall.id;
          break;
        }
      }
    }
  }

  const handleDimensionChange = (key: 'width' | 'depth', val: number) => {
    if (val > 0) {
      setDimensions({ [key]: val });
    }
  };

  const handleRoofChange = (key: 'inclination' | 'overhang' | 'thickness', val: number) => {
    setRoofConfig({ [key]: val });
  };

  return (
    <div style={{
      width: '360px',
      height: '100%',
      backgroundColor: '#242424',
      borderLeft: '1px solid #333',
      color: '#e0e0e0',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'Inter, system-ui, sans-serif',
      boxShadow: '-2px 0 12px rgba(0,0,0,0.3)',
      overflowY: 'auto',
      zIndex: 10
    }}>
      {/* Header */}
      <div style={{ padding: '20px', borderBottom: '1px solid #333' }}>
        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600, color: '#f0f0f0' }}>Woodii 3D Builder</h2>
        <span style={{ fontSize: '12px', color: '#888' }}>Phase 1 & 2 - Setup & Core State</span>
      </div>

      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Project controls */}
        <section>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', textTransform: 'uppercase', color: '#ff8c00', letterSpacing: '0.05em' }}>Building Type</h3>
          <select
            value={buildingType}
            onChange={(e) => setBuildingType(e.target.value as BuildingType)}
            style={{
              width: '100%',
              padding: '10px',
              backgroundColor: '#1a1a1a',
              border: '1px solid #444',
              borderRadius: '6px',
              color: '#e0e0e0',
              outline: 'none'
            }}
          >
            <option value="garden_saddle">Garden House (Saddle Roof)</option>
            <option value="garden_flat">Garden House (Flat Roof)</option>
            <option value="playhouse">Kids Playhouse</option>
            <option value="henhouse">Henhouse</option>
            <option value="tiny_house">Tiny House</option>
          </select>
        </section>

        {/* Footprint dimensions */}
        <section>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', textTransform: 'uppercase', color: '#ff8c00', letterSpacing: '0.05em' }}>Dimensions</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#888', marginBottom: '4px' }}>Width (m)</label>
              <input
                type="number"
                step="0.1"
                min="1"
                max="15"
                value={dimensions.width}
                onChange={(e) => handleDimensionChange('width', parseFloat(e.target.value))}
                style={{
                  width: '100%',
                  padding: '8px',
                  backgroundColor: '#1a1a1a',
                  border: '1px solid #444',
                  borderRadius: '6px',
                  color: '#e0e0e0'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#888', marginBottom: '4px' }}>Depth (m)</label>
              <input
                type="number"
                step="0.1"
                min="1"
                max="15"
                value={dimensions.depth}
                onChange={(e) => handleDimensionChange('depth', parseFloat(e.target.value))}
                style={{
                  width: '100%',
                  padding: '8px',
                  backgroundColor: '#1a1a1a',
                  border: '1px solid #444',
                  borderRadius: '6px',
                  color: '#e0e0e0'
                }}
              />
            </div>
          </div>
        </section>

        {/* Roof Config */}
        <section>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', textTransform: 'uppercase', color: '#ff8c00', letterSpacing: '0.05em' }}>Roof Config</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#888', marginBottom: '4px' }}>Inclination (°)</label>
              <input
                type="number"
                min="5"
                max="60"
                value={roof.inclination}
                onChange={(e) => handleRoofChange('inclination', parseInt(e.target.value))}
                style={{
                  width: '100%',
                  padding: '8px',
                  backgroundColor: '#1a1a1a',
                  border: '1px solid #444',
                  borderRadius: '6px',
                  color: '#e0e0e0'
                }}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#888', marginBottom: '4px' }}>Overhang (m)</label>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  max="1.5"
                  value={roof.overhang}
                  onChange={(e) => handleRoofChange('overhang', parseFloat(e.target.value))}
                  style={{
                    width: '100%',
                    padding: '8px',
                    backgroundColor: '#1a1a1a',
                    border: '1px solid #444',
                    borderRadius: '6px',
                    color: '#e0e0e0'
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#888', marginBottom: '4px' }}>Thickness (m)</label>
                <input
                  type="number"
                  step="0.05"
                  min="0.05"
                  max="0.5"
                  value={roof.thickness}
                  onChange={(e) => handleRoofChange('thickness', parseFloat(e.target.value))}
                  style={{
                    width: '100%',
                    padding: '8px',
                    backgroundColor: '#1a1a1a',
                    border: '1px solid #444',
                    borderRadius: '6px',
                    color: '#e0e0e0'
                  }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Floors */}
        <section>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', textTransform: 'uppercase', color: '#ff8c00', letterSpacing: '0.05em' }}>Floors ({floors.length})</h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={addFloor}
              style={{
                flex: 1,
                padding: '8px',
                backgroundColor: '#2e7d32',
                border: 'none',
                borderRadius: '6px',
                color: '#fff',
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              Add Floor
            </button>
            <button
              onClick={removeLastFloor}
              disabled={floors.length <= 1}
              style={{
                flex: 1,
                padding: '8px',
                backgroundColor: floors.length <= 1 ? '#424242' : '#c62828',
                border: 'none',
                borderRadius: '6px',
                color: floors.length <= 1 ? '#888' : '#fff',
                fontWeight: 500,
                cursor: floors.length <= 1 ? 'not-allowed' : 'pointer'
              }}
            >
              Remove Floor
            </button>
          </div>
        </section>

        {/* View Mode controls */}
        <section>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', textTransform: 'uppercase', color: '#ff8c00', letterSpacing: '0.05em' }}>View Mode</h3>
          <div style={{ display: 'flex', gap: '4px', backgroundColor: '#1a1a1a', padding: '4px', borderRadius: '8px' }}>
            {(['solid', 'seeThrough', 'studsOnly'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => updateUIState({ seeThroughMode: mode })}
                style={{
                  flex: 1,
                  padding: '6px 4px',
                  fontSize: '11px',
                  backgroundColor: uiState.seeThroughMode === mode ? '#ff8c00' : 'transparent',
                  border: 'none',
                  borderRadius: '6px',
                  color: uiState.seeThroughMode === mode ? '#000' : '#888',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textTransform: 'capitalize'
                }}
              >
                {mode === 'seeThrough' ? 'Transp.' : mode === 'studsOnly' ? 'Wireframe' : 'Solid'}
              </button>
            ))}
          </div>
        </section>

        {/* Selected Details Panel */}
        <section style={{
          backgroundColor: '#1e1e1e',
          padding: '16px',
          borderRadius: '8px',
          border: '1px solid #333',
          minHeight: '120px'
        }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '13px', textTransform: 'uppercase', color: '#888' }}>
            Selection Properties
          </h3>

          {!selectedId ? (
            <p style={{ margin: 0, fontSize: '12px', color: '#555', fontStyle: 'italic' }}>
              Click on a wall, door, window, or roof in the 3D viewport to inspect/modify.
            </p>
          ) : (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#f0f0f0', textTransform: 'capitalize' }}>
                  {selectedType}: {selectedId.split('-').pop()}
                </span>
                <button
                  onClick={() => selectObject(null, null)}
                  style={{
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: '#888',
                    cursor: 'pointer',
                    fontSize: '11px'
                  }}
                >
                  Deselect
                </button>
              </div>

              {selectedType === 'wall' && selectedWall && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <p style={{ margin: 0, fontSize: '12px', color: '#aaa' }}>
                    Wall coordinates: [{selectedWall.start.join(', ')}] to [{selectedWall.end.join(', ')}]
                  </p>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                    <button
                      onClick={() => addSubObject(selectedWall.id, 'door')}
                      style={{
                        flex: 1,
                        padding: '6px',
                        backgroundColor: '#ff8c00',
                        color: '#000',
                        fontSize: '12px',
                        fontWeight: 600,
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      + Door
                    </button>
                    <button
                      onClick={() => addSubObject(selectedWall.id, 'window')}
                      style={{
                        flex: 1,
                        padding: '6px',
                        backgroundColor: '#ff8c00',
                        color: '#000',
                        fontSize: '12px',
                        fontWeight: 600,
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      + Window
                    </button>
                  </div>
                </div>
              )}

              {selectedType === 'subObject' && selectedSubObj && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '10px', color: '#888', marginBottom: '2px' }}>Width (m)</label>
                      <input
                        type="number"
                        step="0.05"
                        value={selectedSubObj.width}
                        onChange={(e) => updateSubObject(parentWallIdOfSubObj, selectedSubObj.id, { width: parseFloat(e.target.value) })}
                        style={{
                          width: '100%',
                          padding: '6px',
                          backgroundColor: '#121212',
                          border: '1px solid #333',
                          borderRadius: '4px',
                          color: '#e0e0e0',
                          fontSize: '12px'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '10px', color: '#888', marginBottom: '2px' }}>Height (m)</label>
                      <input
                        type="number"
                        step="0.05"
                        value={selectedSubObj.height}
                        onChange={(e) => updateSubObject(parentWallIdOfSubObj, selectedSubObj.id, { height: parseFloat(e.target.value) })}
                        style={{
                          width: '100%',
                          padding: '6px',
                          backgroundColor: '#121212',
                          border: '1px solid #333',
                          borderRadius: '4px',
                          color: '#e0e0e0',
                          fontSize: '12px'
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '10px', color: '#888', marginBottom: '2px' }}>Position along wall (m)</label>
                    <input
                      type="number"
                      step="0.05"
                      value={selectedSubObj.position}
                      onChange={(e) => updateSubObject(parentWallIdOfSubObj, selectedSubObj.id, { position: parseFloat(e.target.value) })}
                      style={{
                        width: '100%',
                        padding: '6px',
                        backgroundColor: '#121212',
                        border: '1px solid #333',
                        borderRadius: '4px',
                        color: '#e0e0e0',
                        fontSize: '12px'
                      }}
                    />
                  </div>

                  <button
                    onClick={() => removeSubObject(parentWallIdOfSubObj, selectedSubObj.id)}
                    style={{
                      marginTop: '8px',
                      padding: '6px',
                      backgroundColor: '#c62828',
                      color: '#fff',
                      fontSize: '12px',
                      fontWeight: 600,
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    Delete Sub-Object
                  </button>
                </div>
              )}

              {selectedType === 'roof' && (
                <div style={{ fontSize: '12px', color: '#aaa', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div>Roof Type: <strong style={{ color: '#fff' }}>{roof.type}</strong></div>
                  <div>Inclination: <strong style={{ color: '#fff' }}>{roof.inclination}°</strong></div>
                  <div>Overhang: <strong style={{ color: '#fff' }}>{roof.overhang}m</strong></div>
                  <div>Thickness: <strong style={{ color: '#fff' }}>{roof.thickness}m</strong></div>
                </div>
              )}

              {selectedType === 'floor' && (
                <div style={{ fontSize: '12px', color: '#aaa', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div>Selected Floor Elevation: <strong style={{ color: '#fff' }}>{(floors.find(f => f.id === selectedId)?.level || 0) * dimensions.heightPerFloor}m</strong></div>
                  <div>Walls count: <strong style={{ color: '#fff' }}>{(floors.find(f => f.id === selectedId)?.walls.length || 0)}</strong></div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Global Reset */}
        <button
          onClick={resetProject}
          style={{
            padding: '8px',
            backgroundColor: 'transparent',
            border: '1px solid #555',
            borderRadius: '6px',
            color: '#888',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 500,
            marginTop: '20px'
          }}
        >
          Reset Project
        </button>
      </div>
    </div>
  );
}
