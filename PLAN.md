General notes:
* Keep the discussion technical and to the point.
* No need to verbosely explain decisions, unless there are major design things to discuss.
* Expect reasonable expertise, but not necessarily full API knowledge.


We are designing together a web F/three.js/jsx (using vite to build) application that will allow the user design a wooden 3D building. Try to keep the dependencies at minimum.

* Supported building types in general:
  * garden house with saddle roof
  * garden house with flat roof
  * kids playhouse
  * henhouse
  * tiny house
  
* Each building has supports multiple floors, each can be partitioned differently by walls with doors:
  * Each floor will have the same construction, except the bottom-most and under-roof floors
  * With multiple floors, either simple "floor" opening can be specified, or some kind of steps.

* Configurable roof properties:
  * Inclination, overhang, thickness
  * Floor construction/width

* Configurable outer wall properties:
  * Preset siding compositions: Diffusion-Open (siding + studs + OSB inner lining), Diffusion-Closed (siding + OSB + studs, no inner lining), and Custom (manual layer thickness inputs).
  * elements: windows, doors, and empty openings (for custom elements)

* New/Load/Save/Demo project features should be available

* Main feature is that after this is done, the tool will be able to produce 2x4 building plans:
  * Wall-by-wall framing plans and component lists (HIGH PRIORITY): list of all wood components needed per individual wall, including exact lengths and placement offsets along the wall.
  * Consolidated bill of materials (BOM).

* UI:
  * Allow adjusting the properties by visual dragging of wall sides or manually setting the variables (width, height etc.).
  * Click a wall to select it, and then add one of the available sub-objects (doors, windows, empty openings).
  * The sub-objects can be selected, and moved on the wall by dragging (horizontally, and also vertically for windows/openings) - or their properties can be adjusted (color, dimensions, elevation).
  * Allow 'see through' with shown construction items
  * Allow 'see through' for different floors, and to see behind outer walls

* Advanced Construction Rules & Foundations:
  * Symmetrical and flush alignment of outer floor joists (rim joists) and roof rafters to cover the exact floor/roof dimensions without offset skew.
  * Dynamic width calculation of saddle roof collar ties based on their elevation to sit flush inside the sloped rafters and avoid outer protrusion.
  * Configurable ceiling/attic floor slab (roof of the top floor) rendered below the roof with custom openings (for attic access, chimneys, etc.).
  * Configurable foundation options: Concrete Slab vs Ground Screws (automatically calculate and render ground screw layout grids and list them in the BOM).
  * Staggered horizontal noggings/blocking in walls and floor joist bays to increase structural stability.
  * Internal Partition Walls Editor: Allow partitioning each floor using non-structural walls with custom timber dimensions (e.g., 2x3 framing), double-sided drywall/OSB lining, and door openings, with butt-joint connections.

* Out of Scope:
  * Small internal or external components (such as wheels, porches, verandas, or nest boxes). Focus is strictly on full floor/wall structural framing, foundations, and siding layers.
