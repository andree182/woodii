import { useState } from 'react';
import { useProjectStore } from '../../store';
import { generateFraming, FramingMember } from '../../utils/framingEngine';
import { getWallMemberDetails, generateWallSVGString } from './bom/bomUtils';
import WallDrawing from './bom/WallDrawing';
import {
  GlobalBOMTable,
  WallFramingCutList,
  JoistsCutList,
  RoofCutList,
  ScrewsCutList
} from './bom/BOMTables';
import { calculateCoversBOM } from '../../utils/coversCalculator';
import CoversInstallationPlan from './bom/CoversInstallationPlan';

export default function BOMTab() {
  const [bomViewMode, setBomViewMode] = useState<'global' | 'walls' | 'installation'>('walls');
  const [expandedWalls, setExpandedWalls] = useState<{[key: string]: boolean}>({});

  const {
    dimensions,
    floors,
    uiState,
    selectObject,
  } = useProjectStore();

  const selectedId = uiState.selectedId;
  const selectedType = uiState.selectedType;

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

    const key = `${nominal}-${len.toFixed(2)}`;
    if (!bomGroups[key]) {
      bomGroups[key] = {
        nominal,
        length: len,
        count: 0
      };
    }
    bomGroups[key].count++;

    if (nominal.includes("2x4")) {
      total2x4Length += len;
      total2x4Count++;
    } else {
      total2x6Length += len;
      total2x6Count++;
    }
  });

  const bomList = Object.values(bomGroups).sort((a, b) => b.length - a.length);

  // Assign numeric identifiers (e.g. 1, 2, 3...) to each unique nominal + length combination
  const bomListWithIds = bomList.map((item, idx) => ({
    ...item,
    idNum: idx + 1
  }));

  const getCutIdentifier = (nominal: string, length: number) => {
    const found = bomListWithIds.find(item => item.nominal === nominal && item.length.toFixed(2) === length.toFixed(2));
    return found ? found.idNum.toString() : '';
  };

  const getConsolidatedListForMembers = (members: FramingMember[]) => {
    const groups: { [key: string]: { nominal: string; length: number; count: number } } = {};
    members.forEach(member => {
      const [w, h, d] = member.size;
      const len = Math.max(w, h, d);

      if (member.type === 'screw') {
        const nominal = "Steel Ground Screw (76x800mm)";
        const key = `${nominal}-${len.toFixed(2)}`;
        if (!groups[key]) {
          groups[key] = { nominal, length: len, count: 0 };
        }
        groups[key].count++;
        return;
      }

      const nominal = d > 0.1 || member.type === 'rafter' || member.type === 'ridge' || member.type === 'joist' 
        ? "2x6 (40x140mm)" 
        : "2x4 (40x90mm)";

      const key = `${nominal}-${len.toFixed(2)}`;
      if (!groups[key]) {
        groups[key] = { nominal, length: len, count: 0 };
      }
      groups[key].count++;
    });

    return Object.values(groups)
      .sort((a, b) => b.length - a.length)
      .map(item => {
        const idNum = getCutIdentifier(item.nominal, item.length);
        return { ...item, idNum };
      });
  };

  const foundationList = getConsolidatedListForMembers(framing.filter(m => m.type === 'screw'));
  const floorList = getConsolidatedListForMembers(framing.filter(m => m.floorId && !m.wallId && m.type === 'joist'));
  const wallList = getConsolidatedListForMembers(framing.filter(m => !!m.wallId));
  const roofList = getConsolidatedListForMembers(framing.filter(m => !m.floorId && !m.wallId && m.type !== 'screw'));

  const handleExportBlueprint = () => {
    const state = useProjectStore.getState();
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Please allow popups to export the blueprint.");
      return;
    }

    const { dimensions: dim, foundation, wallLayers: layers, wallPreset, structuralConfig, floors: storeFloors } = state;

    // Helper for table sections
    const generateHTMLTableForList = (list: any[], title: string) => {
      if (list.length === 0) return '';
      const rows = list.map(item => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold; color: #ff8c00;">${item.idNum}</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;">${item.nominal}</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${item.length.toFixed(2)}m</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${item.count}</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right; font-weight: bold;">${(item.length * item.count).toFixed(2)}m</td>
        </tr>
      `).join('');

      return `
        <h3 style="color: #444; font-size: 13px; text-transform: uppercase; margin-top: 20px; margin-bottom: 8px; border-left: 3px solid #ff8c00; padding-left: 8px; letter-spacing: 0.03em;">${title}</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; border: 1px solid #ddd;">
          <thead>
            <tr style="background-color: #f2f2f2; font-size: 11px;">
              <th style="padding: 8px; text-align: left; border: 1px solid #ddd; width: 60px;">ID</th>
              <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Lumber/Hardware Type</th>
              <th style="padding: 8px; text-align: right; border: 1px solid #ddd; width: 100px;">Cut Length</th>
              <th style="padding: 8px; text-align: right; border: 1px solid #ddd; width: 80px;">Quantity</th>
              <th style="padding: 8px; text-align: right; border: 1px solid #ddd; width: 120px;">Total Length</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      `;
    };

    const getSheetingLabel = (material: string) => {
      switch (material) {
        case 'osb_1250': return 'OSB Board (2500x1250mm)';
        case 'osb_625': return 'OSB Board (2500x625mm)';
        case 'plywood': return 'Construction Plywood (2440x1220mm)';
        default: return 'None';
      }
    };

    const getSideCoverLabel = (material: string) => {
      switch (material) {
        case 'rhombus': return 'Rhombus Wood Battens';
        case 'decking': return 'Classic Wooden Decking';
        case 'osb_1250': return 'OSB Board (2500x1250mm)';
        case 'osb_625': return 'OSB Board (2500x625mm)';
        case 'plasterboard': return 'Plasterboard (2000x1200mm)';
        default: return 'None';
      }
    };

    const generateHTMLTableForCovers = () => {
      const coversBOM = calculateCoversBOM(state);
      const { roof, walls, totals } = coversBOM;
      const { topCover } = state;

      let roofHtml = `
        <h3 style="color: #444; font-size: 13px; text-transform: uppercase; margin-top: 20px; margin-bottom: 8px; border-left: 3px solid #ff8c00; padding-left: 8px; letter-spacing: 0.03em;">Roof Sheathing & Top Cover</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px; border: 1px solid #ddd;">
          <thead>
            <tr style="background-color: #f2f2f2; font-size: 11px;">
              <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Component</th>
              <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Material Specification</th>
              <th style="padding: 8px; text-align: right; border: 1px solid #ddd; width: 120px;">Area / Exposure</th>
              <th style="padding: 8px; text-align: right; border: 1px solid #ddd; width: 120px;">Estimated Qty</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Roof Area</td>
              <td style="padding: 8px; border: 1px solid #ddd; color: #666;">Total surface area of roof slopes</td>
              <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${roof.roofArea.toFixed(2)} m²</td>
              <td style="padding: 8px; border: 1px solid #ddd; text-align: right; font-weight: bold;">-</td>
            </tr>
            ${topCover.sheetingMaterial !== 'none' ? `
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Roof Sheathing</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${getSheetingLabel(topCover.sheetingMaterial)} (${topCover.sheetingThickness * 1000}mm)</td>
              <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${roof.sheetingArea.toFixed(2)} m²</td>
              <td style="padding: 8px; border: 1px solid #ddd; text-align: right; font-weight: bold;">${totals.roofSheetingSheets} sheets</td>
            </tr>
            ` : ''}
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Roof Top Cover</td>
              <td style="padding: 8px; border: 1px solid #ddd; text-transform: capitalize;">${topCover.material} (${topCover.width}x${topCover.height}m)</td>
              <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">Exp: ${topCover.visibleWidth}x${topCover.visibleHeight}m</td>
              <td style="padding: 8px; border: 1px solid #ddd; text-align: right; font-weight: bold;">
                ${topCover.material === 'shingles' ? `${totals.roofShinglesCount} pcs` : topCover.material === 'tiles' ? `${totals.roofTilesCount} pcs` : `${totals.roofPlatesCount} pcs`}<br/>
                <span style="font-size: 10px; font-weight: normal; color: #666;">(${roof.rowsCount} rows × ${roof.piecesPerRow} pcs)</span>
              </td>
            </tr>
            ${state.roofCovers && state.roofCovers.soffitMaterial !== 'none' ? `
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Roof Soffit (Bottom Cover)</td>
              <td style="padding: 8px; border: 1px solid #ddd;">Wooden Soffit (${state.roofCovers.soffitWidth * 1000}x${state.roofCovers.soffitThickness * 1000}mm)</td>
              <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${totals.soffitMeters.toFixed(1)} m</td>
              <td style="padding: 8px; border: 1px solid #ddd; text-align: right; font-weight: bold;">${totals.soffitPieces} boards (4.0m)</td>
            </tr>
            ` : ''}
            ${state.roofCovers && state.roofCovers.fasciaMaterial !== 'none' ? `
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Eaves Fascia Board</td>
              <td style="padding: 8px; border: 1px solid #ddd;">Wooden Fascia (${state.roofCovers.fasciaHeight * 1000}x${state.roofCovers.fasciaThickness * 1000}mm)</td>
              <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${totals.fasciaMeters.toFixed(1)} m</td>
              <td style="padding: 8px; border: 1px solid #ddd; text-align: right; font-weight: bold;">${totals.fasciaPieces} boards (4.0m)</td>
            </tr>
            ` : ''}
            ${state.roofCovers && state.roofCovers.gableMaterial !== 'none' ? `
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Gable Wind Board</td>
              <td style="padding: 8px; border: 1px solid #ddd;">Wooden Wind Board (${state.roofCovers.gableHeight * 1000}x${state.roofCovers.gableThickness * 1000}mm)</td>
              <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${totals.gableMeters.toFixed(1)} m</td>
              <td style="padding: 8px; border: 1px solid #ddd; text-align: right; font-weight: bold;">${totals.gablePieces} boards (4.0m)</td>
            </tr>
            ` : ''}
          </tbody>
        </table>
      `;

      let wallsHtml = `
        <h3 style="color: #444; font-size: 13px; text-transform: uppercase; margin-top: 20px; margin-bottom: 8px; border-left: 3px solid #ff8c00; padding-left: 8px; letter-spacing: 0.03em;">Wall Sheathing & Cladding Plan</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; border: 1px solid #ddd;">
          <thead>
            <tr style="background-color: #f2f2f2; font-size: 11px;">
              <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Wall Name</th>
              <th style="padding: 8px; text-align: right; border: 1px solid #ddd; width: 80px;">Net Area</th>
              <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">External Cladding / Lining</th>
              <th style="padding: 8px; text-align: right; border: 1px solid #ddd; width: 120px;">Ext Qty</th>
              <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Internal Lining</th>
              <th style="padding: 8px; text-align: right; border: 1px solid #ddd; width: 120px;">Int Qty</th>
            </tr>
          </thead>
          <tbody>
            ${walls.map(w => `
              <tr style="font-size: 11px;">
                <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">${w.wallTitle}</td>
                <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${w.netArea.toFixed(2)} m²</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${getSideCoverLabel(w.external.material)}</td>
                <td style="padding: 8px; border: 1px solid #ddd; text-align: right; font-weight: bold;">
                  ${w.external.material !== 'none' ? (
                    w.external.material === 'rhombus' || w.external.material === 'decking'
                      ? `${w.external.piecesCount} pcs (${w.external.linearMeters.toFixed(1)}m)`
                      : `${w.external.piecesCount} sheets`
                  ) : '-'}
                </td>
                <td style="padding: 8px; border: 1px solid #ddd;">${getSideCoverLabel(w.internal.material)}</td>
                <td style="padding: 8px; border: 1px solid #ddd; text-align: right; font-weight: bold;">
                  ${w.internal.material !== 'none' ? (
                    w.internal.material === 'decking'
                      ? `${w.internal.piecesCount} pcs (${w.internal.linearMeters.toFixed(1)}m)`
                      : `${w.internal.piecesCount} sheets`
                  ) : '-'}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;

      return roofHtml + wallsHtml;
    };

    // Generate Floor sections
    let floorsHtml = storeFloors.map(floor => {
      const floorJoists = framing.filter(m => m.floorId === floor.id && m.type === 'joist' && !m.id.startsWith('roof-'));

      // Joists table
      let joistsTableHtml = '';
      if (floorJoists.length > 0) {
        const groups: any = {};
        floorJoists.forEach(j => {
          const len = Math.max(j.size[0], j.size[1], j.size[2]);
          const nominal = j.id.includes('rim') ? 'Rim Joist' : 'Floor Joist';
          const key = `${nominal}-${len.toFixed(2)}`;
          if (!groups[key]) groups[key] = { nominal, length: len, count: 0 };
          groups[key].count++;
        });

        joistsTableHtml = `
          <h4 style="margin-top: 12px; margin-bottom: 6px; color: #555;">Floor Joists List (${floorJoists.length} pcs)</h4>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
            <thead>
              <tr style="background-color: #f2f2f2; font-size: 11px;">
                <th style="padding: 6px; text-align: left; border: 1px solid #ddd;">Role</th>
                <th style="padding: 6px; text-align: right; border: 1px solid #ddd;">Length</th>
                <th style="padding: 6px; text-align: right; border: 1px solid #ddd;">Quantity</th>
              </tr>
            </thead>
            <tbody>
              ${Object.values(groups).map((g: any) => `
                <tr style="border-bottom: 1px solid #eee; font-size: 11px;">
                  <td style="padding: 6px; border: 1px solid #ddd;">${g.nominal}</td>
                  <td style="padding: 6px; text-align: right; border: 1px solid #ddd;">${g.length.toFixed(2)}m</td>
                  <td style="padding: 6px; text-align: right; border: 1px solid #ddd;">${g.count}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;
      }

      // Outer walls section
      let outerWallsHtml = floor.walls.map(wall => {
        const wallMembers = framing.filter(m => m.floorId === floor.id && m.wallId === wall.id);
        const wallLength = Math.sqrt(
          Math.pow(wall.end[0] - wall.start[0], 2) + Math.pow(wall.end[1] - wall.start[1], 2)
        );
        const wallTitle = wall.id === 'wall-front' ? 'Front Wall' :
                          wall.id === 'wall-back' ? 'Back Wall' :
                          wall.id === 'wall-left' ? 'Left Wall' :
                          wall.id === 'wall-right' ? 'Right Wall' : wall.id;

        const svgStr = generateWallSVGString(wall, wallMembers, dim.heightPerFloor, getCutIdentifier, floor.level, true, `print-svg-${wall.id}`);

        // Wall members table
        const wallGroups: any = {};
        wallMembers.forEach(m => {
          const details = getWallMemberDetails(m, wall);
          const key = `${details.nominal}-${details.role}-${details.len.toFixed(3)}`;
          if (!wallGroups[key]) {
            wallGroups[key] = {
              nominal: details.nominal,
              role: details.role,
              length: details.len,
              count: 0
            };
          }
          wallGroups[key].count++;
        });

        return `
          <div style="page-break-inside: avoid; border: 1px solid #ccc; padding: 16px; border-radius: 8px; margin-bottom: 24px; background-color: #fafafa;">
            <h4 style="margin-top: 0; color: #ff8c00; font-size: 14px; text-transform: uppercase;">${wallTitle} (Length: ${wallLength.toFixed(2)}m)</h4>
            <div style="display: flex; gap: 16px; flex-wrap: wrap;">
              <div style="flex: 1; min-width: 320px;">
                ${svgStr}
              </div>
              <div style="flex: 1; min-width: 280px;">
                <h5 style="margin-top: 0; margin-bottom: 8px; color: #666;">Member Cut List</h5>
                <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                  <thead>
                    <tr style="background-color: #e6e6e6;">
                      <th style="padding: 6px; border: 1px solid #ddd;">ID</th>
                      <th style="padding: 6px; border: 1px solid #ddd;">Nominal</th>
                      <th style="padding: 6px; border: 1px solid #ddd;">Role</th>
                      <th style="padding: 6px; text-align: right; border: 1px solid #ddd;">Len</th>
                      <th style="padding: 6px; text-align: right; border: 1px solid #ddd;">Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${Object.values(wallGroups).map((g: any) => {
                      const idNum = getCutIdentifier(g.nominal, g.length);
                      return `
                        <tr style="border-bottom: 1px solid #eee;">
                          <td style="padding: 6px; font-weight: bold; color: #ff8c00; border: 1px solid #ddd;">${idNum}</td>
                          <td style="padding: 6px; border: 1px solid #ddd;">${g.nominal}</td>
                          <td style="padding: 6px; font-weight: 600; border: 1px solid #ddd;">${g.role}</td>
                          <td style="padding: 6px; text-align: right; border: 1px solid #ddd;">${g.length.toFixed(2)}m</td>
                          <td style="padding: 6px; text-align: right; border: 1px solid #ddd;">${g.count}</td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        `;
      }).join('');

      // Partition walls section
      let partitionWallsHtml = (floor.internalWalls || []).map((wall, idx) => {
        const wallMembers = framing.filter(m => m.floorId === floor.id && m.wallId === wall.id);
        const wallLength = Math.sqrt(
          Math.pow(wall.end[0] - wall.start[0], 2) + Math.pow(wall.end[1] - wall.start[1], 2)
        );
        const wallTitle = `Partition Wall ${idx + 1}`;

        const svgStr = generateWallSVGString(wall, wallMembers, dim.heightPerFloor, getCutIdentifier, floor.level, true, `print-svg-${wall.id}`);

        // Wall members table
        const wallGroups: any = {};
        wallMembers.forEach(m => {
          const details = getWallMemberDetails(m, wall);
          const key = `${details.nominal}-${details.role}-${details.len.toFixed(3)}`;
          if (!wallGroups[key]) {
            wallGroups[key] = {
              nominal: details.nominal,
              role: details.role,
              length: details.len,
              count: 0
            };
          }
          wallGroups[key].count++;
        });

        return `
          <div style="page-break-inside: avoid; border: 1px solid #ccc; padding: 16px; border-radius: 8px; margin-bottom: 24px; background-color: #fafafa;">
            <h4 style="margin-top: 0; color: #ff8c00; font-size: 14px; text-transform: uppercase;">${wallTitle} (Length: ${wallLength.toFixed(2)}m)</h4>
            <div style="display: flex; gap: 16px; flex-wrap: wrap;">
              <div style="flex: 1; min-width: 320px;">
                ${svgStr}
              </div>
              <div style="flex: 1; min-width: 280px;">
                <h5 style="margin-top: 0; margin-bottom: 8px; color: #666;">Member Cut List</h5>
                <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                  <thead>
                    <tr style="background-color: #e6e6e6;">
                      <th style="padding: 6px; border: 1px solid #ddd;">ID</th>
                      <th style="padding: 6px; border: 1px solid #ddd;">Nominal</th>
                      <th style="padding: 6px; border: 1px solid #ddd;">Role</th>
                      <th style="padding: 6px; text-align: right; border: 1px solid #ddd;">Len</th>
                      <th style="padding: 6px; text-align: right; border: 1px solid #ddd;">Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${Object.values(wallGroups).map((g: any) => {
                      const idNum = getCutIdentifier(g.nominal, g.length);
                      return `
                        <tr style="border-bottom: 1px solid #eee;">
                          <td style="padding: 6px; font-weight: bold; color: #ff8c00; border: 1px solid #ddd;">${idNum}</td>
                          <td style="padding: 6px; border: 1px solid #ddd;">${g.nominal}</td>
                          <td style="padding: 6px; font-weight: 600; border: 1px solid #ddd;">${g.role}</td>
                          <td style="padding: 6px; text-align: right; border: 1px solid #ddd;">${g.length.toFixed(2)}m</td>
                          <td style="padding: 6px; text-align: right; border: 1px solid #ddd;">${g.count}</td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        `;
      }).join('');

      return `
        <div style="border-top: 2px solid #333; padding-top: 16px; margin-top: 24px;">
          <h3 style="color: #222; text-transform: uppercase; margin-bottom: 8px; font-size: 16px;">
            ${floor.level === 0 ? 'Ground Floor Details' : `Floor ${floor.level + 1} Details`}
          </h3>
          ${joistsTableHtml}
          
          <h4 style="margin-top: 16px; margin-bottom: 12px; color: #444;">Outer Walls</h4>
          ${outerWallsHtml}
          
          ${(floor.internalWalls || []).length > 0 ? `
            <h4 style="margin-top: 16px; margin-bottom: 12px; color: #444;">Internal Partition Walls</h4>
            ${partitionWallsHtml}
          ` : ''}
        </div>
      `;
    }).join('');

    // Generate Roof HTML
    const roofMembers = framing.filter(m => !m.floorId && !m.wallId);
    let roofHtml = '';
    if (roofMembers.length > 0) {
      const roofGroups: any = {};
      roofMembers.forEach(r => {
        const len = Math.max(r.size[0], r.size[1], r.size[2]);
        let typeLabel = r.id.includes('ridge') ? 'Ridge Beam' : (r.id.includes('collar') ? 'Collar Tie' : 'Rafter');
        const key = `2x6 (40x140mm)-${typeLabel}-${len.toFixed(2)}`;
        if (!roofGroups[key]) roofGroups[key] = { nominal: '2x6 (40x140mm)', role: typeLabel, length: len, count: 0 };
        roofGroups[key].count++;
      });

      roofHtml = `
        <div style="border-top: 2px solid #333; padding-top: 16px; margin-top: 24px; page-break-inside: avoid;">
          <h3 style="color: #222; text-transform: uppercase; margin-bottom: 8px; font-size: 16px;">Roof Framing Details</h3>
          <table style="width: 100%; border-collapse: collapse; border: 1px solid #ddd;">
            <thead>
              <tr style="background-color: #f2f2f2; font-size: 11px;">
                <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Role</th>
                <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Nominal Dimension</th>
                <th style="padding: 8px; text-align: right; border: 1px solid #ddd;">Length</th>
                <th style="padding: 8px; text-align: right; border: 1px solid #ddd;">Quantity</th>
              </tr>
            </thead>
            <tbody>
              ${Object.values(roofGroups).map((g: any) => `
                <tr style="border-bottom: 1px solid #eee; font-size: 11px;">
                  <td style="padding: 8px; font-weight: 600; border: 1px solid #ddd;">${g.role}</td>
                  <td style="padding: 8px; border: 1px solid #ddd;">${g.nominal}</td>
                  <td style="padding: 8px; text-align: right; border: 1px solid #ddd;">${g.length.toFixed(2)}m</td>
                  <td style="padding: 8px; text-align: right; border: 1px solid #ddd;">${g.count}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Woodii Construction Blueprint: Project Take-off</title>
        <meta charset="utf-8" />
        <style>
          body {
            font-family: 'Inter', system-ui, sans-serif;
            color: #333;
            background-color: #fff;
            padding: 40px;
            max-width: 1000px;
            margin: 0 auto;
            line-height: 1.5;
          }
          h1, h2, h3, h4, h5 {
            font-family: system-ui, sans-serif;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 8px;
            margin-bottom: 20px;
          }
          th {
            background-color: #f2f2f2;
            color: #333;
            font-weight: bold;
            padding: 8px;
            text-align: left;
            border: 1px solid #ddd;
          }
          td {
            padding: 8px;
            border: 1px solid #ddd;
          }
          @media print {
            body {
              padding: 20px;
            }
            .no-print {
              display: none !important;
            }
            .page-break {
              page-break-after: always;
            }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="background-color: #f5f5f5; border: 1px solid #ff8c00; border-radius: 8px; padding: 16px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h3 style="margin: 0; color: #ff8c00; text-transform: uppercase; font-size: 14px;">Print / PDF Blueprint Export</h3>
            <p style="margin: 4px 0 0 0; font-size: 12px; color: #666;">Choose "Save as PDF" in your print options destination to export a digital PDF blueprint.</p>
          </div>
          <button onclick="window.print()" style="padding: 10px 20px; background-color: #ff8c00; color: #000; border: none; border-radius: 6px; font-weight: bold; cursor: pointer;">
            🖨️ Print Blueprint / Save PDF
          </button>
        </div>

        <div style="border-bottom: 3px solid #ff8c00; padding-bottom: 10px; margin-bottom: 20px;">
          <h1 style="margin: 0; font-size: 26px; color: #111;">WOODII CONSTRUCTION BLUEPRINT</h1>
          <span style="font-size: 12px; color: #777;">Generated on: ${new Date().toLocaleDateString()}</span>
        </div>

        <section style="margin-bottom: 30px;">
          <h2 style="color: #222; text-transform: uppercase; font-size: 18px;">Global Building Specifications</h2>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; background-color: #fafafa; padding: 16px; border-radius: 8px; border: 1px solid #eaeaea; font-size: 13px;">
            <div><strong>Dimensions (Width x Depth):</strong> ${dim.width.toFixed(2)}m x ${dim.depth.toFixed(2)}m</div>
            <div><strong>Wall Height (per floor):</strong> ${dim.heightPerFloor.toFixed(2)}m</div>
            <div><strong>Foundation Type:</strong> ${foundation.type === 'slab' ? 'Concrete Slab' : 'Ground Screws Grid'}</div>
            <div><strong>Wall Layers Preset:</strong> ${wallPreset.toUpperCase().replace('_', ' ')}</div>
            <div><strong>Wall Thickness (Total):</strong> ${(layers.outer + layers.middle + layers.inner).toFixed(3)}m</div>
            <div><strong>Cladding (Outer/Middle/Inner):</strong> ${layers.outer * 1000}mm / ${layers.middle * 1000}mm / ${layers.inner * 1000}mm</div>
            <div><strong>Wall Staggered Blocking:</strong> ${structuralConfig.wallBlocking ? 'ENABLED' : 'DISABLED'}</div>
            <div><strong>Floor Joist Blocking:</strong> ${structuralConfig.floorBlocking ? 'ENABLED' : 'DISABLED'}</div>
          </div>
        </section>

        <section style="margin-bottom: 30px;">
          <h2 style="color: #222; text-transform: uppercase; font-size: 18px;">Consolidated Bill of Materials (BOM)</h2>
          <p style="font-size: 12px; color: #666; margin-top: -8px;">Total lumber take-offs needed for construction, grouped by assembly type.</p>
          ${generateHTMLTableForList(foundationList, 'Foundation & Hardware')}
          ${generateHTMLTableForList(floorList, 'Floor Framing')}
          ${generateHTMLTableForList(wallList, 'Wall Framing')}
          ${generateHTMLTableForList(roofList, 'Roof Framing')}
          <div style="background-color: #fafafa; padding: 12px; border-radius: 6px; border: 1px solid #eaeaea; font-size: 12px; margin-bottom: 20px;">
            <strong>Hardware & Count Summaries:</strong> Foundation: ${foundation.type === 'slab' ? 'Concrete Slab' : 'Ground Screws'} | Screws count: ${framing.filter(m => m.type === 'screw').length} screws | Doors: ${storeFloors.reduce((acc, f) => acc + (f.walls.reduce((a, w) => a + w.subObjects.filter(o => o.type === 'door').length, 0)) + (f.internalWalls || []).reduce((a, w) => a + w.subObjects.filter(o => o.type === 'door').length, 0), 0)} | Windows: ${storeFloors.reduce((acc, f) => acc + f.walls.reduce((a, w) => a + w.subObjects.filter(o => o.type === 'window').length, 0), 0)}
          </div>
          ${generateHTMLTableForCovers()}
        </section>

        <div class="page-break"></div>

        <section style="margin-bottom: 30px;">
          <h2 style="color: #222; text-transform: uppercase; font-size: 18px; margin-bottom: 16px;">Detailed Wall Assembly Blueprint</h2>
          ${floorsHtml}
        </section>

        ${roofHtml}

      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
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
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px', flex: 1, overflowY: 'auto' }}>
      {/* Material Take-off List */}
      <section style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '14px', textTransform: 'uppercase', color: '#ff8c00', letterSpacing: '0.05em' }}>
            Material Take-off (BOM)
          </h3>
          <button
            onClick={handleExportBlueprint}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#e07b00';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(255, 140, 0, 0.5)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#ff8c00';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(255, 140, 0, 0.3)';
            }}
            style={{
              padding: '6px 12px',
              backgroundColor: '#ff8c00',
              color: '#000',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '11px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              textTransform: 'uppercase',
              letterSpacing: '0.02em',
              transition: 'all 0.2s ease',
              boxShadow: '0 2px 8px rgba(255, 140, 0, 0.3)'
            }}
          >
            🖨️ Export PDF / Print
          </button>
        </div>

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
          <button
            onClick={() => setBomViewMode('installation')}
            style={{
              flex: 1,
              padding: '8px',
              backgroundColor: bomViewMode === 'installation' ? '#ff8c00' : '#333',
              color: bomViewMode === 'installation' ? '#000' : '#ccc',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '11px',
            }}
          >
            Installation Plan
          </button>
        </div>
        
        {bomList.length === 0 ? (
          <p style={{ fontSize: '12px', color: '#666', fontStyle: 'italic' }}>No framing members generated.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {bomViewMode !== 'installation' && (
              /* Summary Totals */
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
            )}

            {bomViewMode === 'walls' && (
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
                                justifySelf: 'stretch',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                width: '100%',
                                boxSizing: 'border-box'
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
                                <JoistsCutList joists={floorJoists} getCutIdentifier={getCutIdentifier} />
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
                                justifySelf: 'stretch',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                width: '100%',
                                boxSizing: 'border-box'
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
                                <ScrewsCutList screws={foundationScrews} getCutIdentifier={getCutIdentifier} />
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
                                justifySelf: 'stretch',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                width: '100%',
                                boxSizing: 'border-box'
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
                                {wallMembers.length > 0 && (
                                  <WallDrawing wall={wall} wallMembers={wallMembers} heightPerFloor={dimensions.heightPerFloor} getCutIdentifier={getCutIdentifier} />
                                )}
                                {wallMembers.length === 0 ? (
                                  <p style={{ fontSize: '11px', color: '#666', fontStyle: 'italic', margin: 0 }}>No framing generated for this wall.</p>
                                ) : (
                                  <WallFramingCutList members={wallMembers} wall={wall} getCutIdentifier={getCutIdentifier} />
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Partition Wall Framing */}
                      {(floor.internalWalls || []).map((wall, idx) => {
                        const wallKey = wall.id;
                        const wallMembers = framing.filter(m => m.floorId === floor.id && m.wallId === wall.id);
                        
                        const dx = wall.end[0] - wall.start[0];
                        const dz = wall.end[1] - wall.start[1];
                        const wallLength = Math.sqrt(dx * dx + dz * dz);
                        
                        const wallTitle = `Partition Wall ${idx + 1}`;
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
                              marginTop: '6px'
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
                                justifySelf: 'stretch',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                width: '100%',
                                boxSizing: 'border-box'
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
                                {wallMembers.length > 0 && (
                                  <WallDrawing wall={wall} wallMembers={wallMembers} heightPerFloor={dimensions.heightPerFloor} getCutIdentifier={getCutIdentifier} />
                                )}
                                {wallMembers.length === 0 ? (
                                  <p style={{ fontSize: '11px', color: '#666', fontStyle: 'italic', margin: 0 }}>No framing generated for this wall.</p>
                                ) : (
                                  <WallFramingCutList members={wallMembers} wall={wall} getCutIdentifier={getCutIdentifier} />
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
                            justifySelf: 'stretch',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            width: '100%',
                            boxSizing: 'border-box'
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
                            <RoofCutList roofMembers={roofMembers} getCutIdentifier={getCutIdentifier} />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {bomViewMode === 'global' && (
              /* Consolidated/Global List divided by element type */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {foundationList.length > 0 && (
                  <div style={{ backgroundColor: '#1a1a1a', padding: '12px', borderRadius: '6px', border: '1px solid #333' }}>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '11px', color: '#ff8c00', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                      Foundation & Hardware
                    </h4>
                    <GlobalBOMTable list={foundationList} />
                  </div>
                )}

                {floorList.length > 0 && (
                  <div style={{ backgroundColor: '#1a1a1a', padding: '12px', borderRadius: '6px', border: '1px solid #333' }}>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '11px', color: '#ff8c00', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                      Floor Framing
                    </h4>
                    <GlobalBOMTable list={floorList} />
                  </div>
                )}

                {wallList.length > 0 && (
                  <div style={{ backgroundColor: '#1a1a1a', padding: '12px', borderRadius: '6px', border: '1px solid #333' }}>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '11px', color: '#ff8c00', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                      Wall Framing
                    </h4>
                    <GlobalBOMTable list={wallList} />
                  </div>
                )}

                {roofList.length > 0 && (
                  <div style={{ backgroundColor: '#1a1a1a', padding: '12px', borderRadius: '6px', border: '1px solid #333' }}>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '11px', color: '#ff8c00', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                      Roof Framing
                    </h4>
                    <GlobalBOMTable list={roofList} />
                  </div>
                )}
              </div>
            )}

            {bomViewMode === 'installation' && (
              <CoversInstallationPlan />
            )}
          </div>
        )}
      </section>
    </div>
  );
}
