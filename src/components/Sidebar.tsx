import { useState, useEffect } from 'react';
import { useProjectStore } from '../store';
import ProjectsTab from './sidebar/ProjectsTab';
import GlobalTab from './sidebar/GlobalTab';
import SelectionTab from './sidebar/SelectionTab';
import BOMTab from './sidebar/BOMTab';

export default function Sidebar() {
  const [activeTab, setActiveTab] = useState<'projects' | 'global' | 'selection' | 'bom'>('projects');

  const {
    uiState,
  } = useProjectStore();

  const selectedId = uiState.selectedId;
  const selectedType = uiState.selectedType;

  // Automatically switch to selection tab when any element (wall, door/window, floor, roof) is clicked/selected (except when we are on BOM tab)
  useEffect(() => {
    if (selectedType && selectedType !== null && activeTab !== 'bom') {
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
      overflow: 'hidden',
      zIndex: 10
    }}>
      {/* Header */}
      <div style={{ padding: '20px', borderBottom: '1px solid #333' }}>
        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600, color: '#f0f0f0' }}>Woodii 3D Builder</h2>
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

      {/* Tab Contents */}
      {activeTab === 'projects' && <ProjectsTab />}
      {activeTab === 'global' && <GlobalTab />}
      {activeTab === 'selection' && <SelectionTab />}
      {activeTab === 'bom' && <BOMTab />}
    </div>
  );
}
