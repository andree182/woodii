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
- **FloorGroup:** Renders the floor slab and its `WallNode`s.
- **WallNode:** Computes the 3D mesh based on wall coordinates, applies boolean operations or shader tricks for door/window holes, and renders `SubObjectNode`s.
- **RoofNode:** Generates the roof geometry based on the `RoofConfig`.

### 4.3. Business Logic & Plan Generation
- **Construction Engine:** A utility module that translates the abstract `ProjectState` into literal 2x4 placements (studs, plates, joists, rafters).
- **BOM Generator:** Extracts the quantities and lengths of materials from the Construction Engine output to display the Bill of Materials.

## 5. Implementation Phases

**Phase 1: Project Setup & Core State**
- Initialize Vite React TS project.
- Install R3F dependencies.
- Define the typescript interfaces and set up the global state store with initial demo data.

**Phase 2: Basic 3D Rendering (Static)**
- Set up the R3F `<Canvas>` with lighting and camera controls.
- Implement rendering for basic dimensions: floors, abstract solid walls, and a primitive roof.
- Ensure the abstract data model correctly projects into the 3D space.

**Phase 3: Interactivity & UI Binding**
- Implement raycasting to allow selecting walls and roofs.
- Build the React DOM properties panel that reads/writes to the state.
- Implement basic drag controls to adjust wall sizes/positions visually.

**Phase 4: Sub-Objects & Wall Details**
- Implement Windows and Doors.
- Update the Wall rendering to accommodate holes for sub-objects.
- Enable dragging of sub-objects along the host wall.
- Add multi-layer visual representation to the walls (outer, middle, inner).

**Phase 5: Advanced Viewing & Multi-Floor logic**
- Implement "see-through" toggles (e.g., modifying material opacity/depth tests to see construction or inner walls).
- Finalize logic for multi-floor stacking and floor openings/steps.

**Phase 6: The Construction Engine (2x4 Logic)**
- Develop the algorithm to compute stud placements, top/bottom plates, floor joists, and roof rafters based on the parametric state.
- Create a specific visual mode to render these 2x4 studs in the 3D view instead of the solid wall layers.

**Phase 7: Plan Export & Persistence**
- Implement the BOM (Bill of Materials) UI.
- Wire up Save/Load functionality (JSON serialization of the state to LocalStorage/File).
- Final polish, ensuring alignment with R3F best practices (performance profiling, minimizing draw calls if necessary).

## 6. Development Workflow Rules
- **Verify before advancing:** Each phase must have a working, visible output before moving to the next.
- **No premature optimization:** Use standard Three.js geometries first. Only move to custom `BufferGeometry` or instancing if performance drops.
- **Clean Separation:** Keep 3D visual logic in R3F components, and business/state logic in the store or utility functions.
