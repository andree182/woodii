import { useProjectStore } from '../../store';

export default function GlobalTab() {
  const {
    dimensions,
    foundation,
    wallLayers,
    wallPreset,
    structuralConfig,
    floors,
    wallCovers,

    setDimensions,
    setFoundationConfig,
    setWallLayers,
    setWallPreset,
    setStructuralConfig,
    setWallCoversConfig,
    addFloor,
    removeLastFloor,
    resetProject,
  } = useProjectStore();

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

  return (
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '24px', flex: 1, overflowY: 'auto' }}>
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

      {/* Wall Sheathing & Covers Config */}
      <section>
        <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', textTransform: 'uppercase', color: '#ff8c00', letterSpacing: '0.05em' }}>Wall Cladding & Lining</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* External Cladding */}
          <div style={{ backgroundColor: '#1a1a1a', padding: '12px', borderRadius: '6px', border: '1px solid #333' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#ff8c00', textTransform: 'uppercase', fontWeight: 600 }}>External Cladding</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '10px', color: '#888', marginBottom: '2px' }}>Material Type</label>
                <select
                  value={wallCovers.external.material || 'rhombus'}
                  onChange={(e) => {
                    const material = e.target.value as any;
                    if (material === 'rhombus') {
                      setWallCoversConfig('external', { material, width: 0.09, length: 4.0, thickness: 0.02, gap: 0.01 });
                    } else if (material === 'decking') {
                      setWallCoversConfig('external', { material, width: 0.12, length: 4.0, thickness: 0.02, gap: 0.002 });
                    } else if (material === 'osb_1250') {
                      setWallCoversConfig('external', { material, width: 1.25, length: 2.50, thickness: 0.012, gap: 0 });
                    } else if (material === 'osb_625') {
                      setWallCoversConfig('external', { material, width: 0.625, length: 2.50, thickness: 0.012, gap: 0 });
                    } else {
                      setWallCoversConfig('external', { material, width: 0, length: 0, thickness: 0, gap: 0 });
                    }
                  }}
                  style={{ width: '100%', padding: '6px', backgroundColor: '#121212', border: '1px solid #333', borderRadius: '4px', color: '#e0e0e0', fontSize: '11px' }}
                >
                  <option value="rhombus">Rhombus Wood Battens</option>
                  <option value="decking">Classic Wooden Decking</option>
                  <option value="osb_1250">OSB Board (2500x1250mm)</option>
                  <option value="osb_625">OSB Board (2500x625mm)</option>
                  <option value="none">None (No external cladding)</option>
                </select>
              </div>

              {wallCovers.external.material !== 'none' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '9px', color: '#888', marginBottom: '2px' }}>Width (m)</label>
                      <input
                        type="number"
                        step="0.005"
                        min="0.01"
                        value={wallCovers.external.width}
                        onChange={(e) => setWallCoversConfig('external', { width: parseFloat(e.target.value) || 0.01 })}
                        style={{ width: '100%', padding: '5px', backgroundColor: '#121212', border: '1px solid #333', borderRadius: '4px', color: '#fff', fontSize: '11px' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '9px', color: '#888', marginBottom: '2px' }}>Length / Board (m)</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0.5"
                        value={wallCovers.external.length}
                        onChange={(e) => setWallCoversConfig('external', { length: parseFloat(e.target.value) || 0.5 })}
                        style={{ width: '100%', padding: '5px', backgroundColor: '#121212', border: '1px solid #333', borderRadius: '4px', color: '#fff', fontSize: '11px' }}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '9px', color: '#888', marginBottom: '2px' }}>Thickness (m)</label>
                      <input
                        type="number"
                        step="0.001"
                        min="0.002"
                        value={wallCovers.external.thickness}
                        onChange={(e) => setWallCoversConfig('external', { thickness: parseFloat(e.target.value) || 0.002 })}
                        style={{ width: '100%', padding: '5px', backgroundColor: '#121212', border: '1px solid #333', borderRadius: '4px', color: '#fff', fontSize: '11px' }}
                      />
                    </div>
                    {(wallCovers.external.material === 'rhombus' || wallCovers.external.material === 'decking') && (
                      <div>
                        <label style={{ display: 'block', fontSize: '9px', color: '#888', marginBottom: '2px' }}>Joint Gap (m)</label>
                        <input
                          type="number"
                          step="0.001"
                          min="0"
                          value={wallCovers.external.gap || 0}
                          onChange={(e) => setWallCoversConfig('external', { gap: parseFloat(e.target.value) || 0 })}
                          style={{ width: '100%', padding: '5px', backgroundColor: '#121212', border: '1px solid #333', borderRadius: '4px', color: '#fff', fontSize: '11px' }}
                        />
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Internal Lining */}
          <div style={{ backgroundColor: '#1a1a1a', padding: '12px', borderRadius: '6px', border: '1px solid #333' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#ff8c00', textTransform: 'uppercase', fontWeight: 600 }}>Internal Lining</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '10px', color: '#888', marginBottom: '2px' }}>Material Type</label>
                <select
                  value={wallCovers.internal.material || 'osb_1250'}
                  onChange={(e) => {
                    const material = e.target.value as any;
                    if (material === 'decking') {
                      setWallCoversConfig('internal', { material, width: 0.09, length: 4.0, thickness: 0.015, gap: 0 });
                    } else if (material === 'osb_1250') {
                      setWallCoversConfig('internal', { material, width: 1.25, length: 2.50, thickness: 0.012, gap: 0 });
                    } else if (material === 'osb_625') {
                      setWallCoversConfig('internal', { material, width: 0.625, length: 2.50, thickness: 0.012, gap: 0 });
                    } else if (material === 'plasterboard') {
                      setWallCoversConfig('internal', { material, width: 1.20, length: 2.0, thickness: 0.0125, gap: 0 });
                    } else {
                      setWallCoversConfig('internal', { material, width: 0, length: 0, thickness: 0, gap: 0 });
                    }
                  }}
                  style={{ width: '100%', padding: '6px', backgroundColor: '#121212', border: '1px solid #333', borderRadius: '4px', color: '#e0e0e0', fontSize: '11px' }}
                >
                  <option value="osb_1250">OSB Board (2500x1250mm)</option>
                  <option value="osb_625">OSB Board (2500x625mm)</option>
                  <option value="plasterboard">Plasterboard (2000x1200mm)</option>
                  <option value="decking">Wooden Decking (cladding)</option>
                  <option value="none">None (Open studs)</option>
                </select>
              </div>

              {wallCovers.internal.material !== 'none' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '9px', color: '#888', marginBottom: '2px' }}>Width (m)</label>
                      <input
                        type="number"
                        step="0.005"
                        min="0.01"
                        value={wallCovers.internal.width}
                        onChange={(e) => setWallCoversConfig('internal', { width: parseFloat(e.target.value) || 0.01 })}
                        style={{ width: '100%', padding: '5px', backgroundColor: '#121212', border: '1px solid #333', borderRadius: '4px', color: '#fff', fontSize: '11px' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '9px', color: '#888', marginBottom: '2px' }}>Length / Board (m)</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0.5"
                        value={wallCovers.internal.length}
                        onChange={(e) => setWallCoversConfig('internal', { length: parseFloat(e.target.value) || 0.5 })}
                        style={{ width: '100%', padding: '5px', backgroundColor: '#121212', border: '1px solid #333', borderRadius: '4px', color: '#fff', fontSize: '11px' }}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '9px', color: '#888', marginBottom: '2px' }}>Thickness (m)</label>
                      <input
                        type="number"
                        step="0.001"
                        min="0.002"
                        value={wallCovers.internal.thickness}
                        onChange={(e) => setWallCoversConfig('internal', { thickness: parseFloat(e.target.value) || 0.002 })}
                        style={{ width: '100%', padding: '5px', backgroundColor: '#121212', border: '1px solid #333', borderRadius: '4px', color: '#fff', fontSize: '11px' }}
                      />
                    </div>
                    {wallCovers.internal.material === 'decking' && (
                      <div>
                        <label style={{ display: 'block', fontSize: '9px', color: '#888', marginBottom: '2px' }}>Joint Gap (m)</label>
                        <input
                          type="number"
                          step="0.001"
                          min="0"
                          value={wallCovers.internal.gap || 0}
                          onChange={(e) => setWallCoversConfig('internal', { gap: parseFloat(e.target.value) || 0 })}
                          style={{ width: '100%', padding: '5px', backgroundColor: '#121212', border: '1px solid #333', borderRadius: '4px', color: '#fff', fontSize: '11px' }}
                        />
                      </div>
                    )}
                  </div>
                </>
              )}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              id="show-dimensions-toggle"
              checked={structuralConfig?.showDimensionsOnDrag !== false}
              onChange={(e) => setStructuralConfig({ showDimensionsOnDrag: e.target.checked })}
              style={{ cursor: 'pointer' }}
            />
            <label htmlFor="show-dimensions-toggle" style={{ fontSize: '11px', color: '#ccc', cursor: 'pointer' }}>
              Show Dimensions While Dragging
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
  );
}
