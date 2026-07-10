# APEX Stradale — Handoff

A single-page 3D car showroom. Vanilla Three.js + Vite, no framework, no React.
Scroll drives a cinematic camera through six views of a concept sports car —
including inside the cockpit (door opens) and over an open engine bay — plus a
paint configurator.

Live locally at `http://localhost:5173/` after `npm run dev`.

---

## Quick start

```bash
cd ~/Projects/apex-stradale
npm install        # only if node_modules is missing
npm run dev        # dev server on :5173
npm run build      # production build to dist/
npm run preview    # serve the built dist/ on :4173
```

No env vars, no backend, no API keys. Everything is static.

---

## Stack

| Thing        | Choice                                             |
|--------------|----------------------------------------------------|
| Bundler      | Vite 8 (`type: module`)                            |
| 3D           | Three.js ^0.185 (`three/addons` for loaders/env)   |
| Fonts        | Space Grotesk + Inter, via Google Fonts `<link>`   |
| Framework    | None. Three files do the whole site.               |

## Files

```
index.html      # all markup: nav, 6 <section> panels, loader, footer
src/style.css   # design tokens + layout + all CSS motion
src/main.js     # Three.js scene, scroll camera, articulation, configurator
public/models/car.glb   # the car (12 MB, see Model below)
```

That's it. `index.html` + `style.css` + `main.js`. If you're looking for a
build step, config, or component tree, there isn't one — that's intentional.

---

## The model

- **Khronos glTF-Sample-Assets "CarConcept"**, licensed **CC BY 4.0**
  (credited in the footer — keep the credit).
- Plain single-file GLB, 12 MB. **No Draco/KTX loaders needed** — don't add them
  back; an earlier version used a Draco Ferrari and it was swapped out.
- It ships with a **full modeled interior** (dash, steering wheel, seats, pedals,
  lit gauge cluster), a **modeled engine**, and **articulation pivots** on the
  hood and both doors. That's why the camera can go inside — the detail is
  really there.
- Three factory colorways are baked in as `KHR_materials_variants`
  (Carmine Candy / Pearly Swirly / Torched Graphite). The configurator switches
  between these variants; it does NOT tint a material.

At load, `main.js` auto-normalizes the model: scales it to ~4.5 m, grounds it on
Y=0, centers it, and rotates it 180° so the nose points -Z (matching the camera
keyframes). Don't hardcode positions assuming a specific model scale — the
normalization handles it.

If you ever deploy and 12 MB hurts: a ~3.5 MB KTX-BasisU-Draco variant of the
same model exists upstream in the Khronos repo. Switching to it means adding
`DRACOLoader` + `KTX2Loader` back.

---

## How the scroll works

The whole experience is one idea: **map scroll position to a path through
camera keyframes.**

- `KEYFRAMES` (main.js ~line 126) is an array of `{ pos, look }` — one camera
  position + look-at target per section, in document order.
- Each frame, `render()` computes `progress` = `scrollY / maxScroll * (N-1)`,
  a float from 0..5. It picks the two bracketing keyframes and smoothstep-lerps
  `pos`/`look` between them, then damps the camera toward that target (`lerp
  0.06`) so motion feels weighted, not linear.
- In the hero (progress ≈ 0) there's a gentle auto-orbit + pointer parallax that
  fades out as you scroll away.

**The six keyframes, in order:**

| # | Section     | View                                          |
|---|-------------|-----------------------------------------------|
| 0 | Hero        | front 3/4                                     |
| 1 | Design      | side profile (car pushed right of the copy)   |
| 2 | Aero        | rear 3/4 (car pushed left)                    |
| 3 | Cockpit     | inside, driver's eye to the dash              |
| 4 | Performance | above the open engine bay, looking down       |
| 5 | Configure   | head-on front                                 |

Keyframe index N corresponds to the Nth `<section>` in `index.html`. If you add
or reorder sections, keep `KEYFRAMES` and the section order in sync, and update
`COCKPIT_KF` / `ENGINE_KF` (below) if their indices move.

## Articulation (hood + door)

The hood and driver door open as their section comes into view — scroll-scrubbed
in both directions, not one-shot animations.

- One helper does both: `scrub(obj, axis, centerKf, maxAngle, spread)` in
  `render()`. It eases the rotation up as `progress` nears `centerKf` and back
  down as you leave.
- **Hood**: `BodyHood`, rotates `x` to `+0.95` rad near `ENGINE_KF` (4). Front-
  hinged clamshell.
- **Door**: `BodyDoorLColor1` (the whole left-door assembly — skin, glass,
  mirror, handles, interior panel are children), rotates `z` to `-0.9` rad near
  `COCKPIT_KF` (3). **The sign matters**: positive clips the door into the cabin;
  negative swings it outward. This was verified with bounding-box measurements,
  not by eye.

Constants live at main.js ~lines 66-69. To retune, change the angle or the
`spread` (higher spread = opens/closes over a shorter scroll distance).

---

## Component inspector

Beyond the scroll tour, there's an interactive **inspector** so the experience
isn't just "camera orbits a solid car." Click **Explore components** (bottom-left
pill, appears after load) to enter it.

In inspector mode:
- **Isolation**: every mesh NOT in the chosen subsystem is swapped to a shared
  faint `GHOST_MAT` (6% opacity, no depth write) — the rest of the car becomes an
  X-ray shell so the subsystem reads clearly. Original materials are stashed in
  `mesh.userData._stash` and restored on exit. (Swapping per-mesh avoids mutating
  shared materials, which several body panels reuse.)
- **Camera** frames the subsystem from a fixed pose with a slow reveal orbit.
- **Hotspots**: HTML markers (dot + spec label) are projected each frame from the
  world position of real model nodes via `camera.project()`. Labels flip to the
  left side near the right screen edge; markers hidden when behind the camera.
- The hood/door open if the subsystem calls for it (powertrain → hood, cockpit →
  door). Scroll is suppressed while active; **Esc** or **Close** exits.

Everything is driven by the `SUBSYSTEMS` array in main.js (~line 250):

```js
{
  id, label, desc,
  keep: /regex/,          // meshes whose ancestor-name-chain matches stay lit
  hood: true, door: true, // optional: open a panel
  cam: { pos:[x,y,z], look:[x,y,z] },
  hotspots: [{ node:'NodeName', off:[x,y,z]?, label, spec }],
}
```

The three subsystems: **Powertrain** (Engine + Axles, hood open), **Wheel &
brake** (one front corner — rim/disc/caliper/tyre; these are concentric so each
hotspot has an `off` world offset to fan the labels apart), **Cockpit**
(interior, door open). To add one, push another entry — the chip UI builds itself
from the array.

Hotspots anchor to **live node world positions** (not hardcoded coords), so they
stay correct regardless of the model normalization. `off` is an optional world-
space nudge for when several parts share a center.

## Debug tooling

Two URL params, both dev-only, both safe to leave in:

- **`?kf=N`** pins the camera to keyframe N. Fractional works (`?kf=2.6` sits
  mid-transition). In this mode the camera and articulation **snap** instead of
  lerping — needed because the headless-Chrome screenshot pipeline renders too
  few frames for damped motion to settle. Great for framing shots.
- **`&door=<radians>`** pins the left door to an exact angle. Used to find the
  correct hinge direction.
- **`?inspect=<id>`** opens the inspector on a subsystem at load (`powertrain` /
  `wheel` / `cockpit`) and snaps the camera (like `?kf`) for screenshots.

`window.APEX = { car }` is exposed after load — inspect node positions from the
devtools console, e.g.:

```js
APEX.car.getObjectByName('Engine').getWorldPosition(new THREE.Vector3())
```

### Screenshots (how views above were verified)

Playwright MCP screenshots time out under this laptop's software GL. What works
is a headless-Chrome one-shot (low-res to stay light on CPU):

```bash
google-chrome --headless=new --disable-gpu --use-gl=angle \
  --use-angle=swiftshader --window-size=800,500 --hide-scrollbars \
  --virtual-time-budget=15000 --screenshot=out.png \
  "http://localhost:5173/?kf=3"
```

Playwright's `run_code_unsafe` (evaluating JS in-page) DOES work for functional
checks — that's how the configurator and node positions were tested.

---

## Motion / polish

All CSS motion lives in `style.css` under a
`@media (prefers-reduced-motion: no-preference)` block. Reduced-motion users get
everything static and immediate — keep new animation inside that block.

- **Page entrance**: canvas fades up; hero kicker → masked headline lines
  ("STRA"/"DALE" slide up out of overflow-hidden wrappers) → lede → scroll cue,
  staggered. Triggered by `body.ready`, which `main.js` adds once the model
  loads.
- **Section reveals**: each `.copy` block's children stagger in via an
  IntersectionObserver toggling `.visible` (main.js ~line 240). An accent rule
  draws in beside each kicker.
- **Stat count-up**: numbers in `.stat-row dd` count up on first reveal
  (`countUp()`, main.js ~line 220). It preserves comma grouping ("1,395") and
  decimals ("2.9"), and skips text-only values ("Full width"). Reduced-motion
  skips it.
- **Micro**: nav underline sweep on hover; swatch selection ring scale-pop.

Everything animates only `transform`/`opacity` (compositor-friendly). Don't
animate width/height/top/left/margin here.

---

## Performance notes (this laptop spikes CPU)

- `renderer.setPixelRatio` is capped at **1.5** (not 2) on purpose — Ravi's
  laptop. Don't raise it without reason.
- Lighting is `RoomEnvironment` via PMREM (studio reflections, no HDR file to
  download) + ACES tone mapping. There's **no post-processing** and no real-time
  shadows — the "shadow" is a fake radial-gradient plane under the car. Keep it
  cheap.
- When running screenshot/build commands here, prefix with `nice -n 19` and use
  small window sizes. Kill stray `--headless` Chrome processes when done.

---

## Known limitations / TODO

- **Not a git repo yet.** `git init` when ready.
- **Not deployed.** It's a static site — any static host works (`dist/` after
  build). 12 MB model is the main payload; consider the compressed variant first.
- Camera keyframes were tuned via 800px screenshots. Framing is good but not
  pixel-perfect at every viewport — judge in a real browser and nudge the
  `KEYFRAMES` numbers (each is a one-line change) if a view feels off.
- No favicon (harmless 404 in console).
- Mobile: layout is responsive and the 3D works, but the keyframes were framed
  for desktop aspect ratios. Worth a pass if mobile matters.
- `main.js` build warns it's a >500 KB chunk — that's just Three.js bundled in;
  fine for this project, ignore or code-split if you care.

## Nice next steps (if asked)

- Slowly rotating wheels in the hero.
- Free-orbit (OrbitControls) on the Configure section so users can spin the car.
- Swap to the compressed model + add DRACOLoader/KTX2Loader before deploy.
- Real reserve/CTA flow (the button currently just anchors to the hero).
