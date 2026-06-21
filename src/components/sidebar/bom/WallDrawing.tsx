import { useState, useEffect } from 'react';
import { FramingMember } from '../../../utils/framingEngine';
import { generateWallSVGString } from './bomUtils';

interface WallDrawingProps {
  wall: any;
  wallMembers: FramingMember[];
  heightPerFloor: number;
  getCutIdentifier: (nominal: string, length: number) => string;
}

export default function WallDrawing({ wall, wallMembers, heightPerFloor, getCutIdentifier }: WallDrawingProps) {
  const [isMaximized, setIsMaximized] = useState(false);

  const dx = wall.end[0] - wall.start[0];
  const dz = wall.end[1] - wall.start[1];
  const wallLength = Math.sqrt(dx * dx + dz * dz);
  const margin = 0.35;
  const svgWidth = wallLength + margin * 2;
  const svgHeight = heightPerFloor + margin * 2;

  const floorPart = wallMembers[0]?.floorId?.split('-')?.[1];
  const floorLevel = floorPart ? parseInt(floorPart) : 0;

  useEffect(() => {
    if (!isMaximized) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMaximized(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMaximized]);

  const downloadSVG = (svgId: string, filename: string) => {
    const svgElement = document.getElementById(svgId);
    if (!svgElement) return;
    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(svgElement);
    if (!source.match(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)) {
      source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    if (!source.match(/^<svg[^>]+xmlns:xlink="http:\/\/www\.w3\.org\/1999\/xlink"/)) {
      source = source.replace(/^<svg/, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
    }
    const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(source);
    const downloadLink = document.createElement("a");
    downloadLink.href = url;
    downloadLink.download = filename;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  const downloadPNG = (svgId: string, filename: string) => {
    const svgElement = document.getElementById(svgId);
    if (!svgElement) return;
    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(svgElement);
    if (!source.match(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)) {
      source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    if (!source.match(/^<svg[^>]+xmlns:xlink="http:\/\/www\.w3\.org\/1999\/xlink"/)) {
      source = source.replace(/^<svg/, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
    }
    const svgBlob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const URL = window.URL || window.webkitURL || window;
    const blobURL = URL.createObjectURL(svgBlob);
    
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      const scale = 2; // High-res export
      canvas.width = svgWidth * 150 * scale; 
      canvas.height = svgHeight * 150 * scale; 
      
      const context = canvas.getContext('2d');
      if (context) {
        context.fillStyle = '#151515';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        
        const pngURL = canvas.toDataURL('image/png');
        const downloadLink = document.createElement('a');
        downloadLink.href = pngURL;
        downloadLink.download = filename;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
      }
      URL.revokeObjectURL(blobURL);
    };
    image.src = blobURL;
  };

  const svgId = `sidebar-svg-${wall.id}`;
  const maxSvgId = `max-svg-${wall.id}`;

  const renderSvgContent = (isMaximizedVersion: boolean) => {
    const svgIdToUse = isMaximizedVersion ? maxSvgId : svgId;
    const svgStr = generateWallSVGString(wall, wallMembers, heightPerFloor, getCutIdentifier, floorLevel, false, svgIdToUse);
    return (
      <div 
        id={isMaximizedVersion ? `max-container-${wall.id}` : `sidebar-container-${wall.id}`}
        onClick={isMaximizedVersion ? undefined : () => setIsMaximized(true)}
        style={{ cursor: isMaximizedVersion ? 'default' : 'zoom-in', width: '100%' }}
        dangerouslySetInnerHTML={{ __html: svgStr }}
      />
    );
  };

  return (
    <div style={{
      marginTop: '10px',
      marginBottom: '10px',
      backgroundColor: '#111',
      border: '1px solid #333',
      borderRadius: '6px',
      padding: '8px',
      display: 'flex',
      flexDirection: 'column',
      gap: '6px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '10px', color: '#ff8c00', fontWeight: 600, textTransform: 'uppercase' }}>Wall Framing Plan Drawing</span>
        <span style={{ fontSize: '9px', color: '#888' }}>Click to enlarge / download</span>
      </div>

      {renderSvgContent(false)}

      {isMaximized && (
        <div
          onClick={() => setIsMaximized(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
            cursor: 'zoom-out'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#1e1e1e',
              border: '1px solid #ff8c00',
              borderRadius: '12px',
              padding: '24px',
              width: '90%',
              maxWidth: '800px',
              boxShadow: '0 10px 40px rgba(0,0,0,0.6)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              cursor: 'default'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, color: '#ff8c00', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Framing Plan: {wall.id.startsWith('internal-') ? `Partition Wall` : wall.id}
              </h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => downloadSVG(maxSvgId, `framing-plan-${wall.id}.svg`)}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#ff8c00',
                    color: '#000',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Download SVG
                </button>
                <button
                  onClick={() => downloadPNG(maxSvgId, `framing-plan-${wall.id}.png`)}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#ff8c00',
                    color: '#000',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Download PNG
                </button>
                <button
                  onClick={() => setIsMaximized(false)}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#444',
                    color: '#eee',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Close
                </button>
              </div>
            </div>

            <div style={{ backgroundColor: '#151515', borderRadius: '8px', padding: '16px', border: '1px solid #333', display: 'flex', justifyContent: 'center' }}>
              {renderSvgContent(true)}
            </div>

            <div style={{ fontSize: '10px', color: '#666', fontStyle: 'italic' }}>
              Click anywhere outside or hit ESC to close. Downloaded SVG files are vector scale plans.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
