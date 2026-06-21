# Woodii 3D Designer 🪵

**Woodii** is a premium, web-based 3D workspace and construction plan compiler designed for timber frame projects (such as garden houses, playhouses, tiny houses, and partition wall structures). 

The app allows users to visually design buildings in a 3D interface, dynamically recalculate framing structures (studs, plates, joists, and rafters) according to building science rules, and instantly compile print-ready construction workbooks containing wall-by-wall schedules, cut lists, 2D vector plans, and a consolidated Bill of Materials (BOM).

---

## 🚀 Key Features

### 1. Viewport Camera Modes
* **Orbit View:** Standard orbital orbital controls to rotate, pan, and zoom around the building model.
* **Orthographic Top-Down View:** Perfect flat projection for tracing internal layouts and moving partition walls.
* **First-Person Walking:** Walk inside the building using `WASD`/`Arrow` controls and drag to look around.

### 2. Framing & Construction Engine
* **Double Top Plate Interlocking:** Corner joins are automatically interlocked (lower double plate spans the full wall length, upper double plate crosses over at corners).
* **Roof Trusses & Collar Ties:** Supports saddle and flat roofs with vertical rafter miter cuts, sloped collar-tie width adjustments, and ceiling hatches.
* **Pier & Ground Screws Foundations:** Automatically generates optimal load-bearing ground screw grids (76x800mm) instead of concrete slabs.
* **Staggered Noggings (Blocking):** Automatically computes and places mid-height horizontal blocking in walls and floors, staggering bays to allow face-nailing.

### 3. Internal Wall Partition Editor
* Add user-defined partition layouts with custom structural parameters (e.g. 2x3 framing profiles and dual-sided plasterboard linings).
* Supports rotatable internal walls (snaps to 22.5°) and custom door frame elements.

### 4. Interactive Dimension Lines Overlay
* Displays glowing horizontal and vertical distance guides in the 3D viewport when dragging openings (doors, windows, passages).
* Highlights the left offset, right offset, width (`W`), height (`H`), and elevation (`Elev`) in real-time.

### 5. Architectural Blueprint Export & BOM
* **Cut Lists:** Individual schedules per wall showing nominal sizes, types, lengths (mm), and quantities.
* **2D Vector Layouts:** Inline blueprint drawings depicting framing members, opening spans, and dimensions.
* **PDF Workbook Export:** Single-click compilation generating a multi-page vector PDF blueprint layout.

---

## 🛠️ Technology Stack

* **Core:** React 18, TypeScript, Vite
* **3D Rendering:** Three.js, React Three Fiber (R3F), `@react-three/drei`
* **State Management:** Zustand with `localStorage` state persistence
* **Blueprint Generation:** HTML5 Canvas, SVG rendering, custom framing geometry compilation

---

## 💻 Getting Started

### 1. Clone & Install Dependencies
```bash
npm install
```

### 2. Start Local Development Server
```bash
npm run dev
```

### 3. Build Production Bundle
```bash
npm run build
```
