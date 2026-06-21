import { useEffect, useState } from 'react';
import { useProjectStore } from '../store';

export default function HelpModal() {
  const showHelpModal = useProjectStore((state) => state.uiState.showHelpModal);
  const updateUIState = useProjectStore((state) => state.updateUIState);
  
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'controls' | 'editing' | 'bom'>('overview');
  const [dontShowAgain, setDontShowAgain] = useState(false);

  // Auto-pop logic for first visit
  useEffect(() => {
    const hasSeenIntro = localStorage.getItem('woodii-has-seen-intro') === 'true';
    if (!hasSeenIntro) {
      updateUIState({ showHelpModal: true });
    }
  }, [updateUIState]);

  if (!showHelpModal) return null;

  const handleClose = () => {
    if (dontShowAgain) {
      localStorage.setItem('woodii-has-seen-intro', 'true');
    }
    updateUIState({ showHelpModal: false });
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(0, 0, 0, 0.85)',
      backdropFilter: 'blur(8px)',
      zIndex: 99999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      boxSizing: 'border-box'
    }}>
      <div style={{
        backgroundColor: '#151515',
        border: '1px solid rgba(255, 140, 0, 0.3)',
        borderRadius: '12px',
        width: '100%',
        maxWidth: '750px',
        height: '100%',
        maxHeight: '550px',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8), 0 0 30px rgba(255, 140, 0, 0.05)',
        overflow: 'hidden',
        color: '#e0e0e0',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #222',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'linear-gradient(90deg, #151515 0%, #1e1510 100%)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '24px' }}>🪵</span>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#ff8c00', letterSpacing: '0.03em' }}>
                WOODII 3D DESIGNER
              </h2>
              <p style={{ margin: '2px 0 0 0', fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Interactive User & Framing Guide
              </p>
            </div>
          </div>
          <button 
            onClick={handleClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#888',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '4px',
              transition: 'color 0.2s, transform 0.2s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.color = '#ff8c00';
              e.currentTarget.style.transform = 'scale(1.15)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.color = '#888';
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            ✕
          </button>
        </div>

        {/* Tab Buttons */}
        <div style={{
          display: 'flex',
          backgroundColor: '#0c0c0c',
          borderBottom: '1px solid #222',
          padding: '0 12px'
        }}>
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'controls', label: 'View Controls' },
            { id: 'editing', label: 'Editing Guide' },
            { id: 'bom', label: 'Bill of Materials (BOM)' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              style={{
                padding: '12px 16px',
                background: 'none',
                border: 'none',
                color: activeSubTab === tab.id ? '#ff8c00' : '#888',
                borderBottom: activeSubTab === tab.id ? '2px solid #ff8c00' : '2px solid transparent',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div style={{
          flex: 1,
          padding: '24px',
          overflowY: 'auto',
          boxSizing: 'border-box',
          fontSize: '13px',
          lineHeight: '1.6'
        }}>
          {activeSubTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p style={{ margin: 0, color: '#b0b0b0' }}>
                <strong>Woodii</strong> is a premium, web-based 3D design workspace designed for compiling complete construction blueprints, noggings layout structures, and wood schedules for timber frame projects.
              </p>
              
              <h4 style={{ margin: '8px 0 4px 0', color: '#ff8c00', fontSize: '13px', textTransform: 'uppercase' }}>Key Features Include:</h4>
              <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px', color: '#ccc' }}>
                <li><strong>Saddle & Flat Roofs:</strong> Automatic angle inclination calculation, collar-tie width adjustments, and roof opening ceiling frames.</li>
                <li><strong>Pier & Ground Screw Foundations:</strong> Load grid generators to layout pier screw foundation configurations automatically.</li>
                <li><strong>Siding Thickness Presets:</strong> Choose between Diffusion-Open (siding + studs + OSB inner lining), Diffusion-Closed (reveals the inner stud structure), or fully customized layers.</li>
                <li><strong>Staggered Blocking (Noggings):</strong> Mid-height structural blocks in walls and floor joists staggered for lateral load resistance.</li>
                <li><strong>Internal Partition Walls:</strong> Create and arrange internal partition walls with custom timber dimensions (e.g. 2x3 lumber) and door frames.</li>
              </ul>
            </div>
          )}

          {activeSubTab === 'controls' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p style={{ margin: 0, color: '#b0b0b0' }}>
                Seamlessly toggle between three viewports to examine framing structures from all angles:
              </p>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ backgroundColor: '#1c1c1c', padding: '12px', borderRadius: '8px', border: '1px solid #2a2a2a' }}>
                  <strong style={{ color: '#ff8c00', fontSize: '12px' }}>🛰️ Orbit Mode</strong>
                  <ul style={{ margin: '8px 0 0 0', paddingLeft: '16px', fontSize: '11px', color: '#ccc' }}>
                    <li><strong>Rotate View:</strong> Left Click + Drag</li>
                    <li><strong>Pan Camera:</strong> Right Click + Drag</li>
                    <li><strong>Zoom In/Out:</strong> Scroll Wheel</li>
                  </ul>
                </div>
                
                <div style={{ backgroundColor: '#1c1c1c', padding: '12px', borderRadius: '8px', border: '1px solid #2a2a2a' }}>
                  <strong style={{ color: '#ff8c00', fontSize: '12px' }}>📐 Orthographic Top-Down</strong>
                  <ul style={{ margin: '8px 0 0 0', paddingLeft: '16px', fontSize: '11px', color: '#ccc' }}>
                    <li><strong>Pan View:</strong> Left Click + Drag</li>
                    <li><strong>Zoom:</strong> Scroll Wheel</li>
                    <li>Perfect for drawing and moving partition walls.</li>
                  </ul>
                </div>

                <div style={{ backgroundColor: '#1c1c1c', padding: '12px', borderRadius: '8px', border: '1px solid #2a2a2a', gridColumn: 'span 2' }}>
                  <strong style={{ color: '#ff8c00', fontSize: '12px' }}>🚶 First-Person Walking Mode</strong>
                  <ul style={{ margin: '8px 0 0 0', paddingLeft: '16px', fontSize: '11px', color: '#ccc' }}>
                    <li><strong>Walk Around:</strong> Use <kbd style={{ background: '#222', padding: '2px 4px', border: '1px solid #444', borderRadius: '4px' }}>W</kbd> <kbd style={{ background: '#222', padding: '2px 4px', border: '1px solid #444', borderRadius: '4px' }}>A</kbd> <kbd style={{ background: '#222', padding: '2px 4px', border: '1px solid #444', borderRadius: '4px' }}>S</kbd> <kbd style={{ background: '#222', padding: '2px 4px', border: '1px solid #444', borderRadius: '4px' }}>D</kbd> or Arrow Keys.</li>
                    <li><strong>Look Around:</strong> Drag with Left Click (or click inside viewport to lock mouse cursor; press <kbd style={{ background: '#222', padding: '2px 4px', border: '1px solid #444', borderRadius: '4px' }}>Esc</kbd> to unlock).</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {activeSubTab === 'editing' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <h4 style={{ margin: 0, color: '#ff8c00', fontSize: '13px', textTransform: 'uppercase' }}>1. Modifying Wall Footprints:</h4>
              <p style={{ margin: 0, color: '#ccc' }}>
                Select the <strong>Top-Down</strong> view. Click and drag the orange handles at the wall endpoints, or click on a wall and adjust dimensions directly in the <strong>Selection</strong> tab.
              </p>

              <h4 style={{ margin: '8px 0 0 0', color: '#ff8c00', fontSize: '13px', textTransform: 'uppercase' }}>2. Placing Wall Openings:</h4>
              <p style={{ margin: 0, color: '#ccc' }}>
                Select a wall, click "Add Door" or "Add Window" in the sidebar, and drag the opening horizontally (or vertically for windows) inside the 3D viewport. Floating dimension guides will show exact offsets and size limits automatically.
              </p>

              <h4 style={{ margin: '8px 0 0 0', color: '#ff8c00', fontSize: '13px', textTransform: 'uppercase' }}>3. Adding Partition Walls:</h4>
              <p style={{ margin: 0, color: '#ccc' }}>
                Go to the Sidebar's <strong>Global</strong> tab under a floor panel, click "Add Internal Partition", and define its coordinates. In top-down view, you can drag endpoints or rotate them in 22.5° snaps.
              </p>
            </div>
          )}

          {activeSubTab === 'bom' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <p style={{ margin: 0, color: '#b0b0b0' }}>
                Woodii automatically generates a real-time, consolidated Bill of Materials (BOM) tabulating exact lumber take-offs and hardware requirements.
              </p>

              <h4 style={{ margin: '6px 0 2px 0', color: '#ff8c00', fontSize: '12px' }}>📖 Wall-by-Wall Component Schedules</h4>
              <p style={{ margin: 0, color: '#ccc' }}>
                Lists structural components associated with each individual wall. Displays exact dimensions (Thickness x Width x Length in mm) and quantities.
              </p>

              <h4 style={{ margin: '8px 0 2px 0', color: '#ff8c00', fontSize: '12px' }}>📐 2D Blueprint Framing Maps</h4>
              <p style={{ margin: 0, color: '#ccc' }}>
                Draws a live vector blueprint of each wall's framing layout (annotating studs, plates, headers, and openings) with dimensional span callouts.
              </p>

              <h4 style={{ margin: '8px 0 0 0', color: '#ff8c00', fontSize: '12px' }}>🖨️ PDF Blueprints Export</h4>
              <p style={{ margin: 0, color: '#ccc' }}>
                Press "Export Blueprint PDF" at the top of the BOM tab to download a high-resolution, print-ready blueprint workbook containing all 2D vector plans and component lists.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid #222',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#0c0c0c'
        }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#888', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            Don't show this intro automatically next time
          </label>
          
          <button
            onClick={handleClose}
            style={{
              padding: '8px 24px',
              backgroundColor: '#ff8c00',
              color: '#000',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 700,
              fontSize: '12px',
              cursor: 'pointer',
              transition: 'background-color 0.2s, transform 0.1s'
            }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#ffb74d')}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#ff8c00')}
            onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.96)')}
            onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          >
            Start Designing
          </button>
        </div>
      </div>
    </div>
  );
}
