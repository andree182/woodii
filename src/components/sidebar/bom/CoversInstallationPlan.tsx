import { useProjectStore } from '../../../store';
import { calculateCoversBOM } from '../../../utils/coversCalculator';

export default function CoversInstallationPlan() {
  const state = useProjectStore.getState();
  const coversBOM = calculateCoversBOM(state);

  const { roof, walls, totals } = coversBOM;
  const { topCover, wallCovers } = state;

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* 1. Summary Totals */}
      <div style={{
        backgroundColor: '#1a1a1a',
        padding: '12px',
        borderRadius: '6px',
        border: '1px solid #333',
        fontSize: '11px',
        color: '#ccc',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px'
      }}>
        <h4 style={{ margin: '0 0 4px 0', color: '#ff8c00', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
          CONSOLIDATED MATERIAL TOTALS
        </h4>
        {topCover.sheetingMaterial !== 'none' && (
          <div><strong>Roof Sheeting:</strong> {totals.roofSheetingSheets} sheets of {getSheetingLabel(topCover.sheetingMaterial)} ({topCover.sheetingThickness * 1000}mm)</div>
        )}
        <div>
          <strong>Roof Top Cover:</strong> {topCover.material === 'shingles' ? `${totals.roofShinglesCount} Shingles` : topCover.material === 'tiles' ? `${totals.roofTilesCount} Tiles` : `${totals.roofPlatesCount} Aluminum Plates`} ({topCover.width}x{topCover.height}m)
        </div>

        {state.roofCovers && (state.roofCovers.soffitMaterial !== 'none' || state.roofCovers.fasciaMaterial !== 'none' || state.roofCovers.gableMaterial !== 'none') && (
          <div style={{ borderTop: '1px solid #2a2a2a', marginTop: '4px', paddingTop: '4px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {state.roofCovers.soffitMaterial !== 'none' && (
              <div><strong>Roof Soffit:</strong> {totals.soffitPieces} boards of length 4.0m ({totals.soffitMeters.toFixed(1)}m total)</div>
            )}
            {state.roofCovers.fasciaMaterial !== 'none' && (
              <div><strong>Eaves Fascia:</strong> {totals.fasciaPieces} boards of length 4.0m ({totals.fasciaMeters.toFixed(1)}m total)</div>
            )}
            {state.roofCovers.gableMaterial !== 'none' && (
              <div><strong>Gable Wind Board:</strong> {totals.gablePieces} boards of length 4.0m ({totals.gableMeters.toFixed(1)}m total)</div>
            )}
          </div>
        )}
        
        {wallCovers.external.material !== 'none' && (
          <div style={{ borderTop: '1px solid #2a2a2a', marginTop: '4px', paddingTop: '4px' }}>
            <strong>Wall Ext. Cladding:</strong>{' '}
            {wallCovers.external.material === 'rhombus' || wallCovers.external.material === 'decking'
              ? `${totals.externalCladdingPieces} boards of length ${wallCovers.external.length}m (${totals.externalCladdingMeters.toFixed(1)}m total)`
              : `${totals.externalOSBSheets} sheets of ${getSideCoverLabel(wallCovers.external.material)}`}
          </div>
        )}

        {wallCovers.internal.material !== 'none' && (
          <div style={{ borderTop: '1px solid #2a2a2a', marginTop: '4px', paddingTop: '4px' }}>
            <strong>Wall Int. Lining:</strong>{' '}
            {wallCovers.internal.material === 'decking'
              ? `${totals.internalCladdingPieces} boards of length ${wallCovers.internal.length}m (${totals.internalCladdingMeters.toFixed(1)}m total)`
              : wallCovers.internal.material === 'plasterboard'
                ? `${totals.internalPlasterboardSheets} Plasterboard sheets`
                : `${totals.internalOSBSheets} OSB sheets`}
          </div>
        )}
      </div>

      {/* 2. Roof Cover Section */}
      <section style={{ backgroundColor: '#1e1e1e', padding: '12px', borderRadius: '6px', border: '1px solid #333' }}>
        <h4 style={{ margin: '0 0 10px 0', fontSize: '11px', color: '#ff8c00', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
          Roof Covering Plan
        </h4>
        <div style={{ fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '8px', color: '#ccc' }}>
          <div>Roof Surface Area: <strong style={{ color: '#fff' }}>{roof.roofArea.toFixed(2)} m²</strong></div>
          {topCover.sheetingMaterial !== 'none' && (
            <div style={{ borderTop: '1px solid #2a2a2a', paddingTop: '6px' }}>
              <strong>Sheeting Installation:</strong>
              <div style={{ color: '#aaa', marginTop: '2px' }}>
                Lay {totals.roofSheetingSheets} panels of {getSheetingLabel(topCover.sheetingMaterial)} ({topCover.sheetingThickness * 1000}mm thickness) flush across rafters.
              </div>
            </div>
          )}
          <div style={{ borderTop: '1px solid #2a2a2a', paddingTop: '6px' }}>
            <strong>Top Cover Laying Guide ({topCover.material.toUpperCase()}):</strong>
            <div style={{ color: '#aaa', marginTop: '2px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <div>• Total Quantity: <strong style={{ color: '#fff' }}>{roof.topCoverPieces} pieces</strong></div>
              <div>• Exposure Size: {topCover.visibleWidth}m (width) x {topCover.visibleHeight}m (exposure overlap)</div>
              <div>• Row structure: <strong style={{ color: '#fff' }}>{roof.rowsCount} rows</strong>, laying <strong style={{ color: '#fff' }}>{roof.piecesPerRow} pieces</strong> horizontally per row.</div>
            </div>
          </div>
          {state.roofCovers && (state.roofCovers.soffitMaterial !== 'none' || state.roofCovers.fasciaMaterial !== 'none' || state.roofCovers.gableMaterial !== 'none') && (
            <div style={{ borderTop: '1px solid #2a2a2a', paddingTop: '6px' }}>
              <strong>Overhangs & Trims Installation:</strong>
              <div style={{ color: '#aaa', marginTop: '2px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {state.roofCovers.soffitMaterial !== 'none' && (
                  <div>• Soffit bottom covers: Lay {totals.soffitPieces} boards ({totals.soffitMeters.toFixed(1)}m total) under eaves & gable overhangs.</div>
                )}
                {state.roofCovers.fasciaMaterial !== 'none' && (
                  <div>• Eaves Fascia boards: Install {totals.fasciaPieces} boards ({totals.fasciaMeters.toFixed(1)}m total) along the eave ends of rafters.</div>
                )}
                {state.roofCovers.gableMaterial !== 'none' && (
                  <div>• Gable Wind boards: Install {totals.gablePieces} boards ({totals.gableMeters.toFixed(1)}m total) along the slanted pitch gable edges.</div>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 3. Wall Assembly Installation Details */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <h4 style={{ margin: '0', fontSize: '11px', color: '#ff8c00', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
          Wall Sheathing & Cladding Details
        </h4>
        {walls.map((w, idx) => (
          <div key={idx} style={{
            backgroundColor: '#1e1e1e',
            border: '1px solid #333',
            borderRadius: '6px',
            padding: '10px',
            fontSize: '11px',
            color: '#ccc',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}>
            <div style={{ fontWeight: 600, color: '#fff', fontSize: '11px', borderBottom: '1px solid #2a2a2a', paddingBottom: '4px' }}>
              {w.wallTitle}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', color: '#aaa' }}>
              <div>Wall Gross Area: {w.grossArea.toFixed(2)}m²</div>
              <div>Openings Deduction: {w.openingsArea.toFixed(2)}m²</div>
            </div>
            <div style={{ fontWeight: 600, color: '#ff8c00' }}>
              Net Coverage Area: {w.netArea.toFixed(2)}m²
            </div>

            {/* External Cover details */}
            {w.external.material !== 'none' && (
              <div style={{ borderTop: '1px solid #2a2a2a', paddingTop: '4px', marginTop: '4px' }}>
                <span style={{ color: '#888' }}>Ext. Cladding:</span> <strong style={{ color: '#eee' }}>{getSideCoverLabel(w.external.material)}</strong>
                <div style={{ color: '#aaa', marginTop: '2px' }}>
                  {w.external.material === 'rhombus' || w.external.material === 'decking'
                    ? `Requires ${w.external.linearMeters.toFixed(1)}m of boards (${w.external.piecesCount} pcs of length ${wallCovers.external.length}m)`
                    : `Requires ${w.external.piecesCount} sheets`}
                </div>
              </div>
            )}

            {/* Internal Lining details */}
            {w.internal.material !== 'none' && (
              <div style={{ borderTop: '1px solid #2a2a2a', paddingTop: '4px', marginTop: '4px' }}>
                <span style={{ color: '#888' }}>Int. Lining:</span> <strong style={{ color: '#eee' }}>{getSideCoverLabel(w.internal.material)}</strong>
                <div style={{ color: '#aaa', marginTop: '2px' }}>
                  {w.internal.material === 'decking'
                    ? `Requires ${w.internal.linearMeters.toFixed(1)}m of boards (${w.internal.piecesCount} pcs of length ${wallCovers.internal.length}m)`
                    : `Requires ${w.internal.piecesCount} sheets`}
                </div>
              </div>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
