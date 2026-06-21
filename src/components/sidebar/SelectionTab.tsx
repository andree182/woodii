import { useProjectStore } from '../../store';
import { RoofConfig } from '../../types';

export default function SelectionTab() {
  const {
    dimensions,
    roof,
    uiState,
    floors,
    topCover,
    selectObject,
    addSubObject,
    removeSubObject,
    updateSubObject,
    updateInternalWall,
    removeInternalWall,
    addInternalWall,
    setRoofConfig,
    setTopCoverConfig,
    setFloorOpening,
    resetProject,
  } = useProjectStore();

  const selectedId = uiState.selectedId;
  const selectedType = uiState.selectedType;

  // Find currently selected object if any
  let selectedWall: any = null;
  let selectedInternalWall: any = null;
  let selectedSubObj: any = null;
  let parentWallIdOfSubObj: string = '';

  if (selectedType === 'wall' && selectedId) {
    if (selectedId.startsWith('internal-')) {
      for (const floor of floors) {
        const found = (floor.internalWalls || []).find((w) => w.id === selectedId);
        if (found) {
          selectedInternalWall = found;
          break;
        }
      }
    } else {
      // Expected id format: floorId-wallId (e.g. floor-0-wall-front)
      const parts = selectedId.split('-');
      const floorId = `${parts[0]}-${parts[1]}`;
      const wallId = parts.slice(2).join('-');
      const floor = floors.find((f) => f.id === floorId);
      if (floor) {
        selectedWall = floor.walls.find((w) => w.id === wallId);
      }
    }
  } else if (selectedType === 'subObject' && selectedId) {
    for (const floor of floors) {
      for (const wall of floor.walls) {
        const found = wall.subObjects.find((obj) => obj.id === selectedId);
        if (found) {
          selectedSubObj = found;
          selectedWall = wall;
          parentWallIdOfSubObj = `${floor.id}-${wall.id}`;
          break;
        }
      }
      if (selectedSubObj) break;

      if (floor.internalWalls) {
        for (const wall of floor.internalWalls) {
          const found = wall.subObjects.find((obj) => obj.id === selectedId);
          if (found) {
            selectedSubObj = found;
            selectedWall = wall;
            parentWallIdOfSubObj = wall.id;
            break;
          }
        }
      }
      if (selectedSubObj) break;
    }
  }

  const handleRoofChange = (key: keyof RoofConfig, val: any) => {
    setRoofConfig({ [key]: val });
  };

  return (
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '24px', flex: 1, overflowY: 'auto' }}>
      {/* Selected Details Panel */}
      <section style={{
        backgroundColor: '#1e1e1e',
        padding: '16px',
        borderRadius: '8px',
        border: '1px solid #333'
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
                  Wall length: <strong>{Math.sqrt(Math.pow(selectedWall.end[0]-selectedWall.start[0], 2) + Math.pow(selectedWall.end[1]-selectedWall.start[1], 2)).toFixed(2)}m</strong>
                </p>
                <p style={{ margin: 0, fontSize: '12px', color: '#aaa' }}>
                  Wall thickness: <strong>{selectedWall.thickness.toFixed(2)}m</strong>
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px solid #333', paddingTop: '8px' }}>
                  <span style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', fontWeight: 600 }}>Add Openings:</span>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                    <button
                      onClick={() => addSubObject(selectedId, 'door')}
                      style={{
                        padding: '6px',
                        backgroundColor: '#2a2a2a',
                        color: '#ccc',
                        border: '1px solid #444',
                        borderRadius: '4px',
                        fontSize: '10px',
                        cursor: 'pointer'
                      }}
                    >
                      + Door
                    </button>
                    <button
                      onClick={() => addSubObject(selectedId, 'window')}
                      style={{
                        padding: '6px',
                        backgroundColor: '#2a2a2a',
                        color: '#ccc',
                        border: '1px solid #444',
                        borderRadius: '4px',
                        fontSize: '10px',
                        cursor: 'pointer'
                      }}
                    >
                      + Window
                    </button>
                    <button
                      onClick={() => addSubObject(selectedId, 'opening')}
                      style={{
                        padding: '6px',
                        backgroundColor: '#2a2a2a',
                        color: '#ccc',
                        border: '1px solid #444',
                        borderRadius: '4px',
                        fontSize: '10px',
                        cursor: 'pointer'
                      }}
                    >
                      + Passage
                    </button>
                  </div>
                </div>
              </div>
            )}
            {selectedType === 'wall' && selectedInternalWall && (() => {
              const wall = selectedInternalWall;
              const floor = floors.find(f => (f.internalWalls || []).some(w => w.id === selectedId));
              if (!floor) return null;
              const length = Math.sqrt(
                Math.pow(wall.end[0] - wall.start[0], 2) +
                Math.pow(wall.end[1] - wall.start[1], 2)
              );
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <p style={{ margin: 0, fontSize: '12px', color: '#aaa' }}>
                    Internal Wall Length: <strong>{length.toFixed(2)}m</strong>
                  </p>
                  {/* Timber Configuration */}
                  <div style={{ borderTop: '1px solid #333', paddingTop: '10px', marginTop: '6px' }}>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '11px', color: '#ff8c00', textTransform: 'uppercase' }}>Timber & Lining</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '10px', color: '#888', marginBottom: '2px' }}>Stud Thick (m)</label>
                        <input
                          type="number"
                          step="0.005"
                          min="0.02"
                          max="0.10"
                          value={wall.timberSize.thickness}
                          onChange={(e) => updateInternalWall(floor.id, wall.id, { timberSize: { ...wall.timberSize, thickness: parseFloat(e.target.value) || 0.04 } })}
                          style={{ width: '100%', padding: '6px', backgroundColor: '#121212', border: '1px solid #333', borderRadius: '4px', color: '#e0e0e0', fontSize: '11px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '10px', color: '#888', marginBottom: '2px' }}>Stud Depth (m)</label>
                        <input
                          type="number"
                          step="0.005"
                          min="0.04"
                          max="0.20"
                          value={wall.timberSize.width}
                          onChange={(e) => updateInternalWall(floor.id, wall.id, { timberSize: { ...wall.timberSize, width: parseFloat(e.target.value) || 0.07 } })}
                          style={{ width: '100%', padding: '6px', backgroundColor: '#121212', border: '1px solid #333', borderRadius: '4px', color: '#e0e0e0', fontSize: '11px' }}
                        />
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '10px', color: '#888', marginBottom: '2px' }}>Lining Thickness (m)</label>
                      <input
                        type="number"
                        step="0.002"
                        min="0.00"
                        max="0.05"
                        value={wall.liningThickness}
                        onChange={(e) => updateInternalWall(floor.id, wall.id, { liningThickness: parseFloat(e.target.value) || 0 })}
                        style={{ width: '100%', padding: '6px', backgroundColor: '#121212', border: '1px solid #333', borderRadius: '4px', color: '#e0e0e0', fontSize: '11px' }}
                      />
                    </div>
                  </div>

                  {/* Add Door */}
                  <div style={{ borderTop: '1px solid #333', paddingTop: '10px', marginTop: '6px', display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => addSubObject(wall.id, 'door')}
                      style={{
                        flex: 1,
                        padding: '6px',
                        backgroundColor: '#ff8c00',
                        color: '#000',
                        fontWeight: 600,
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      + Door
                    </button>
                    <button
                      onClick={() => addSubObject(wall.id, 'opening')}
                      style={{
                        flex: 1,
                        padding: '6px',
                        backgroundColor: '#ff8c00',
                        color: '#000',
                        fontWeight: 600,
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      + Opening
                    </button>
                  </div>

                  {/* Delete Wall */}
                  <div style={{ borderTop: '1px solid #333', paddingTop: '10px', marginTop: '6px' }}>
                    <button
                      onClick={() => removeInternalWall(floor.id, wall.id)}
                      style={{
                        width: '100%',
                        padding: '6px',
                        backgroundColor: '#c62828',
                        color: '#fff',
                        fontWeight: 600,
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      Delete Partition Wall
                    </button>
                  </div>
                </div>
              );
            })()}

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

                {selectedSubObj.type !== 'door' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '10px', color: '#888', marginBottom: '2px' }}>Elevation (m)</label>
                    <input
                      type="number"
                      step="0.05"
                      min="0"
                      value={selectedSubObj.elevation !== undefined ? selectedSubObj.elevation : (selectedSubObj.type === 'window' ? 0.9 : 0)}
                      onChange={(e) => updateSubObject(parentWallIdOfSubObj, selectedSubObj.id, { elevation: parseFloat(e.target.value) })}
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
                )}

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

            {selectedType === 'floor' && (() => {
              const isRoofFloor = selectedId === 'floor-roof';
              const floor = isRoofFloor
                ? { id: 'floor-roof', level: floors.length, walls: [], floorOpening: roof.roofOpening }
                : floors.find((f) => f.id === selectedId);
              
              if (!floor) return null;
              const opening = floor.floorOpening;

              const updateOpening = (newOpening: typeof opening | null) => {
                if (isRoofFloor) {
                  if (!newOpening) {
                    setRoofConfig({ roofOpening: undefined });
                  } else {
                    const oWidth = Math.max(0.5, Math.min(dimensions.width - 0.4, newOpening.width));
                    const oDepth = Math.max(0.5, Math.min(dimensions.depth - 0.4, newOpening.depth));
                    const minX = -dimensions.width / 2 + oWidth / 2 + 0.2;
                    const maxX = dimensions.width / 2 - oWidth / 2 - 0.2;
                    const minZ = -dimensions.depth / 2 + oDepth / 2 + 0.2;
                    const maxZ = dimensions.depth / 2 - oDepth / 2 - 0.2;
                    const oX = Math.max(minX, Math.min(maxX, newOpening.x));
                    const oZ = Math.max(minZ, Math.min(maxZ, newOpening.z));
                    setRoofConfig({
                      roofOpening: { x: oX, z: oZ, width: oWidth, depth: oDepth }
                    });
                  }
                } else {
                  setFloorOpening(floor.id, newOpening);
                }
              };

              return (
                <div style={{ fontSize: '12px', color: '#aaa', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>Selected Floor: <strong style={{ color: '#fff' }}>{isRoofFloor ? 'Attic / Roof Floor' : `Floor ${floor.level}`}</strong></div>
                  <div>Selected Floor Elevation: <strong style={{ color: '#fff' }}>{floor.level * dimensions.heightPerFloor}m</strong></div>
                  {!isRoofFloor && <div>Walls count: <strong style={{ color: '#fff' }}>{floor.walls.length}</strong></div>}
                  
                  <div style={{ borderTop: '1px solid #333', paddingTop: '10px', marginTop: '4px' }}>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#ff8c00', textTransform: 'uppercase' }}>
                      {isRoofFloor ? 'Attic Hatch / Opening' : 'Floor Opening (Stairwell)'}
                    </h4>
                    
                    {!opening ? (
                      <button
                        onClick={() => updateOpening({ x: 0, z: 0, width: 1.0, depth: 1.5 })}
                        style={{
                          width: '100%',
                          padding: '6px',
                          backgroundColor: '#ff8c00',
                          color: '#000',
                          fontSize: '11px',
                          fontWeight: 600,
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        + Add Opening
                      </button>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '10px', color: '#888', marginBottom: '2px' }}>Width (m)</label>
                            <input
                              type="number"
                              step="0.05"
                              value={opening.width}
                              onChange={(e) => updateOpening({ ...opening, width: parseFloat(e.target.value) })}
                              style={{
                                width: '100%',
                                padding: '5px',
                                backgroundColor: '#121212',
                                border: '1px solid #333',
                                borderRadius: '4px',
                                color: '#e0e0e0',
                                fontSize: '11px'
                              }}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '10px', color: '#888', marginBottom: '2px' }}>Depth (m)</label>
                            <input
                              type="number"
                              step="0.05"
                              value={opening.depth}
                              onChange={(e) => updateOpening({ ...opening, depth: parseFloat(e.target.value) })}
                              style={{
                                width: '100%',
                                padding: '5px',
                                backgroundColor: '#121212',
                                border: '1px solid #333',
                                borderRadius: '4px',
                                color: '#e0e0e0',
                                fontSize: '11px'
                              }}
                            />
                          </div>
                        </div>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '10px', color: '#888', marginBottom: '2px' }}>Position X (m)</label>
                            <input
                              type="number"
                              step="0.05"
                              value={opening.x}
                              onChange={(e) => updateOpening({ ...opening, x: parseFloat(e.target.value) })}
                              style={{
                                width: '100%',
                                padding: '5px',
                                backgroundColor: '#121212',
                                border: '1px solid #333',
                                borderRadius: '4px',
                                color: '#e0e0e0',
                                fontSize: '11px'
                              }}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '10px', color: '#888', marginBottom: '2px' }}>Position Z (m)</label>
                            <input
                              type="number"
                              step="0.05"
                              value={opening.z}
                              onChange={(e) => updateOpening({ ...opening, z: parseFloat(e.target.value) })}
                              style={{
                                width: '100%',
                                padding: '5px',
                                backgroundColor: '#121212',
                                border: '1px solid #333',
                                borderRadius: '4px',
                                color: '#e0e0e0',
                                fontSize: '11px'
                              }}
                            />
                          </div>
                        </div>
                        
                        <button
                          onClick={() => updateOpening(null)}
                          style={{
                            marginTop: '4px',
                            padding: '5px',
                            backgroundColor: '#c62828',
                            color: '#fff',
                            fontSize: '11px',
                            fontWeight: 600,
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                        >
                          Remove Opening
                        </button>
                      </div>
                    )}
                  {/* Partition Walls Editor */}
                  {!isRoofFloor && (
                    <div style={{ borderTop: '1px solid #333', paddingTop: '10px', marginTop: '10px' }}>
                      <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#ff8c00', textTransform: 'uppercase' }}>
                        Internal Partition Walls
                      </h4>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px' }}>
                        {(floor.internalWalls || []).map((w, idx) => {
                          const wLen = Math.sqrt(
                            Math.pow(w.end[0] - w.start[0], 2) +
                            Math.pow(w.end[1] - w.start[1], 2)
                          );
                          return (
                            <div
                              key={w.id}
                              onClick={() => selectObject(w.id, 'wall')}
                              style={{
                                padding: '8px',
                                backgroundColor: '#1f1f1f',
                                border: `1px solid ${selectedId === w.id ? '#ff8c00' : '#333'}`,
                                borderRadius: '4px',
                                cursor: 'pointer',
                                display: 'flex',
                                justifySelf: 'stretch',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                width: '100%',
                                boxSizing: 'border-box'
                              }}
                            >
                              <div style={{ flex: 1, minWidth: 0, marginRight: '8px' }}>
                                <div style={{ color: '#fff', fontSize: '11px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  Partition Wall {idx + 1}
                                </div>
                                <div style={{ fontSize: '9px', color: '#888' }}>
                                  Length: {wLen.toFixed(2)}m | ({w.subObjects.length} doors)
                                </div>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeInternalWall(floor.id, w.id);
                                }}
                                style={{
                                  padding: '2px 6px',
                                  backgroundColor: '#c62828',
                                  color: '#fff',
                                  fontSize: '9px',
                                  border: 'none',
                                  borderRadius: '3px',
                                  cursor: 'pointer',
                                  flexShrink: 0
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          );
                        })}
                      </div>

                      <button
                        onClick={() => addInternalWall(floor.id)}
                        style={{
                          width: '100%',
                          padding: '6px',
                          backgroundColor: '#ff8c00',
                          color: '#000',
                          fontSize: '11px',
                          fontWeight: 600,
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        + Add Partition Wall
                      </button>
                    </div>
                  )}
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </section>

      {/* Roof Config (Visible inside Selection Editor Tab only if roof is selected) */}
      {selectedType === 'roof' && (
        <section style={{
          backgroundColor: '#1e1e1e',
          padding: '16px',
          borderRadius: '8px',
          border: '1px solid #333'
        }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '13px', textTransform: 'uppercase', color: '#ff8c00', letterSpacing: '0.05em' }}>Roof Config</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#888', marginBottom: '4px' }}>Roof Type</label>
              <select
                value={roof.type || 'saddle'}
                onChange={(e) => handleRoofChange('type', e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  backgroundColor: '#1a1a1a',
                  border: '1px solid #444',
                  borderRadius: '6px',
                  color: '#e0e0e0',
                  fontSize: '12px'
                }}
              >
                <option value="saddle">Saddle Roof</option>
                <option value="flat">Flat Roof</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#888', marginBottom: '4px' }}>Inclination (°)</label>
              <input
                type="number"
                min="5"
                max="60"
                value={roof.inclination}
                onChange={(e) => handleRoofChange('inclination', parseInt(e.target.value) || 0)}
                style={{
                  width: '100%',
                  padding: '8px',
                  backgroundColor: '#1a1a1a',
                  border: '1px solid #444',
                  borderRadius: '6px',
                  color: '#e0e0e0',
                  fontSize: '12px'
                }}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#888', marginBottom: '4px' }}>Overhang (m)</label>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  max="1.0"
                  value={roof.overhang}
                  onChange={(e) => handleRoofChange('overhang', parseFloat(e.target.value) || 0)}
                  style={{
                    width: '100%',
                    padding: '8px',
                    backgroundColor: '#1a1a1a',
                    border: '1px solid #444',
                    borderRadius: '6px',
                    color: '#e0e0e0',
                    fontSize: '12px'
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
                  onChange={(e) => handleRoofChange('thickness', parseFloat(e.target.value) || 0)}
                  style={{
                    width: '100%',
                    padding: '8px',
                    backgroundColor: '#1a1a1a',
                    border: '1px solid #444',
                    borderRadius: '6px',
                    color: '#e0e0e0',
                    fontSize: '12px'
                  }}
                />
              </div>
            </div>

            {/* Top Cover Material & Dimensions */}
            <div style={{ borderTop: '1px solid #333', paddingTop: '12px', marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <h4 style={{ margin: '0 0 4px 0', fontSize: '11px', color: '#ff8c00', textTransform: 'uppercase' }}>Top Cover (Roof Material)</h4>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#888', marginBottom: '4px' }}>Material</label>
                <select
                  value={topCover.material || 'shingles'}
                  onChange={(e) => {
                    const material = e.target.value as any;
                    if (material === 'shingles') {
                      setTopCoverConfig({ material, width: 1.0, height: 0.33, visibleWidth: 1.0, visibleHeight: 0.145 });
                    } else if (material === 'tiles') {
                      setTopCoverConfig({ material, width: 0.33, height: 0.42, visibleWidth: 0.30, visibleHeight: 0.34 });
                    } else if (material === 'plates') {
                      setTopCoverConfig({ material, width: 1.0, height: 2.0, visibleWidth: 0.95, visibleHeight: 1.85 });
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '8px',
                    backgroundColor: '#1a1a1a',
                    border: '1px solid #444',
                    borderRadius: '6px',
                    color: '#e0e0e0',
                    fontSize: '12px'
                  }}
                >
                  <option value="shingles">Asphalt Shingles</option>
                  <option value="tiles">Concrete Tiles</option>
                  <option value="plates">Aluminum Plates</option>
                </select>
              </div>

              {/* Material Dimensions */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '10px', color: '#888', marginBottom: '2px' }}>Total Width (m)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.05"
                    value={topCover.width}
                    onChange={(e) => setTopCoverConfig({ width: parseFloat(e.target.value) || 0.05 })}
                    style={{ width: '100%', padding: '6px', backgroundColor: '#121212', border: '1px solid #333', borderRadius: '4px', color: '#e0e0e0', fontSize: '11px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '10px', color: '#888', marginBottom: '2px' }}>Total Height (m)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.05"
                    value={topCover.height}
                    onChange={(e) => setTopCoverConfig({ height: parseFloat(e.target.value) || 0.05 })}
                    style={{ width: '100%', padding: '6px', backgroundColor: '#121212', border: '1px solid #333', borderRadius: '4px', color: '#e0e0e0', fontSize: '11px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '10px', color: '#888', marginBottom: '2px' }}>Exposure W (m)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.05"
                    value={topCover.visibleWidth}
                    onChange={(e) => setTopCoverConfig({ visibleWidth: parseFloat(e.target.value) || 0.05 })}
                    style={{ width: '100%', padding: '6px', backgroundColor: '#121212', border: '1px solid #333', borderRadius: '4px', color: '#e0e0e0', fontSize: '11px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '10px', color: '#888', marginBottom: '2px' }}>Exposure H (m)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.05"
                    value={topCover.visibleHeight}
                    onChange={(e) => setTopCoverConfig({ visibleHeight: parseFloat(e.target.value) || 0.05 })}
                    style={{ width: '100%', padding: '6px', backgroundColor: '#121212', border: '1px solid #333', borderRadius: '4px', color: '#e0e0e0', fontSize: '11px' }}
                  />
                </div>
              </div>
            </div>

            {/* Roof Sheeting Configuration */}
            <div style={{ borderTop: '1px solid #333', paddingTop: '12px', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <h4 style={{ margin: '0 0 4px 0', fontSize: '11px', color: '#ff8c00', textTransform: 'uppercase' }}>Roof Sheeting Underneath</h4>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#888', marginBottom: '4px' }}>Sheeting Material</label>
                <select
                  value={topCover.sheetingMaterial || 'osb_1250'}
                  onChange={(e) => setTopCoverConfig({ sheetingMaterial: e.target.value as any })}
                  style={{
                    width: '100%',
                    padding: '8px',
                    backgroundColor: '#1a1a1a',
                    border: '1px solid #444',
                    borderRadius: '6px',
                    color: '#e0e0e0',
                    fontSize: '12px'
                  }}
                >
                  <option value="osb_1250">OSB Board (2500x1250mm)</option>
                  <option value="osb_625">OSB Board (2500x625mm)</option>
                  <option value="plywood">Construction Plywood (2440x1220mm)</option>
                  <option value="none">None (Open rafters / battens only)</option>
                </select>
              </div>
              {topCover.sheetingMaterial !== 'none' && (
                <div>
                  <label style={{ display: 'block', fontSize: '10px', color: '#888', marginBottom: '2px' }}>Sheeting Thickness (m)</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0.008"
                    max="0.04"
                    value={topCover.sheetingThickness}
                    onChange={(e) => setTopCoverConfig({ sheetingThickness: parseFloat(e.target.value) || 0.015 })}
                    style={{
                      width: '100%',
                      padding: '6px',
                      backgroundColor: '#121212',
                      border: '1px solid #333',
                      borderRadius: '4px',
                      color: '#e0e0e0',
                      fontSize: '11px'
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </section>
      )}

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
  );
}
