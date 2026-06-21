import { Shape } from 'three';
import { useProjectStore } from '../../store';
import { generateFraming } from '../../utils/framingEngine';

export default function FramingRenderer() {
  const floors = useProjectStore((state) => state.floors);
  const roof = useProjectStore((state) => state.roof);
  const uiState = useProjectStore((state) => state.uiState);
  const selectObject = useProjectStore((state) => state.selectObject);

  const totalFloors = floors.length;

  const getMemberLevel = (id: string): number => {
    const wallFloorMatch = id.match(/floor-(\d+)/);
    if (wallFloorMatch) return parseInt(wallFloorMatch[1]);
    const floorMatch = id.match(/floor-(?:rim-front-|rim-back-|header-front-|header-back-|joist-)?(\d+)/);
    if (floorMatch) return parseInt(floorMatch[1]);
    return -1;
  };

  const activeFloorLevel = uiState.viewMode === 'topDown'
    ? (uiState.currentFloorView === -1 ? 0 : uiState.currentFloorView)
    : uiState.currentFloorView;

  const state = useProjectStore.getState();
  const framingMembers = generateFraming(state);

  // Filter: in solid mode, only render screws. In seeThrough and studsOnly, render all.
  const visibleMembers = uiState.seeThroughMode === 'solid'
    ? framingMembers.filter(m => m.type === 'screw')
    : framingMembers;

  if (visibleMembers.length === 0) return null;

  return (
    <group>
      {visibleMembers.map((member) => {
        const memberLevel = getMemberLevel(member.id);
        const isRoofMember = member.type === 'rafter' || member.type === 'ridge' || member.id.includes('roof-');

        // If top-down view, hide roof members
        if (uiState.viewMode === 'topDown' && isRoofMember) {
          return null;
        }

        // In top-down view, we only show the active level (screws only on level 0)
        if (uiState.viewMode === 'topDown') {
          if (member.type === 'screw') {
            if (activeFloorLevel !== 0) return null;
          } else {
            if (memberLevel !== activeFloorLevel) return null;
          }
        } else if (uiState.currentFloorView !== -1) {
          const isTopFloorView = uiState.currentFloorView === totalFloors - 1 || uiState.currentFloorView === totalFloors;
          if (memberLevel !== uiState.currentFloorView && !(isRoofMember && isTopFloorView)) {
            return null;
          }
        }

        let woodColor = '#d2b48c'; // standard lumber tan
        if (member.type === 'plate') woodColor = '#cdaa7d'; // slightly darker
        if (member.type === 'header') woodColor = '#b58a5c'; // structural header color
        if (member.type === 'rafter' || member.type === 'ridge') woodColor = '#cd853f'; // rafters color
        if (member.type === 'screw') woodColor = '#7f8c8d'; // steel gray for ground screws
        
        const wallMatch = member.id.match(/(floor-\d+-wall-(?:front|back|left|right))/);
        const isSelected = uiState.selectedId && (
          uiState.selectedId === member.id || 
          (wallMatch && uiState.selectedId === wallMatch[1]) ||
          (member.wallId && uiState.selectedId === member.wallId) ||
          (member.id.includes('roof') && !member.id.includes('floor-roof') && uiState.selectedId === 'roof') ||
          (() => {
            const memberLevel = getMemberLevel(member.id);
            if (memberLevel !== -1) {
              const isFloorSelected = uiState.selectedId === (memberLevel === totalFloors ? 'floor-roof' : `floor-${memberLevel}`);
              if (isFloorSelected) {
                // Only highlight floor frame members, not wall members
                return !member.id.startsWith('wall-');
              }
            }
            return false;
          })()
        );
        
        const memberColor = isSelected ? '#ff8c00' : woodColor;

        const handleClick = (e: any) => {
          e.stopPropagation();
          if (member.wallId && member.wallId.startsWith('internal-')) {
            selectObject(member.wallId, 'wall');
          } else if (wallMatch) {
            selectObject(wallMatch[1], 'wall');
          } else if (member.id.includes('roof') && !member.id.includes('floor-roof')) {
            selectObject('roof', 'roof');
          } else {
            const memberLevel = getMemberLevel(member.id);
            if (memberLevel !== -1) {
              if (memberLevel === totalFloors) {
                selectObject('floor-roof', 'floor');
              } else {
                selectObject(`floor-${memberLevel}`, 'floor');
              }
            }
          }
        };

        const handlePointerOver = (e: any) => {
          e.stopPropagation();
          document.body.style.cursor = 'pointer';
        };
        const handlePointerOut = (e: any) => {
          e.stopPropagation();
          document.body.style.cursor = 'auto';
        };

        // Render steel ground screws as cylinders
        if (member.type === 'screw') {
          const diameter = member.size[0];
          const length = member.size[1];
          return (
            <mesh
              key={member.id}
              position={member.position}
              rotation={[member.rotation[0], member.rotation[1], member.rotation[2]]}
              castShadow
              receiveShadow
              onClick={handleClick}
              onPointerOver={handlePointerOver}
              onPointerOut={handlePointerOut}
            >
              <cylinderGeometry args={[diameter / 2, 0.005, length, 12]} />
              <meshStandardMaterial color={memberColor} metalness={0.8} roughness={0.3} />
            </mesh>
          );
        }

        // Special rendering for mitered rafters
        if (member.type === 'rafter') {
          const [width, height, thickness] = member.size;
          const rafterLength = width;
          const rafterHeight = height;
          const rafterThickness = thickness;
          
          const theta = roof.inclination * Math.PI / 180;
          const tanTheta = Math.tan(theta);
          
          const isLeftRafter = member.id.includes('left');
          const sign = isLeftRafter ? 1 : -1;
          
          const rafterShape = new Shape();
          const halfL = rafterLength / 2;
          const halfH = rafterHeight / 2;
          
          rafterShape.moveTo(-halfL - sign * halfH * tanTheta, -halfH);
          rafterShape.lineTo(halfL - sign * halfH * tanTheta, -halfH);
          rafterShape.lineTo(halfL + sign * halfH * tanTheta, halfH);
          rafterShape.lineTo(-halfL + sign * halfH * tanTheta, halfH);
          rafterShape.closePath();

          return (
            <mesh
              key={member.id}
              position={[member.position[0], member.position[1], member.position[2] - rafterThickness / 2]}
              rotation={[member.rotation[0], member.rotation[1], member.rotation[2]]}
              castShadow
              receiveShadow
              onClick={handleClick}
              onPointerOver={handlePointerOver}
              onPointerOut={handlePointerOut}
            >
              <extrudeGeometry args={[rafterShape, { depth: rafterThickness, bevelEnabled: false }]} />
              <meshStandardMaterial color={memberColor} roughness={0.9} />
            </mesh>
          );
        }

        return (
          <mesh
            key={member.id}
            position={member.position}
            rotation={[member.rotation[0], member.rotation[1], member.rotation[2]]}
            castShadow
            receiveShadow
            onClick={handleClick}
            onPointerOver={handlePointerOver}
            onPointerOut={handlePointerOut}
          >
            <boxGeometry args={member.size} />
            <meshStandardMaterial color={memberColor} roughness={0.9} />
          </mesh>
        );
      })}
    </group>
  );
}
