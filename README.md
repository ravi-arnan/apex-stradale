# APEX Stradale S9

A scroll-driven WebGL microsite for a fictional concept sports car. Scrolling moves a cinematic camera through six framed views of the car, including a look inside the cockpit with the door open and a top-down pass over the open engine bay, followed by an interactive component inspector and a paint configurator.

Built with React Three Fiber, GSAP ScrollTrigger, and Lenis on top of Three.js and Vite. No backend.

**Live demo:** [apex-stradale.vercel.app](https://apex-stradale.vercel.app)

## Highlights

- **Scroll-driven camera.** Scroll position maps to a path through six camera keyframes, smoothstep interpolated and damped for weighted, cinematic motion.
- **Articulated model.** The hood and driver door open as their section enters view, scrubbed in both directions rather than played as one-shot animations.
- **Component inspector.** An interactive mode that isolates a subsystem (powertrain, wheel and brake, cockpit) by ghosting the rest of the car, with HTML hotspots projected onto real model nodes each frame.
- **Paint configurator.** Three factory colorways baked into the model as `KHR_materials_variants`, switched at runtime.
- **Zero configuration.** No environment variables, no API keys, no backend. It builds to a static bundle with Vite defaults.

## Tech stack

| Area      | Choice                                              |
| --------- | --------------------------------------------------- |
| Framework | React 19                                            |
| 3D        | React Three Fiber and drei, over Three.js 0.185     |
| Scroll    | GSAP ScrollTrigger for progress, Lenis for smoothing |
| State     | Zustand for UI state, plain refs for per-frame data |
| Bundler   | Vite 8                                              |
| Fonts     | Space Grotesk and Inter via Google Fonts            |

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
index.html             React root
src/main.jsx           app entry
src/App.jsx            DOM overlay: nav, six section panels, footer, inspector UI
src/Scene.jsx          R3F Canvas: environment, grid, contact shadow
src/Car.jsx            model load, normalize, articulation, variants, isolation
src/CameraRig.jsx      scroll camera interpolation and OrbitControls handoff
src/Hotspots.jsx       inspector labels projected onto model nodes
src/useScrollDriver.js Lenis smooth scroll plus GSAP ScrollTrigger progress
src/constants.js       keyframes, subsystems, colorways, tuning values
src/store.js           Zustand UI state and shared per-frame refs
src/style.css          design tokens, layout, and CSS motion
public/models/car.glb  the car model (GLB, ~12 MB)
```

## How the scroll works

Lenis drives smooth scrolling and a GSAP ScrollTrigger maps page scroll to a `progress` value, a float from 0 to 5. Each frame the camera rig picks the two bracketing keyframes, smoothstep interpolates the camera position and look-at target between them, then damps the camera toward that target so motion feels weighted rather than linear.

| # | Section     | View                                        |
| - | ----------- | ------------------------------------------- |
| 0 | Hero        | front three-quarter                         |
| 1 | Design      | side profile                                |
| 2 | Aero        | rear three-quarter                          |
| 3 | Cockpit     | inside, driver eye to the dash              |
| 4 | Performance | above the open engine bay, looking down     |
| 5 | Configure   | head-on front, with free orbit on the car   |

## Deployment

Deployed on Vercel as a static build. Vercel auto-detects Vite, runs `npm run build`, and serves `dist/`. No environment variables are required. Pushes to the default branch redeploy automatically once the Git integration is connected.

## Model and credits

The car is the Khronos glTF Sample Assets "CarConcept", licensed under CC BY 4.0. The credit is displayed in the site footer and must be preserved. The model ships with a fully modeled interior, a modeled engine, and articulation pivots on the hood and doors, which is why the camera can move inside the cabin.

## License

Application code is available under the MIT License. The 3D model is licensed separately under CC BY 4.0 by the Khronos Group.
