# Architecture & Implementation Plan: Woodii 3D Designer

This document outlines the technical architecture, data model, and phased implementation plan for the Woodii 3D building designer. It is intended for programming agents and developers to align on the structure before any code is written, adhering to the requirements in `PLAN.md` and the rules in `AGENTS.md`.

## 1. Core Principles & Guidelines
- **Simplicity First:** Write the minimum code required. No speculative features or over-engineered abstractions.
- **Minimal Dependencies:** Stick to React, Three.js (`@react-three/fiber`, `@react-three/drei`), and Vite. Avoid heavy UI libraries unless necessary. For state management, consider a lightweight solution like `zustand` to prevent excessive re-renders during 3D interactions.
- **R3F Best Practices:** Rely on the idiomatic patterns described in `r3f-skills` (e.g., using `useFrame` for animations, dividing concerns between React DOM and R3F Canvas).
- **Surgical Changes:** Iterate on features systematically without breaking adjacent code.

## 2. Tech Stack Overview
- **Build Tool:** Vite
- **Framework:** React
- **3D Rendering:** `three`, `@react-three/fiber` (R3F)
- **3D Helpers:** `@react-three/drei` (for OrbitControls, Environment, Raycasting, HTML overlays)
- **State Management:** `zustand` (highly recommended for R3F to bind state to components without triggering global React re-renders) or React Context + minimal hooks.

## 3. Data Model Architecture
The state must describe the building parametrically so it can be both rendered in 3D and processed to generate the 2x4 material plans.

```typescript
// Proposed high-level State shape
interface ProjectState {
  version: string;
  buildingType: 'garden_saddle' | 'garden_flat' | 'playhouse' | 'henhouse' | 'tiny_house';
  dimensions: { width: number, depth: number }; // Overall footprint
  floors: Floor[];
  roof: RoofConfig;
  foundation?: { type: 'slab' | 'screws' }; // Configurable foundation option
  uiState: UIState; // Selection, see-through modes
}

interface Floor {
  id: string;
  height: number;
  elevation: number; // Z/Y position
  walls: Wall[];
  floorOpening?: { x: number, y: number, width: number, depth: number }; // or stair config
}

interface Wall {
  id: string;
  start: [number, number]; // 2D coordinates for the wall line
  end: [number, number];
  layers: { outer: number, middle: number, inner: number }; // thickness config
  layerThicknesses?: { outer: number, middle: number, inner: number }; // custom absolute thickness overrides in meters
  subObjects: SubObject[];
}

interface SubObject {
  id: string;
  type: 'window' | 'door' | 'opening';
  position: number; // offset along the wall
  width: number;
  height: number;
  elevation?: number; // vertical height offset from floor in meters
  color?: string;
}

interface RoofConfig {
  type: 'saddle' | 'flat';
  inclination: number;
  overhang: number;
  thickness: number;
  constructionWidth: number;
}
```

## 4. Component Architecture

### 4.1. DOM UI Layer
- **Toolbar:** Save/Load/Demo actions, global view modes ("see-through").
- **Properties Panel:** Context-sensitive inputs based on the currently selected object (Wall, SubObject, Roof).

### 4.2. R3F Canvas Layer
- **Scene Setup:** Lighting, Environment, OrbitControls.
- **BuildingRenderer:** Iterates over the `ProjectState` to render `FloorGroup`s.
- **FloorGroup:** Renders the floor slab (or ground screw grid) and its `WallNode`s.
- **WallNode:** Computes the 3D mesh based on wall coordinates, applies boolean operations or shader tricks for door/window holes, and renders `SubObjectNode`s.
- **RoofNode:** Generates the roof geometry based on the `RoofConfig`.

### 4.3. Business Logic & Plan Generation
- **Construction Engine:** A utility module that translates the abstract `ProjectState` into literal 2x4 placements (studs, plates, joists, rafters).
- **BOM Generator:** Extracts the quantities and lengths of materials from the Construction Engine output to display the Bill of Materials.

## 5. Implementation Phases

**Phases 1 to 9: Foundation, Framing, Wall Height, and Global Siding Configurations (Completed)**

**Phase 10: Siding Composition Presets**
- Define `wallPreset: 'custom' | 'diffusion_open' | 'diffusion_closed'` in state.
- Automatically configure global `wallLayers` thicknesses based on the active preset.
- Adapt the 3D wall mesh layers to skip rendering the inner layer if thickness is `0` (for cheap/diffusion-closed houses).

**Phase 11: Staggered Structural Blocking (Noggings & Bridging)**
- Implement horizontal staggered noggings centered between studs in wall framing.
- Implement staggered horizontal blocking between floor joists along the centerline of the joist spans.
- Alternate block elevations/offsets in adjacent bays for realistic face-nailing representation.

**Phase 12: Internal Partition Walls Editor**
- Add `internalWalls` array to the `Floor` type, supporting custom start/end points, `timberSize` (width/thickness), double-sided cladding (`liningThickness`), and door openings.
- Render internal wall frames and cladding layers using butt-joints against outer wall inner faces, supporting standard solid/see-through display modes.
- Implement Sidebar interface to add, remove, and configure internal wall partitions.


## 6. Development Workflow Rules
- **Verify before advancing:** Each phase must have a working, visible output before moving to the next.
- **No premature optimization:** Use standard Three.js geometries first. Only move to custom `BufferGeometry` or instancing if performance drops.
- **Clean Separation:** Keep 3D visual logic in R3F components, and business/state logic in the store or utility functions.
