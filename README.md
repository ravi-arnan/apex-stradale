# APEX Stradale S9

A scroll-driven WebGL microsite for a fictional concept sports car. Scrolling moves a cinematic camera through six framed views of the car, including a look inside the cockpit with the door open and a top-down pass over the open engine bay, followed by an interactive component inspector and a paint configurator.

Built with vanilla Three.js and Vite. No framework, no React, no backend.

## Highlights

- **Scroll-driven camera.** Scroll position maps to a path through six camera keyframes, smoothstep interpolated and damped for weighted, cinematic motion.
- **Articulated model.** The hood and driver door open as their section enters view, scrubbed in both directions rather than played as one-shot animations.
- **Component inspector.** An interactive mode that isolates a subsystem (powertrain, wheel and brake, cockpit) by ghosting the rest of the car, with HTML hotspots projected onto real model nodes each frame.
- **Paint configurator.** Three factory colorways baked into the model as `KHR_materials_variants`, switched at runtime.
- **Zero configuration.** No environment variables, no API keys, no build config beyond Vite defaults. The entire site is three files.

## Tech stack

| Area      | Choice                                         |
| --------- | ---------------------------------------------- |
| Bundler   | Vite 8                                          |
| 3D        | Three.js 0.185 (`three/addons` for loaders/env) |
| Fonts     | Space Grotesk and Inter via Google Fonts        |
| Framework | None                                           |

## Getting started

Requires Node.js 18 or newer.

```bash
npm install        # install dependencies
npm run dev        # start the dev server on http://localhost:5173
npm run build      # produce a production build in dist/
npm run preview    # serve the production build on http://localhost:4173
```

## Project structure

```
index.html            markup: nav, six section panels, loader, footer
src/style.css         design tokens, layout, and CSS motion
src/main.js           Three.js scene, scroll camera, articulation, configurator
public/models/car.glb the car model (GLB, ~12 MB)
```

## How the scroll works

Each frame, the render loop computes a `progress` value from scroll position, a float from 0 to 5. It picks the two bracketing keyframes, smoothstep interpolates the camera position and look-at target between them, then damps the camera toward that target so motion feels weighted rather than linear.

| # | Section     | View                                        |
| - | ----------- | ------------------------------------------- |
| 0 | Hero        | front three-quarter                         |
| 1 | Design      | side profile                                |
| 2 | Aero        | rear three-quarter                          |
| 3 | Cockpit     | inside, driver eye to the dash              |
| 4 | Performance | above the open engine bay, looking down     |
| 5 | Configure   | head-on front, with free orbit on the car   |

## Model and credits

The car is the Khronos glTF Sample Assets "CarConcept", licensed under CC BY 4.0. The credit is displayed in the site footer and must be preserved. The model ships with a fully modeled interior, a modeled engine, and articulation pivots on the hood and doors, which is why the camera can move inside the cabin.

## License

Application code is available under the MIT License. The 3D model is licensed separately under CC BY 4.0 by the Khronos Group.
