import * as THREE from 'three'

// factory colorways baked into the glb as KHR_materials_variants
export const VARIANTS = [
  { name: 'Carmine Candy', swatch: '#8a1a24' },
  { name: 'Pearly Swirly', swatch: '#e8e6df' },
  { name: 'Torched Graphite', swatch: '#3a3d42' },
]

export const WHEEL_SPIN = 0.012 // rad/frame, hero idle-spin (fades out with scroll)

export const COCKPIT_KF = 3 // keyframe index where the left door is fully open
export const DOOR_MAX_ANGLE = -0.9 // rad, negative swings outward on its vertical hinge
export const ENGINE_KF = 4 // keyframe index where the hood is fully open
export const HOOD_MAX_ANGLE = 0.95 // rad, front-hinged clamshell tip

// One keyframe per panel; scroll interpolates between them.
export const KEYFRAMES = [
  { pos: new THREE.Vector3(4.6, 1.5, -4.6), look: new THREE.Vector3(0, 0.4, 0) },    // hero: front 3/4
  { pos: new THREE.Vector3(7.0, 0.95, 0.6), look: new THREE.Vector3(0, 0.55, 0.9) }, // design: profile, car pushed right
  { pos: new THREE.Vector3(-4.8, 1.05, 4.8), look: new THREE.Vector3(0, 0.45, 1.3) },// aero: rear 3/4, car pushed left
  { pos: new THREE.Vector3(0, 1.06, 0.85), look: new THREE.Vector3(0, 0.6, -1.2) },  // cockpit: driver eye to dash
  { pos: new THREE.Vector3(2.7, 3.9, 0.5), look: new THREE.Vector3(0.45, 0.2, -1.75) }, // performance: over the open engine bay
  { pos: new THREE.Vector3(0, 1.3, -6.4), look: new THREE.Vector3(0, 0.55, 0) },     // configure: head-on front
]

// Each subsystem: which meshes stay lit (keep), where the camera sits, whether
// the hood/door open, and the labeled hotspots anchored to real model nodes.
export const SUBSYSTEMS = [
  {
    id: 'powertrain',
    label: 'Powertrain',
    desc: 'Naturally aspirated V8, mounted up front.',
    keep: /Engine|Axle/,
    hood: true,
    cam: { pos: [2.4, 2.0, -3.9], look: [0, 0.5, -1.95] },
    hotspots: [
      { node: 'Engine', label: '4.5L V8', spec: '620 cv @ 9,000 rpm' },
      { node: 'Axles', label: 'Driveline', spec: '7-speed dual-clutch' },
    ],
  },
  {
    id: 'wheel',
    label: 'Wheel & brake',
    desc: 'Forged rim over a carbon-ceramic stack.',
    keep: /WheelFrontR/,
    cam: { pos: [3.0, 0.95, -2.55], look: [0.95, 0.4, -1.42] },
    // parts are concentric, so fan the callouts to distinct spots on the wheel
    hotspots: [
      { node: 'WheelFrontR', off: [0, 0.42, 0], label: 'Tyre', spec: '245/35 ZR20' },
      { node: 'WheelFrontRRim', off: [0.05, 0, 0], label: 'Forged rim', spec: '20-inch centre-lock' },
      { node: 'WheelFrontRBrakeDisc', off: [0, -0.4, 0], label: 'Disc', spec: 'Carbon-ceramic, 398 mm' },
      { node: 'WheelFrontRBrakePad', off: [0, 0, 0.42], label: 'Caliper', spec: '6-piston monobloc' },
    ],
  },
  {
    id: 'cockpit',
    label: 'Cockpit',
    desc: 'A single central seat, two set behind.',
    keep: /Interior/,
    door: true,
    cam: { pos: [-2.9, 1.6, 0.3], look: [0, 0.7, -0.75] },
    hotspots: [
      { node: 'InteriorSteeringWheel01', label: 'Steering', spec: 'Squared-off yoke' },
      { node: 'InteriorSeatsColor2', label: 'Driver seat', spec: 'Central position' },
      { node: 'InteriorPedalAccel', label: 'Pedals', spec: 'Machined alloy' },
      { node: 'InteriorDashMid', label: 'Cluster', spec: 'Driver-facing digital' },
    ],
  },
]
