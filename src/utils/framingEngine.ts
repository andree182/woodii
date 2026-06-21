import { ProjectState } from '../types';
import { generateScrews } from './framing/screwGenerator';
import { generateFloorJoists } from './framing/floorGenerator';
import { generateWalls } from './framing/wallGenerator';
import { generateRoof } from './framing/roofGenerator';

export interface FramingMember {
  id: string;
  type: 'stud' | 'plate' | 'joist' | 'rafter' | 'header' | 'sill' | 'ridge' | 'screw';
  position: [number, number, number]; // Center in world coordinates [X, Y, Z]
  rotation: [number, number, number]; // Rotation angles [X, Y, Z] in radians
  size: [number, number, number];     // Size dimensions [width, height, depth]
  floorId?: string;                   // Optional association to specific Floor
  wallId?: string;                    // Optional association to specific Wall
}

export const getWallLayers = (state: ProjectState) => {
  return state.wallLayers ?? { outer: 0.02, middle: 0.10, inner: 0.03 };
};

export function generateFraming(state: ProjectState): FramingMember[] {
  const members: FramingMember[] = [];

  // 1. Generate Foundation Screws
  members.push(...generateScrews(state));

  // 2. Generate Floor Joists
  members.push(...generateFloorJoists(state));

  // 3. Generate Wall Framing (External & Internal)
  members.push(...generateWalls(state));

  // 4. Generate Roof Framing
  members.push(...generateRoof(state));

  // Post-process to associate members with specific floors and walls for localized cut lists
  members.forEach((member) => {
    if (member.id.startsWith('floor-')) {
      const match = member.id.match(/floor-.*?-(\d+)/) || member.id.match(/-(\d+)(?:-|$)/);
      if (match) {
        const level = parseInt(match[1], 10);
        const floor = state.floors.find(f => f.level === level);
        if (floor) {
          member.floorId = floor.id;
        }
      }
    } else if (member.id.startsWith('wall-') || member.id.startsWith('internal-')) {
      const floorMatch = member.id.match(/(floor-\d+)/);
      if (floorMatch) {
        member.floorId = floorMatch[1];
      }
      const wallMatch = member.id.match(/(wall-(?:front|back|left|right))/) || member.id.match(/(internal-floor-\d+-\d+)/);
      if (wallMatch) {
        member.wallId = wallMatch[1] || wallMatch[0];
      }
    }
  });

  return members;
}
