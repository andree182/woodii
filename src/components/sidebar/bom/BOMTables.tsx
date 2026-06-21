import { FramingMember } from '../../../utils/framingEngine';
import { getWallMemberDetails } from './bomUtils';

export function GlobalBOMTable({ list }: { list: any[] }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #333', color: '#888' }}>
            <th style={{ padding: '6px 4px' }}>Lumber/Hardware Type</th>
            <th style={{ padding: '6px 4px', textAlign: 'right' }}>Len (m)</th>
            <th style={{ padding: '6px 4px', textAlign: 'right' }}>Qty</th>
            <th style={{ padding: '6px 4px', textAlign: 'right' }}>Total (m)</th>
          </tr>
        </thead>
        <tbody>
          {list.map((item, idx) => (
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
  );
}

interface WallFramingCutListProps {
  members: FramingMember[];
  wall: any;
  getCutIdentifier: (nominal: string, length: number) => string;
}

export function WallFramingCutList({ members, wall, getCutIdentifier }: WallFramingCutListProps) {
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
}

interface JoistsCutListProps {
  joists: FramingMember[];
  getCutIdentifier: (nominal: string, length: number) => string;
}

export function JoistsCutList({ joists, getCutIdentifier }: JoistsCutListProps) {
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
}

interface RoofCutListProps {
  roofMembers: FramingMember[];
  getCutIdentifier: (nominal: string, length: number) => string;
}

export function RoofCutList({ roofMembers, getCutIdentifier }: RoofCutListProps) {
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
}

interface ScrewsCutListProps {
  screws: FramingMember[];
  getCutIdentifier: (nominal: string, length: number) => string;
}

export function ScrewsCutList({ screws, getCutIdentifier }: ScrewsCutListProps) {
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
}
