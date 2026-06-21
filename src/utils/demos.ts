import { Floor } from '../types';

export interface DemoProject {
  buildingType: string;
  dimensions: {
    width: number;
    depth: number;
    heightPerFloor: number;
  };
  wallPreset: 'custom' | 'diffusion_open' | 'diffusion_closed';
  wallLayers: {
    outer: number;
    middle: number;
    inner: number;
  };
  structuralConfig: {
    wallBlocking: boolean;
    floorBlocking: boolean;
  };
  foundation: {
    type: 'slab' | 'screws';
  };
  roof: {
    type: 'saddle' | 'flat';
    inclination: number;
    overhang: number;
    thickness: number;
    constructionWidth: number;
  };
  floors: Floor[];
}

export const DEMO_PROJECTS: { [key: string]: { name: string; project: DemoProject } } = {
  garden_shed: {
    name: "Classic Garden Shed (Single Floor)",
    project: {
      buildingType: 'garden_saddle',
      dimensions: { width: 4.5, depth: 3.5, heightPerFloor: 2.4 },
      wallPreset: 'diffusion_closed',
      wallLayers: { outer: 0.02, middle: 0.07, inner: 0.00 },
      structuralConfig: { wallBlocking: true, floorBlocking: false },
      foundation: { type: 'slab' },
      roof: { type: 'saddle', inclination: 25, overhang: 0.35, thickness: 0.12, constructionWidth: 0.10 },
      floors: [
        {
          id: 'floor-0',
          level: 0,
          walls: [
            {
              id: 'wall-front',
              start: [-2.295, 1.75],
              end: [2.295, 1.75],
              thickness: 0.09,
              subObjects: [
                { id: 'door-main-0', type: 'door', position: 2.25, width: 0.9, height: 2.0, color: '#8B4513' }
              ]
            },
            {
              id: 'wall-right',
              start: [2.25, 1.705],
              end: [2.25, -1.705],
              thickness: 0.09,
              subObjects: [
                { id: 'window-side-0', type: 'window', position: 1.75, width: 1.0, height: 1.0, color: '#ffffff' }
              ]
            },
            {
              id: 'wall-back',
              start: [2.295, -1.75],
              end: [-2.295, -1.75],
              thickness: 0.09,
              subObjects: []
            },
            {
              id: 'wall-left',
              start: [-2.25, -1.705],
              end: [-2.25, 1.705],
              thickness: 0.09,
              subObjects: []
            }
          ],
          internalWalls: [
            {
              id: 'internal-floor-0-demo-1',
              start: [-0.5, -1.705],
              end: [-0.5, 1.705],
              timberSize: { thickness: 0.04, width: 0.07 },
              liningThickness: 0.0125,
              subObjects: [
                { id: 'door-internal-1', type: 'door', position: 1.5, width: 0.8, height: 1.9, color: '#d2b48c' }
              ]
            }
          ]
        }
      ]
    }
  },
  tiny_house: {
    name: "Tiny House (Two Floors & Flat Roof)",
    project: {
      buildingType: 'tiny_house',
      dimensions: { width: 5.0, depth: 3.0, heightPerFloor: 2.4 },
      wallPreset: 'diffusion_open',
      wallLayers: { outer: 0.02, middle: 0.10, inner: 0.02 },
      structuralConfig: { wallBlocking: true, floorBlocking: true },
      foundation: { type: 'screws' },
      roof: { type: 'flat', inclination: 4, overhang: 0.40, thickness: 0.15, constructionWidth: 0.12 },
      floors: [
        {
          id: 'floor-0',
          level: 0,
          walls: [
            {
              id: 'wall-front',
              start: [-2.57, 1.5],
              end: [2.57, 1.5],
              thickness: 0.14,
              subObjects: [
                { id: 'door-main-0', type: 'door', position: 1.8, width: 0.9, height: 2.0, color: '#3e2723' },
                { id: 'window-front-0', type: 'window', position: 3.5, width: 1.2, height: 1.0, elevation: 0.9, color: '#ffffff' }
              ]
            },
            {
              id: 'wall-right',
              start: [2.5, 1.43],
              end: [2.5, -1.43],
              thickness: 0.14,
              subObjects: []
            },
            {
              id: 'wall-back',
              start: [2.57, -1.5],
              end: [-2.57, -1.5],
              thickness: 0.14,
              subObjects: [
                { id: 'window-back-0', type: 'window', position: 2.5, width: 1.2, height: 1.0, elevation: 0.9, color: '#ffffff' }
              ]
            },
            {
              id: 'wall-left',
              start: [-2.5, -1.43],
              end: [-2.5, 1.43],
              thickness: 0.14,
              subObjects: []
            }
          ],
          internalWalls: [],
          floorOpening: { x: 1.5, z: 0.5, width: 0.9, depth: 1.2 }
        },
        {
          id: 'floor-1',
          level: 1,
          walls: [
            {
              id: 'wall-front',
              start: [-2.57, 1.5],
              end: [2.57, 1.5],
              thickness: 0.14,
              subObjects: [
                { id: 'window-front-1', type: 'window', position: 2.5, width: 1.0, height: 0.8, elevation: 1.0, color: '#ffffff' }
              ]
            },
            {
              id: 'wall-right',
              start: [2.5, 1.43],
              end: [2.5, -1.43],
              thickness: 0.14,
              subObjects: []
            },
            {
              id: 'wall-back',
              start: [2.57, -1.5],
              end: [-2.57, -1.5],
              thickness: 0.14,
              subObjects: []
            },
            {
              id: 'wall-left',
              start: [-2.5, -1.43],
              end: [-2.5, 1.43],
              thickness: 0.14,
              subObjects: []
            }
          ],
          internalWalls: [
            {
              id: 'internal-floor-1-demo-2',
              start: [1.0, -1.43],
              end: [1.0, 1.43],
              timberSize: { thickness: 0.04, width: 0.07 },
              liningThickness: 0.0125,
              subObjects: [
                { id: 'door-internal-2', type: 'door', position: 1.43, width: 0.8, height: 1.9, color: '#d2b48c' }
              ]
            }
          ]
        }
      ]
    }
  },
  playhouse: {
    name: "Kids Playhouse (Ground Screws Grid)",
    project: {
      buildingType: 'playhouse',
      dimensions: { width: 2.4, depth: 2.0, heightPerFloor: 1.8 },
      wallPreset: 'custom',
      wallLayers: { outer: 0.015, middle: 0.05, inner: 0.01 },
      structuralConfig: { wallBlocking: false, floorBlocking: false },
      foundation: { type: 'screws' },
      roof: { type: 'saddle', inclination: 35, overhang: 0.25, thickness: 0.08, constructionWidth: 0.08 },
      floors: [
        {
          id: 'floor-0',
          level: 0,
          walls: [
            {
              id: 'wall-front',
              start: [-1.2375, 1.0],
              end: [1.2375, 1.0],
              thickness: 0.075,
              subObjects: [
                { id: 'door-main-0', type: 'door', position: 1.2, width: 0.6, height: 1.4, color: '#ff5722' }
              ]
            },
            {
              id: 'wall-right',
              start: [1.2, 0.9625],
              end: [1.2, -0.9625],
              thickness: 0.075,
              subObjects: [
                { id: 'window-side-0', type: 'window', position: 1.0, width: 0.6, height: 0.6, elevation: 0.7, color: '#ffeb3b' }
              ]
            },
            {
              id: 'wall-back',
              start: [1.2375, -1.0],
              end: [-1.2375, -1.0],
              thickness: 0.075,
              subObjects: []
            },
            {
              id: 'wall-left',
              start: [-1.2, -0.9625],
              end: [-1.2, 0.9625],
              thickness: 0.075,
              subObjects: []
            }
          ],
          internalWalls: []
        }
      ]
    }
  }
};
