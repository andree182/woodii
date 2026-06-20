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

**Phase 1 to 6: Core Setup, Rendering, Dragging, Sub-objects, Multi-floor, and Framing (Completed)**

**Phase 7: Wall-by-Wall Framing Plans & Component Lists (Active/High Priority)**
- Update the Construction Engine to track host floor and wall associations for each member.
- Re-architect the BOM UI sidebar tab to offer wall-by-wall schedules, lists, and positioning maps.

**Phase 8: Ground Screw Foundation**
- Introduce a foundation selector in the UI.
- Implement an algorithm to generate optimal ground screw grid placement and render steel ground screws extending downward in 3D.
- Add ground screws to the BOM lists.

**Phase 9: Configurable Siding Layer Thickness**
- Allow users to configure outer, middle, and inner layer thicknesses.
- Propagate custom thicknesses to 3D mesh render layers and framing stud width calculations.


## 6. Development Workflow Rules
- **Verify before advancing:** Each phase must have a working, visible output before moving to the next.
- **No premature optimization:** Use standard Three.js geometries first. Only move to custom `BufferGeometry` or instancing if performance drops.
- **Clean Separation:** Keep 3D visual logic in R3F components, and business/state logic in the store or utility functions.
