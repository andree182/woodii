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
  * layers (outer shell, middle layer with insulation and stands, inner layer). For now 3-layers with different widths, in then end the general design can just calculate with total thickness - however the final plan should take all into consideration.
  * elements: windows, door

* New/Load/Save/Demo project features should be available

* Main feature is that after this is done, the tool will be able to produce 2x4 building plans:
  * list of materials
  * placement of the construction items

* UI:
  * Allow adjusting the properties by visual dragging of wall sides or manually setting the variables (width, height etc.).
  * Click a wall to select it, and then add one of the available sub-objects.
  * The sub-objects can be selected, and moved on the wall by dragging - or their properties can be adjusted (color, dimensions).
  * Allow 'see through' with shown construction items
  * Allow 'see through' for different floors, and to see behind outer walls
