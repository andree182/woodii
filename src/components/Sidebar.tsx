import { useState, ChangeEvent } from 'react';
import { useProjectStore } from '../store';
import { BuildingType } from '../types';
import { generateFraming } from '../utils/framingEngine';

export default function Sidebar() {
  const [activeTab, setActiveTab] = useState<'design' | 'bom'>('design');

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
    setFloorOpening,
    loadProject,
    resetProject,
  } = useProjectStore();

  const handleSaveProject = () => {
    const stateObj = useProjectStore.getState();
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(
      JSON.stringify({
        buildingType: stateObj.buildingType,
        dimensions: stateObj.dimensions,
        roof: stateObj.roof,
        floors: stateObj.floors
      }, null, 2)
    );
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `woodii-project-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleLoadProject = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        loadProject(parsed);
      } catch (err) {
        alert("Failed to parse project JSON file.");
      }
    };
    reader.readAsText(file);
  };

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

  // Generate BOM Grouping
  const framing = generateFraming(useProjectStore.getState());
  
  const bomGroups: { [key: string]: { nominal: string; length: number; count: number } } = {};
  let total2x4Length = 0;
  let total2x6Length = 0;
  let total2x4Count = 0;
  let total2x6Count = 0;

  framing.forEach(member => {
    const [w, h, d] = member.size;
    const len = Math.max(w, h, d);
    const nominal = d > 0.1 || member.type === 'rafter' || member.type === 'ridge' || member.type === 'joist' 
      ? "2x6 (40x140mm)" 
      : "2x4 (40x90mm)";

    if (nominal.includes("2x4")) {
      total2x4Length += len;
      total2x4Count++;
    } else {
      total2x6Length += len;
      total2x6Count++;
    }

    const key = `${nominal}-${len.toFixed(2)}`;
    if (!bomGroups[key]) {
      bomGroups[key] = {
        nominal,
        length: len,
        count: 0
      };
    }
    bomGroups[key].count++;
  });

  const bomList = Object.values(bomGroups).sort((a, b) => {
    if (a.nominal !== b.nominal) return a.nominal.localeCompare(b.nominal);
    return b.length - a.length;
  });

  let doorCount = 0;
  let windowCount = 0;
  let openingCount = 0;
  floors.forEach(f => {
    f.walls.forEach(w => {
      w.subObjects.forEach(obj => {
        if (obj.type === 'door') doorCount++;
        else if (obj.type === 'window') windowCount++;
        else if (obj.type === 'opening') openingCount++;
      });
    });
  });

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

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #333', backgroundColor: '#1a1a1a' }}>
        <button
          onClick={() => setActiveTab('design')}
          style={{
            flex: 1,
            padding: '12px',
            backgroundColor: activeTab === 'design' ? '#242424' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'design' ? '2px solid #ff8c00' : 'none',
            color: activeTab === 'design' ? '#fff' : '#888',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '13px'
          }}
        >
          Design
        </button>
        <button
          onClick={() => setActiveTab('bom')}
          style={{
            flex: 1,
            padding: '12px',
            backgroundColor: activeTab === 'bom' ? '#242424' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'bom' ? '2px solid #ff8c00' : 'none',
            color: activeTab === 'bom' ? '#fff' : '#888',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '13px'
          }}
        >
          Bill of Materials
        </button>
      </div>

      {activeTab === 'design' && (
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
                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => addSubObject(selectedWall.id, 'door')}
                        style={{
                          flex: '1 1 0px',
                          padding: '6px',
                          backgroundColor: '#ff8c00',
                          color: '#000',
                          fontSize: '12px',
                          fontWeight: 600,
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          minWidth: '75px'
                        }}
                      >
                        + Door
                      </button>
                      <button
                        onClick={() => addSubObject(selectedWall.id, 'window')}
                        style={{
                          flex: '1 1 0px',
                          padding: '6px',
                          backgroundColor: '#ff8c00',
                          color: '#000',
                          fontSize: '12px',
                          fontWeight: 600,
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          minWidth: '75px'
                        }}
                      >
                        + Window
                      </button>
                      <button
                        onClick={() => addSubObject(selectedWall.id, 'opening')}
                        style={{
                          flex: '1 1 0px',
                          padding: '6px',
                          backgroundColor: '#ff8c00',
                          color: '#000',
                          fontSize: '12px',
                          fontWeight: 600,
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          minWidth: '75px'
                        }}
                      >
                        + Opening
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
                  const floor = floors.find(f => f.id === selectedId);
                  if (!floor) return null;
                  const opening = floor.floorOpening;
                  return (
                    <div style={{ fontSize: '12px', color: '#aaa', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div>Selected Floor Elevation: <strong style={{ color: '#fff' }}>{floor.level * dimensions.heightPerFloor}m</strong></div>
                      <div>Walls count: <strong style={{ color: '#fff' }}>{floor.walls.length}</strong></div>
                      
                      <div style={{ borderTop: '1px solid #333', paddingTop: '10px', marginTop: '4px' }}>
                        <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#ff8c00', textTransform: 'uppercase' }}>Floor Opening (Stairwell)</h4>
                        
                        {!opening ? (
                          <button
                            onClick={() => setFloorOpening(floor.id, { x: 0, z: 0, width: 1.0, depth: 1.5 })}
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
                            + Add Stairwell Opening
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
                                  onChange={(e) => setFloorOpening(floor.id, { ...opening, width: parseFloat(e.target.value) })}
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
                                  onChange={(e) => setFloorOpening(floor.id, { ...opening, depth: parseFloat(e.target.value) })}
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
                                  onChange={(e) => setFloorOpening(floor.id, { ...opening, x: parseFloat(e.target.value) })}
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
                                  onChange={(e) => setFloorOpening(floor.id, { ...opening, z: parseFloat(e.target.value) })}
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
                              onClick={() => setFloorOpening(floor.id, null)}
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
                      </div>
                    </div>
                  );
                })()}
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
      )}

      {activeTab === 'bom' && (
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Save/Load Persistence */}
          <section style={{ backgroundColor: '#1e1e1e', padding: '16px', borderRadius: '8px', border: '1px solid #333' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '13px', textTransform: 'uppercase', color: '#ff8c00', letterSpacing: '0.05em' }}>
              Project Persistence
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                onClick={handleSaveProject}
                style={{
                  width: '100%',
                  padding: '10px',
                  backgroundColor: '#ff8c00',
                  color: '#000',
                  fontWeight: 600,
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                Save Project (JSON)
              </button>
              
              <label style={{
                display: 'block',
                width: '100%',
                padding: '10px',
                backgroundColor: '#2e7d32',
                color: '#fff',
                fontWeight: 600,
                textAlign: 'center',
                boxSizing: 'border-box',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '12px'
              }}>
                Load Project (JSON)
                <input
                  type="file"
                  accept=".json"
                  onChange={handleLoadProject}
                  style={{ display: 'none' }}
                />
              </label>
            </div>
          </section>

          {/* Material Take-off List */}
          <section style={{ flex: 1 }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', textTransform: 'uppercase', color: '#ff8c00', letterSpacing: '0.05em' }}>
              Material Take-off (BOM)
            </h3>
            
            {bomList.length === 0 ? (
              <p style={{ fontSize: '12px', color: '#666', fontStyle: 'italic' }}>No framing members generated.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* Summary Totals */}
                <div style={{
                  backgroundColor: '#1a1a1a',
                  padding: '12px',
                  borderRadius: '6px',
                  border: '1px solid #333',
                  fontSize: '11px',
                  color: '#ccc',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}>
                  <div><strong>Total 2x4 Lumber:</strong> {total2x4Length.toFixed(2)}m ({total2x4Count} pcs)</div>
                  <div><strong>Total 2x6 Lumber:</strong> {total2x6Length.toFixed(2)}m ({total2x6Count} pcs)</div>
                  <div style={{ borderTop: '1px solid #2a2a2a', marginTop: '6px', paddingTop: '6px' }}>
                    <strong>Hardware & Openings:</strong>
                    <ul style={{ margin: '4px 0 0 12px', padding: 0 }}>
                      {doorCount > 0 && <li>Doors: {doorCount}</li>}
                      {windowCount > 0 && <li>Windows: {windowCount}</li>}
                      {openingCount > 0 && <li>Empty openings: {openingCount}</li>}
                    </ul>
                  </div>
                </div>

                {/* Detailed Table */}
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #333', color: '#888' }}>
                        <th style={{ padding: '6px 4px' }}>Lumber Type</th>
                        <th style={{ padding: '6px 4px', textAlign: 'right' }}>Len (m)</th>
                        <th style={{ padding: '6px 4px', textAlign: 'right' }}>Qty</th>
                        <th style={{ padding: '6px 4px', textAlign: 'right' }}>Total (m)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bomList.map((item, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #2a2a2a' }}>
                          <td style={{ padding: '6px 4px', color: '#e0e0e0' }}>{item.nominal}</td>
                          <td style={{ padding: '6px 4px', textAlign: 'right', color: '#bbb' }}>{item.length.toFixed(2)}</td>
                          <td style={{ padding: '6px 4px', textAlign: 'right', color: '#bbb' }}>{item.count}</td>
                          <td style={{ padding: '6px 4px', textAlign: 'right', color: '#fff', fontWeight: 600 }}>
                            {(item.length * item.count).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
