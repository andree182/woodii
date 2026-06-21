import { useState, ChangeEvent, useEffect } from 'react';
import { useProjectStore } from '../store';

import { generateFraming, FramingMember } from '../utils/framingEngine';
import { DEMO_PROJECTS } from '../utils/demos';

export default function Sidebar() {
  const [activeTab, setActiveTab] = useState<'projects' | 'global' | 'selection' | 'bom'>('projects');
  const [bomViewMode, setBomViewMode] = useState<'global' | 'walls'>('walls');
  const [expandedWalls, setExpandedWalls] = useState<{[key: string]: boolean}>({});


  const {

    dimensions,
    roof,
    foundation,
    wallLayers,
    wallPreset,
    structuralConfig,
    uiState,
    floors,

    setDimensions,
    setRoofConfig,
    setFoundationConfig,
    setWallLayers,
    setWallPreset,
    setStructuralConfig,
    addInternalWall,
    removeInternalWall,
    updateInternalWall,
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
        foundation: stateObj.foundation,
        wallLayers: stateObj.wallLayers,
        wallPreset: stateObj.wallPreset,
        structuralConfig: stateObj.structuralConfig,
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

  // Automatically switch to selection tab when any element (wall, door/window, floor, roof) is clicked/selected
  useEffect(() => {
    if (selectedType && selectedType !== null) {
      setActiveTab('selection');
    }
  }, [selectedId, selectedType]);

  // Automatically switch to global tab if building/wall dimensions are being edited (e.g. via wall dragging handles)
  const isDragging = uiState.isDragging;
  const draggedType = uiState.draggedType;
  useEffect(() => {
    if (isDragging && draggedType === 'wallHandle') {
      setActiveTab('global');
    }
  }, [isDragging, draggedType]);

  // Find currently selected object if any
  let selectedWall: any = null;
  let selectedInternalWall: any = null;
  let selectedSubObj: any = null;
  let parentWallIdOfSubObj: string = '';

  if (selectedType === 'wall' && selectedId) {
    if (selectedId.startsWith('internal-')) {
      for (const floor of floors) {
        const found = (floor.internalWalls || []).find(w => w.id === selectedId);
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
      const floor = floors.find(f => f.id === floorId);
      if (floor) {
        selectedWall = floor.walls.find(w => w.id === wallId);
      }
    }
  } else if (selectedType === 'subObject' && selectedId) {
    for (const floor of floors) {
      for (const wall of floor.walls) {
        const found = wall.subObjects.find(obj => obj.id === selectedId);
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
          const found = wall.subObjects.find(obj => obj.id === selectedId);
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

  const handleDimensionChange = (key: 'width' | 'depth' | 'heightPerFloor', val: number) => {
    if (val > 0) {
      setDimensions({ [key]: val });
    }
  };

  const handleWallLayerChange = (key: 'outer' | 'middle' | 'inner', val: number) => {
    if (val >= 0) {
      setWallLayers({ [key]: val });
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

    if (member.type === 'screw') {
      const nominal = "Steel Ground Screw (76x800mm)";
      const key = `${nominal}-${len.toFixed(2)}`;
      if (!bomGroups[key]) {
        bomGroups[key] = {
          nominal,
          length: len,
          count: 0
        };
      }
      bomGroups[key].count++;
      return;
    }

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

  const bomListWithIds = bomList.map((item, index) => ({
    ...item,
    idNum: `#${index + 1}`
  }));

  const getCutIdentifier = (nominal: string, length: number) => {
    const found = bomListWithIds.find(item => item.nominal === nominal && item.length.toFixed(2) === length.toFixed(2));
    return found ? found.idNum : '';
  };

  let doorCount = 0;
  let windowCount = 0;
  let openingCount = 0;
  let screwCount = 0;
  floors.forEach(f => {
    f.walls.forEach(w => {
      w.subObjects.forEach(obj => {
        if (obj.type === 'door') doorCount++;
        else if (obj.type === 'window') windowCount++;
        else if (obj.type === 'opening') openingCount++;
      });
    });
  });
  framing.forEach(m => {
    if (m.type === 'screw') screwCount++;
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
      <div style={{ display: 'flex', borderBottom: '1px solid #333', backgroundColor: '#1a1a1a', overflowX: 'auto' }}>
        {([
          { id: 'projects', label: 'Projects' },
          { id: 'global', label: 'Global' },
          { id: 'selection', label: 'Selection' },
          { id: 'bom', label: 'BOM' }
        ] as const).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1,
              padding: '12px 4px',
              backgroundColor: activeTab === tab.id ? '#242424' : 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid #ff8c00' : 'none',
              color: activeTab === tab.id ? '#fff' : '#888',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '0.03em',
              textAlign: 'center',
              whiteSpace: 'nowrap'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'projects' && (
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Project Persistence */}
          <section style={{ backgroundColor: '#1e1e1e', padding: '16px', borderRadius: '8px', border: '1px solid #333' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '13px', textTransform: 'uppercase', color: '#ff8c00', letterSpacing: '0.05em' }}>
              Project Persistence
            </h3>
            
            {/* Demo Projects selector */}
            <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', fontWeight: 600 }}>Load Demo Templates:</span>
              {Object.entries(DEMO_PROJECTS).map(([key, demo]) => (
                <button
                  key={key}
                  onClick={() => loadProject(demo.project)}
                  style={{
                    width: '100%',
                    padding: '8px',
                    backgroundColor: '#111',
                    color: '#fff',
                    border: '1px solid #333',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 600,
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#222')}
                  onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#111')}
                >
                  ⚡ {demo.name}
                </button>
              ))}
            </div>

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
        </div>
      )}

      {activeTab === 'global' && (
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Footprint dimensions */}
          <section>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', textTransform: 'uppercase', color: '#ff8c00', letterSpacing: '0.05em' }}>Dimensions</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
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
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#888', marginBottom: '4px' }}>Wall H (m)</label>
                <input
                  type="number"
                  step="0.1"
                  min="1.5"
                  max="5"
                  value={dimensions.heightPerFloor}
                  onChange={(e) => handleDimensionChange('heightPerFloor', parseFloat(e.target.value))}
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

          {/* Foundation Config */}
          <section>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', textTransform: 'uppercase', color: '#ff8c00', letterSpacing: '0.05em' }}>Foundation</h3>
            <select
              value={foundation.type}
              onChange={(e) => setFoundationConfig({ type: e.target.value as 'slab' | 'screws' })}
              style={{
                width: '100%',
                padding: '10px',
                backgroundColor: '#1a1a1a',
                border: '1px solid #444',
                borderRadius: '6px',
                color: '#e0e0e0',
                outline: 'none',
                fontSize: '12px'
              }}
            >
              <option value="slab">Concrete Slab</option>
              <option value="screws">Ground Screws Grid</option>
            </select>
          </section>

          {/* Wall Construction Layers Config */}
          <section>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', textTransform: 'uppercase', color: '#ff8c00', letterSpacing: '0.05em' }}>Wall Layers</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={{ fontSize: '11px', color: '#ccc' }}>Preset:</label>
                <select
                  value={wallPreset}
                  onChange={(e) => setWallPreset(e.target.value as any)}
                  style={{
                    width: '60%',
                    padding: '6px',
                    backgroundColor: '#1a1a1a',
                    border: '1px solid #444',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '11px',
                    outline: 'none'
                  }}
                >
                  <option value="custom">Custom Layers</option>
                  <option value="diffusion_open">Diffusion-Open</option>
                  <option value="diffusion_closed">Diffusion-Closed</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginTop: '4px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '9px', color: '#888', marginBottom: '2px' }}>Outer (m)</label>
                  <input
                    type="number"
                    step="0.005"
                    min="0"
                    max="0.1"
                    value={wallLayers.outer}
                    onChange={(e) => handleWallLayerChange('outer', parseFloat(e.target.value))}
                    disabled={wallPreset !== 'custom'}
                    style={{
                      width: '100%',
                      padding: '6px',
                      backgroundColor: '#1a1a1a',
                      border: '1px solid #444',
                      borderRadius: '6px',
                      color: '#fff',
                      fontSize: '11px',
                      outline: 'none',
                      textAlign: 'right',
                      opacity: wallPreset !== 'custom' ? 0.5 : 1,
                      cursor: wallPreset !== 'custom' ? 'not-allowed' : 'text'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '9px', color: '#888', marginBottom: '2px' }}>Middle (m)</label>
                  <input
                    type="number"
                    step="0.005"
                    min="0.04"
                    max="0.25"
                    value={wallLayers.middle}
                    onChange={(e) => handleWallLayerChange('middle', parseFloat(e.target.value))}
                    disabled={wallPreset !== 'custom'}
                    style={{
                      width: '100%',
                      padding: '6px',
                      backgroundColor: '#1a1a1a',
                      border: '1px solid #444',
                      borderRadius: '6px',
                      color: '#fff',
                      fontSize: '11px',
                      outline: 'none',
                      textAlign: 'right',
                      opacity: wallPreset !== 'custom' ? 0.5 : 1,
                      cursor: wallPreset !== 'custom' ? 'not-allowed' : 'text'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '9px', color: '#888', marginBottom: '2px' }}>Inner (m)</label>
                  <input
                    type="number"
                    step="0.005"
                    min="0"
                    max="0.1"
                    value={wallLayers.inner}
                    onChange={(e) => handleWallLayerChange('inner', parseFloat(e.target.value))}
                    disabled={wallPreset !== 'custom'}
                    style={{
                      width: '100%',
                      padding: '6px',
                      backgroundColor: '#1a1a1a',
                      border: '1px solid #444',
                      borderRadius: '6px',
                      color: '#fff',
                      fontSize: '11px',
                      outline: 'none',
                      textAlign: 'right',
                      opacity: wallPreset !== 'custom' ? 0.5 : 1,
                      cursor: wallPreset !== 'custom' ? 'not-allowed' : 'text'
                    }}
                  />
                </div>

                <div style={{ fontSize: '10px', color: '#888', borderTop: '1px solid #2a2a2a', paddingTop: '6px', marginTop: '4px' }}>
                  Total wall thickness: <strong>{(wallLayers.outer + wallLayers.middle + wallLayers.inner).toFixed(3)}m</strong>
                </div>
              </div>
            </div>
          </section>

          {/* Framing & Robustness Config */}
          <section>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', textTransform: 'uppercase', color: '#ff8c00', letterSpacing: '0.05em' }}>Framing & Robustness</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="wall-blocking-toggle"
                  checked={structuralConfig?.wallBlocking || false}
                  onChange={(e) => setStructuralConfig({ wallBlocking: e.target.checked })}
                  style={{ cursor: 'pointer' }}
                />
                <label htmlFor="wall-blocking-toggle" style={{ fontSize: '11px', color: '#ccc', cursor: 'pointer' }}>
                  Staggered Wall Blocking (Noggings)
                </label>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="floor-blocking-toggle"
                  checked={structuralConfig?.floorBlocking || false}
                  onChange={(e) => setStructuralConfig({ floorBlocking: e.target.checked })}
                  style={{ cursor: 'pointer' }}
                />
                <label htmlFor="floor-blocking-toggle" style={{ fontSize: '11px', color: '#ccc', cursor: 'pointer' }}>
                  Staggered Floor Blocking
                </label>
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

      {activeTab === 'selection' && (
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
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
                )}                {selectedType === 'floor' && (() => {
                  const isRoofFloor = selectedId === 'floor-roof';
                  const floor = isRoofFloor
                    ? { id: 'floor-roof', level: floors.length, walls: [], floorOpening: roof.roofOpening }
                    : floors.find(f => f.id === selectedId);
                  
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
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                  }}
                                >
                                  <div>
                                    <div style={{ color: '#fff', fontSize: '11px', fontWeight: 600 }}>
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
                                      cursor: 'pointer'
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

          {/* Roof Config (Always Visible inside Selection Editor Tab) */}
          <section style={{
            backgroundColor: '#1e1e1e',
            padding: '16px',
            borderRadius: '8px',
            border: '1px solid #333'
          }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '13px', textTransform: 'uppercase', color: '#ff8c00', letterSpacing: '0.05em' }}>Roof Config</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#888', marginBottom: '4px' }}>Overhang (m)</label>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    max="1.5"
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
            </div>
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


          {/* Material Take-off List */}
          <section style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', textTransform: 'uppercase', color: '#ff8c00', letterSpacing: '0.05em' }}>
              Material Take-off (BOM)
            </h3>

            {/* View Mode Toggle */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <button
                onClick={() => setBomViewMode('walls')}
                style={{
                  flex: 1,
                  padding: '8px',
                  backgroundColor: bomViewMode === 'walls' ? '#ff8c00' : '#333',
                  color: bomViewMode === 'walls' ? '#000' : '#ccc',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '11px',
                }}
              >
                Wall-by-Wall Plans
              </button>
              <button
                onClick={() => setBomViewMode('global')}
                style={{
                  flex: 1,
                  padding: '8px',
                  backgroundColor: bomViewMode === 'global' ? '#ff8c00' : '#333',
                  color: bomViewMode === 'global' ? '#000' : '#ccc',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '11px',
                }}
              >
                Global Cut List
              </button>
            </div>
            
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
                      {screwCount > 0 && <li>Ground screws: {screwCount}</li>}
                    </ul>
                  </div>
                </div>

                {bomViewMode === 'walls' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '4px' }}>
                    {floors.map((floor) => {
                      const floorJoists = framing.filter(m => m.floorId === floor.id && m.type === 'joist' && !m.id.startsWith('roof-'));
                      const foundationScrews = framing.filter(m => m.floorId === floor.id && m.type === 'screw');
                      
                      return (
                        <div key={floor.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            color: '#ff8c00',
                            borderBottom: '1px solid #444',
                            paddingBottom: '4px',
                            marginTop: '8px',
                          }}>
                            {floor.level === 0 ? 'Ground Floor' : `Floor ${floor.level + 1}`}
                          </div>

                          {/* Floor Joists Frame */}
                          {floorJoists.length > 0 && (() => {
                            const joistsKey = `${floor.id}-joists`;
                            const isJoistsSelected = selectedType === 'floor' && selectedId === floor.id;
                            const isExpanded = expandedWalls[joistsKey] || isJoistsSelected;
                            
                            return (
                              <div style={{
                                backgroundColor: isJoistsSelected ? '#26211a' : '#1e1e1e',
                                borderRadius: '6px',
                                border: isJoistsSelected ? '1px solid #ff8c00' : '1px solid #333',
                                boxShadow: isJoistsSelected ? '0 0 8px rgba(255, 140, 0, 0.2)' : 'none',
                                overflow: 'hidden',
                              }}>
                                <div
                                  onClick={() => {
                                    if (isJoistsSelected) {
                                      selectObject(null, null);
                                      setExpandedWalls(prev => ({ ...prev, [joistsKey]: false }));
                                    } else {
                                      selectObject(floor.id, 'floor');
                                      setExpandedWalls(prev => ({ ...prev, [joistsKey]: true }));
                                    }
                                  }}
                                  style={{
                                    padding: '10px 12px',
                                    backgroundColor: isJoistsSelected ? '#3a2d1d' : '#2a2a2a',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                  }}
                                >
                                  <div>
                                    <strong style={{ fontSize: '11px', color: isJoistsSelected ? '#ff8c00' : '#eee' }}>Floor Joists Frame</strong>
                                    <span style={{ fontSize: '10px', color: '#888', marginLeft: '8px' }}>
                                      ({floorJoists.length} pcs)
                                    </span>
                                  </div>
                                  <span style={{ fontSize: '10px', color: '#ff8c00' }}>
                                    {isExpanded ? '▲ Collapse' : '▼ Expand'}
                                  </span>
                                </div>
                                {isExpanded && (
                                  <div style={{ padding: '10px', backgroundColor: '#151515' }}>
                                    {renderJoistsCutList(floorJoists, getCutIdentifier)}
                                  </div>
                                )}
                              </div>
                            );
                          })()}

                          {/* Foundation Screws (Only for Floor 0 if screws foundation) */}
                          {floor.level === 0 && foundationScrews.length > 0 && (() => {
                            const isScrewsExpanded = expandedWalls['foundation-screws'];
                            return (
                              <div style={{
                                backgroundColor: '#1e1e1e',
                                borderRadius: '6px',
                                border: '1px solid #333',
                                overflow: 'hidden',
                              }}>
                                <div
                                  onClick={() => setExpandedWalls(prev => ({ ...prev, 'foundation-screws': !prev['foundation-screws'] }))}
                                  style={{
                                    padding: '10px 12px',
                                    backgroundColor: '#2a2a2a',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                  }}
                                >
                                  <div>
                                    <strong style={{ fontSize: '11px', color: '#eee' }}>Ground Screws Foundation</strong>
                                    <span style={{ fontSize: '10px', color: '#888', marginLeft: '8px' }}>
                                      ({foundationScrews.length} screws)
                                    </span>
                                  </div>
                                  <span style={{ fontSize: '10px', color: '#ff8c00' }}>
                                    {isScrewsExpanded ? '▲ Collapse' : '▼ Expand'}
                                  </span>
                                </div>
                                {isScrewsExpanded && (
                                  <div style={{ padding: '10px', backgroundColor: '#151515' }}>
                                    {renderScrewsCutList(foundationScrews, getCutIdentifier)}
                                  </div>
                                )}
                              </div>
                            );
                          })()}

                          {/* Wall Framing */}
                          {floor.walls.map((wall) => {
                            const wallKey = `${floor.id}-${wall.id}`;
                            const wallMembers = framing.filter(m => m.floorId === floor.id && m.wallId === wall.id);
                            
                            const dx = wall.end[0] - wall.start[0];
                            const dz = wall.end[1] - wall.start[1];
                            const wallLength = Math.sqrt(dx * dx + dz * dz);
                            
                            const wallTitle = wall.id === 'wall-front' ? 'Front Wall' :
                                              wall.id === 'wall-back' ? 'Back Wall' :
                                              wall.id === 'wall-left' ? 'Left Wall' :
                                              wall.id === 'wall-right' ? 'Right Wall' : wall.id;

                            const isWallSelected = selectedType === 'wall' && selectedId === wallKey;
                            const isExpanded = expandedWalls[wallKey] || isWallSelected;

                            return (
                              <div
                                key={wall.id}
                                style={{
                                  backgroundColor: isWallSelected ? '#26211a' : '#1e1e1e',
                                  borderRadius: '6px',
                                  border: isWallSelected ? '1px solid #ff8c00' : '1px solid #333',
                                  boxShadow: isWallSelected ? '0 0 8px rgba(255, 140, 0, 0.2)' : 'none',
                                  overflow: 'hidden',
                                }}
                              >
                                <div
                                  onClick={() => {
                                    if (isWallSelected) {
                                      selectObject(null, null);
                                      setExpandedWalls(prev => ({ ...prev, [wallKey]: false }));
                                    } else {
                                      selectObject(wallKey, 'wall');
                                      setExpandedWalls(prev => ({ ...prev, [wallKey]: true }));
                                    }
                                  }}
                                  style={{
                                    padding: '10px 12px',
                                    backgroundColor: isWallSelected ? '#3a2d1d' : '#2a2a2a',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                  }}
                                >
                                  <div>
                                    <strong style={{ fontSize: '11px', color: isWallSelected ? '#ff8c00' : '#eee' }}>{wallTitle}</strong>
                                    <span style={{ fontSize: '10px', color: '#888', marginLeft: '8px' }}>
                                      ({wallLength.toFixed(2)}m, {wallMembers.length} pcs)
                                    </span>
                                  </div>
                                  <span style={{ fontSize: '10px', color: '#ff8c00' }}>
                                    {isExpanded ? '▲ Collapse' : '▼ Expand'}
                                  </span>
                                </div>

                                {isExpanded && (
                                  <div style={{ padding: '10px', backgroundColor: '#151515', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {wall.subObjects.length > 0 && (
                                      <div style={{ fontSize: '10px', color: '#aaa', backgroundColor: '#222', padding: '6px 8px', borderRadius: '4px', borderLeft: '3px solid #ff8c00' }}>
                                        <strong>Openings:</strong> {wall.subObjects.map((obj: any) => `${obj.type.toUpperCase()} (W: ${obj.width.toFixed(2)}m, H: ${obj.height.toFixed(2)}m, Pos: ${obj.position.toFixed(2)}m)`).join(', ')}
                                      </div>
                                    )}
                                    {wallMembers.length === 0 ? (
                                      <p style={{ fontSize: '11px', color: '#666', fontStyle: 'italic', margin: 0 }}>No framing generated for this wall.</p>
                                    ) : (
                                      renderWallFramingCutList(wallMembers, wall, getCutIdentifier)
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}

                    {/* Roof Framing */}
                    {(() => {
                      const roofMembers = framing.filter(m => !m.floorId && !m.wallId);
                      if (roofMembers.length === 0) return null;

                      const isRoofSelected = selectedType === 'roof' && selectedId === 'roof';
                      const isExpanded = expandedWalls['roof-framing'] || isRoofSelected;

                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            color: '#ff8c00',
                            borderBottom: '1px solid #444',
                            paddingBottom: '4px',
                            marginTop: '8px',
                          }}>
                            Roof Framing
                          </div>

                          <div style={{
                            backgroundColor: isRoofSelected ? '#26211a' : '#1e1e1e',
                            borderRadius: '6px',
                            border: isRoofSelected ? '1px solid #ff8c00' : '1px solid #333',
                            boxShadow: isRoofSelected ? '0 0 8px rgba(255, 140, 0, 0.2)' : 'none',
                            overflow: 'hidden',
                          }}>
                            <div
                              onClick={() => {
                                if (isRoofSelected) {
                                  selectObject(null, null);
                                  setExpandedWalls(prev => ({ ...prev, ['roof-framing']: false }));
                                } else {
                                  selectObject('roof', 'roof');
                                  setExpandedWalls(prev => ({ ...prev, ['roof-framing']: true }));
                                }
                              }}
                              style={{
                                padding: '10px 12px',
                                backgroundColor: isRoofSelected ? '#3a2d1d' : '#2a2a2a',
                                cursor: 'pointer',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                              }}
                            >
                              <div>
                                <strong style={{ fontSize: '11px', color: isRoofSelected ? '#ff8c00' : '#eee' }}>Roof Truss & Rafters</strong>
                                <span style={{ fontSize: '10px', color: '#888', marginLeft: '8px' }}>
                                  ({roofMembers.length} pcs)
                                </span>
                              </div>
                              <span style={{ fontSize: '10px', color: '#ff8c00' }}>
                                {isExpanded ? '▲ Collapse' : '▼ Expand'}
                              </span>
                            </div>
                            {isExpanded && (
                              <div style={{ padding: '10px', backgroundColor: '#151515' }}>
                                {renderRoofCutList(roofMembers, getCutIdentifier)}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  /* Consolidated/Global List Table */
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
                        {bomListWithIds.map((item, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #2a2a2a' }}>
                            <td style={{ padding: '6px 4px', color: '#e0e0e0' }}>
                              <span style={{ color: '#ff8c00', fontWeight: 700, marginRight: '6px' }}>{item.idNum}</span>
                              {item.nominal}
                            </td>
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
                )}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// HELPER FUNCTIONS FOR BILL OF MATERIALS & CUT LISTS
// ============================================================================

const getWallMemberDetails = (member: FramingMember, wall: any) => {
  const [startX, startZ] = wall.start;
  const [endX, endZ] = wall.end;
  const dx = endX - startX;
  const dz = endZ - startZ;
  const wallLength = Math.sqrt(dx * dx + dz * dz);
  
  const unitX = dx / (wallLength || 1);
  const unitZ = dz / (wallLength || 1);

  const [px, , pz] = member.position;
  // Project member coordinates onto wall direction vector to get local offset
  const localX = (px - startX) * unitX + (pz - startZ) * unitZ;

  // Group label/role mapping
  let role = 'Stud';
  if (member.id.includes('bottom-plate')) role = 'Bottom Plate';
  else if (member.id.includes('top-plate-1')) role = 'Top Plate (Lower)';
  else if (member.id.includes('top-plate-2')) role = 'Top Plate (Upper)';
  else if (member.id.includes('stud-start') || member.id.includes('stud-end')) role = 'Corner Stud';
  else if (member.id.includes('corner-backing')) role = 'Corner Backing Stud';
  else if (member.id.includes('spaced')) role = 'Common Stud';
  else if (member.id.includes('king')) role = 'King Stud';
  else if (member.id.includes('jack')) role = 'Jack Stud';
  else if (member.id.includes('header')) role = 'Header';
  else if (member.id.includes('sill')) role = 'Window Sill';
  else if (member.id.includes('cripple-under')) role = 'Under-Sill Cripple';
  else if (member.id.includes('cripple-above')) role = 'Over-Header Cripple';

  const [w, h, d] = member.size;
  const len = Math.max(w, h, d);

  // Determine nominal size
  const sortedDims = [...member.size].sort((a, b) => a - b);
  const midDim = sortedDims[1];
  const nominal = midDim > 0.1 || member.type === 'header' ? '2x6 (40x140mm)' : '2x4 (40x90mm)';

  const isVertical = member.type === 'stud';

  return {
    nominal,
    role,
    len,
    localX,
    isVertical,
  };
};

const renderWallFramingCutList = (
  members: FramingMember[],
  wall: any,
  getCutIdentifier: (nominal: string, length: number) => string
) => {
  const groups: {
    [key: string]: {
      nominal: string;
      role: string;
      length: number;
      count: number;
      positions: number[];
      isVertical: boolean;
    }
  } = {};

  members.forEach((m) => {
    const details = getWallMemberDetails(m, wall);
    const key = `${details.nominal}-${details.role}-${details.len.toFixed(3)}`;
    if (!groups[key]) {
      groups[key] = {
        nominal: details.nominal,
        role: details.role,
        length: details.len,
        count: 0,
        positions: [],
        isVertical: details.isVertical,
      };
    }
    groups[key].count++;
    groups[key].positions.push(details.localX);
  });

  const sortedGroups = Object.values(groups).sort((a, b) => {
    // Sort plates first, then studs by length descending
    if (a.role.includes('Plate') && !b.role.includes('Plate')) return -1;
    if (!a.role.includes('Plate') && b.role.includes('Plate')) return 1;
    return b.length - a.length;
  });

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #333', color: '#888' }}>
            <th style={{ padding: '6px 4px' }}>Nominal</th>
            <th style={{ padding: '6px 4px' }}>Component</th>
            <th style={{ padding: '6px 4px', textAlign: 'right' }}>Len (m)</th>
            <th style={{ padding: '6px 4px', textAlign: 'right' }}>Qty</th>
            <th style={{ padding: '6px 4px' }}>Placement Offsets / Spans</th>
          </tr>
        </thead>
        <tbody>
          {sortedGroups.map((g, idx) => {
            let placementText = '';
            if (g.isVertical) {
              const sortedPos = [...g.positions].sort((a, b) => a - b);
              placementText = sortedPos.map(p => `${p.toFixed(2)}m`).join(', ');
            } else {
              const sortedSpans = [...g.positions].map(center => {
                const start = Math.max(0, center - g.length / 2);
                const end = center + g.length / 2;
                return `spans ${start.toFixed(2)}m-${end.toFixed(2)}m`;
              }).join(', ');
              placementText = sortedSpans;
            }

            const idNum = getCutIdentifier(g.nominal, g.length);

            return (
              <tr key={idx} style={{ borderBottom: '1px solid #2a2a2a' }}>
                <td style={{ padding: '6px 4px', color: '#ccc' }}>
                  {idNum ? (
                    <>
                      <span style={{ color: '#ff8c00', fontWeight: 700, marginRight: '6px' }}>{idNum}</span>
                      {g.nominal}
                    </>
                  ) : g.nominal}
                </td>
                <td style={{ padding: '6px 4px', color: '#eee', fontWeight: 600 }}>{g.role}</td>
                <td style={{ padding: '6px 4px', textAlign: 'right', color: '#bbb' }}>{g.length.toFixed(2)}</td>
                <td style={{ padding: '6px 4px', textAlign: 'right', color: '#bbb' }}>{g.count}</td>
                <td style={{ padding: '6px 4px', color: '#ff8c00', fontSize: '10px', fontFamily: 'monospace' }}>
                  {placementText}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const renderJoistsCutList = (
  joists: FramingMember[],
  getCutIdentifier: (nominal: string, length: number) => string
) => {
  const groups: {
    [key: string]: {
      nominal: string;
      type: string;
      length: number;
      count: number;
    }
  } = {};

  joists.forEach((j) => {
    const [w, h, d] = j.size;
    const len = Math.max(w, h, d);
    const nominal = d > 0.1 || j.type === 'joist' || j.id.includes('rim')
      ? '2x6 (40x140mm)'
      : '2x4 (40x90mm)';

    let typeLabel = j.id.includes('rim') ? 'Rim Joist' : (j.id.includes('header') ? 'Stair Header' : 'Floor Joist');
    const key = `${nominal}-${typeLabel}-${len.toFixed(3)}`;

    if (!groups[key]) {
      groups[key] = {
        nominal,
        type: typeLabel,
        length: len,
        count: 0,
      };
    }
    groups[key].count++;
  });

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #333', color: '#888' }}>
            <th style={{ padding: '6px 4px' }}>Nominal</th>
            <th style={{ padding: '6px 4px' }}>Component</th>
            <th style={{ padding: '6px 4px', textAlign: 'right' }}>Len (m)</th>
            <th style={{ padding: '6px 4px', textAlign: 'right' }}>Qty</th>
            <th style={{ padding: '6px 4px', textAlign: 'right' }}>Total (m)</th>
          </tr>
        </thead>
        <tbody>
          {Object.values(groups).map((g, idx) => {
            const idNum = getCutIdentifier(g.nominal, g.length);
            return (
              <tr key={idx} style={{ borderBottom: '1px solid #2a2a2a' }}>
                <td style={{ padding: '6px 4px', color: '#ccc' }}>
                  {idNum ? (
                    <>
                      <span style={{ color: '#ff8c00', fontWeight: 700, marginRight: '6px' }}>{idNum}</span>
                      {g.nominal}
                    </>
                  ) : g.nominal}
                </td>
                <td style={{ padding: '6px 4px', color: '#eee', fontWeight: 600 }}>{g.type}</td>
                <td style={{ padding: '6px 4px', textAlign: 'right', color: '#bbb' }}>{g.length.toFixed(2)}</td>
                <td style={{ padding: '6px 4px', textAlign: 'right', color: '#bbb' }}>{g.count}</td>
                <td style={{ padding: '6px 4px', textAlign: 'right', color: '#fff', fontWeight: 600 }}>
                  {(g.length * g.count).toFixed(2)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const renderRoofCutList = (
  roofMembers: FramingMember[],
  getCutIdentifier: (nominal: string, length: number) => string
) => {
  const groups: {
    [key: string]: {
      nominal: string;
      type: string;
      length: number;
      count: number;
    }
  } = {};

  roofMembers.forEach((r) => {
    const [w, h, d] = r.size;
    const len = Math.max(w, h, d);
    const nominal = d > 0.1 || r.type === 'rafter' || r.type === 'ridge'
      ? '2x6 (40x140mm)'
      : '2x4 (40x90mm)';

    let typeLabel = r.type === 'ridge' ? 'Ridge Beam' : (r.type === 'rafter' ? 'Rafter' : 'Collar Tie');
    if (r.id.includes('collar-tie')) {
      typeLabel = 'Collar Tie';
    }
    const key = `${nominal}-${typeLabel}-${len.toFixed(3)}`;

    if (!groups[key]) {
      groups[key] = {
        nominal,
        type: typeLabel,
        length: len,
        count: 0,
      };
    }
    groups[key].count++;
  });

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #333', color: '#888' }}>
            <th style={{ padding: '6px 4px' }}>Nominal</th>
            <th style={{ padding: '6px 4px' }}>Component</th>
            <th style={{ padding: '6px 4px', textAlign: 'right' }}>Len (m)</th>
            <th style={{ padding: '6px 4px', textAlign: 'right' }}>Qty</th>
            <th style={{ padding: '6px 4px', textAlign: 'right' }}>Total (m)</th>
          </tr>
        </thead>
        <tbody>
          {Object.values(groups).map((g, idx) => {
            const idNum = getCutIdentifier(g.nominal, g.length);
            return (
              <tr key={idx} style={{ borderBottom: '1px solid #2a2a2a' }}>
                <td style={{ padding: '6px 4px', color: '#ccc' }}>
                  {idNum ? (
                    <>
                      <span style={{ color: '#ff8c00', fontWeight: 700, marginRight: '6px' }}>{idNum}</span>
                      {g.nominal}
                    </>
                  ) : g.nominal}
                </td>
                <td style={{ padding: '6px 4px', color: '#eee', fontWeight: 600 }}>{g.type}</td>
                <td style={{ padding: '6px 4px', textAlign: 'right', color: '#bbb' }}>{g.length.toFixed(2)}</td>
                <td style={{ padding: '6px 4px', textAlign: 'right', color: '#bbb' }}>{g.count}</td>
                <td style={{ padding: '6px 4px', textAlign: 'right', color: '#fff', fontWeight: 600 }}>
                  {(g.length * g.count).toFixed(2)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const renderScrewsCutList = (
  screws: FramingMember[],
  getCutIdentifier: (nominal: string, length: number) => string
) => {
  if (screws.length === 0) return null;
  const firstScrew = screws[0];
  const diameter = Math.round(firstScrew.size[0] * 1000);
  const length = Math.round(firstScrew.size[1] * 1000);
  const dimensionsStr = `${diameter}mm x ${length}mm`;

  const [w, h, d] = firstScrew.size;
  const len = Math.max(w, h, d);
  const nominal = "Steel Ground Screw (76x800mm)";
  const idNum = getCutIdentifier(nominal, len);

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #333', color: '#888' }}>
            <th style={{ padding: '6px 4px' }}>Component</th>
            <th style={{ padding: '6px 4px' }}>Dimensions</th>
            <th style={{ padding: '6px 4px', textAlign: 'right' }}>Qty</th>
          </tr>
        </thead>
        <tbody>
          <tr style={{ borderBottom: '1px solid #2a2a2a' }}>
            <td style={{ padding: '6px 4px', color: '#eee', fontWeight: 600 }}>
              {idNum ? (
                <>
                  <span style={{ color: '#ff8c00', fontWeight: 700, marginRight: '6px' }}>{idNum}</span>
                  Steel Ground Screw
                </>
              ) : 'Steel Ground Screw'}
            </td>
            <td style={{ padding: '6px 4px', color: '#ccc' }}>{dimensionsStr}</td>
            <td style={{ padding: '6px 4px', textAlign: 'right', color: '#bbb' }}>{screws.length}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

