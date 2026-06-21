import { ChangeEvent } from 'react';
import { useProjectStore } from '../../store';
import { DEMO_PROJECTS } from '../../utils/demos';

export default function ProjectsTab() {
  const loadProject = useProjectStore((state) => state.loadProject);
  const updateUIState = useProjectStore((state) => state.updateUIState);

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

  return (
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '24px', flex: 1, overflowY: 'auto' }}>
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

      {/* Help & Guide */}
      <section style={{ backgroundColor: '#1e1e1e', padding: '16px', borderRadius: '8px', border: '1px solid #333' }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: '13px', textTransform: 'uppercase', color: '#ff8c00', letterSpacing: '0.05em' }}>
          Instructions & Guide
        </h3>
        <p style={{ fontSize: '11px', color: '#888', margin: '0 0 12px 0', lineHeight: '1.4' }}>
          New to Woodii? View the interactive user guide to learn how to control the camera, drag elements, set presets, and export your plans.
        </p>
        <button
          onClick={() => updateUIState({ showHelpModal: true })}
          style={{
            width: '100%',
            padding: '10px',
            backgroundColor: '#111',
            color: '#ff8c00',
            fontWeight: 600,
            border: '1px solid #ff8c00',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '12px',
            transition: 'background-color 0.2s, color 0.2s'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = '#ff8c00';
            e.currentTarget.style.color = '#000';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = '#111';
            e.currentTarget.style.color = '#ff8c00';
          }}
        >
          📖 Open User Guide
        </button>
      </section>
    </div>
  );
}
