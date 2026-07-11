import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

// ---------- renderer / scene ----------
const canvas = document.getElementById('stage')
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 0.85

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x131316)
scene.fog = new THREE.Fog(0x131316, 12, 42)
scene.environment = new THREE.PMREMGenerator(renderer)
  .fromScene(new RoomEnvironment()).texture

const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 100)

// free-orbit on the Configure section (mouse only, so touch scroll isn't trapped)
const ORBIT_OK = window.matchMedia('(pointer: fine)').matches
const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true
controls.enablePan = false
controls.enableZoom = false // let the wheel keep scrolling the page
controls.rotateSpeed = 0.55
controls.minPolarAngle = 0.15
controls.maxPolarAngle = Math.PI * 0.52 // don't dip under the floor
controls.target.set(0, 0.55, 0)
controls.enabled = false
let orbiting = false

// ---------- floor ----------
const grid = new THREE.GridHelper(120, 60, 0x2a2a30, 0x1c1c21)
scene.add(grid)

// soft contact shadow: black plane, radial alpha falloff
const shadowCanvas = document.createElement('canvas')
shadowCanvas.width = shadowCanvas.height = 128
const ctx = shadowCanvas.getContext('2d')
const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 64)
grad.addColorStop(0, 'rgba(0,0,0,0.75)')
grad.addColorStop(1, 'rgba(0,0,0,0)')
ctx.fillStyle = grad
ctx.fillRect(0, 0, 128, 128)
const shadow = new THREE.Mesh(
  new THREE.PlaneGeometry(6.5, 3.2),
  new THREE.MeshBasicMaterial({
    map: new THREE.CanvasTexture(shadowCanvas),
    transparent: true, depthWrite: false, toneMapped: false,
  })
)
shadow.rotation.x = -Math.PI / 2
shadow.position.y = 0.01
shadow.renderOrder = 2

// ---------- car ----------
// factory colorways baked into the glb as KHR_materials_variants
const VARIANTS = [
  { name: 'Carmine Candy', swatch: '#8a1a24' },
  { name: 'Pearly Swirly', swatch: '#e8e6df' },
  { name: 'Torched Graphite', swatch: '#3a3d42' },
]

const car = new THREE.Group()
scene.add(car)

const loaderEl = document.getElementById('loader')
const loaderFill = document.getElementById('loader-fill')

let gltfParser = null
let variantsDef = null
let hood = null
let doorL = null
let wheels = []
let modelReady = false

const WHEEL_SPIN = 0.012 // rad/frame, hero idle-spin (fades out with scroll)

const COCKPIT_KF = 3 // keyframe index where the left door is fully open
const DOOR_MAX_ANGLE = -0.9 // rad, negative swings outward on its vertical hinge
const ENGINE_KF = 4 // keyframe index where the hood is fully open
const HOOD_MAX_ANGLE = 0.95 // rad, front-hinged clamshell tip

new GLTFLoader().load(
  '/models/car.glb',
  (gltf) => {
    const model = gltf.scene
    model.rotation.y = Math.PI // nose towards -Z, matching the camera keyframes

    // normalize: length 4.5m, grounded, centered
    const box = new THREE.Box3().setFromObject(model)
    const size = box.getSize(new THREE.Vector3())
    model.scale.setScalar(4.5 / Math.max(size.x, size.z))
    box.setFromObject(model)
    const center = box.getCenter(new THREE.Vector3())
    model.position.set(-center.x, -box.min.y, -center.z)

    gltfParser = gltf.parser
    variantsDef = gltf.userData.gltfExtensions?.KHR_materials_variants?.variants ?? null

    car.add(model)
    car.add(shadow)
    hood = model.getObjectByName('BodyHood')
    doorL = model.getObjectByName('BodyDoorLColor1')
    wheels = ['WheelFrontL', 'WheelFrontR', 'WheelRearL', 'WheelRearR']
      .map((n) => model.getObjectByName(n)).filter(Boolean)
    window.APEX = { car, controls } // dev: inspect node positions from the console
    modelReady = true
    loaderEl.classList.add('done')
    document.body.classList.add('ready')
    if (DEBUG_INSPECT) openInspector(DEBUG_INSPECT)
  },
  (e) => { loaderFill.style.width = `${(e.loaded / e.total) * 100}%` },
  (err) => {
    console.error('Model failed to load', err)
    loaderEl.classList.add('done')
    document.body.classList.add('ready')
  }
)

async function selectVariant(variantName) {
  if (!gltfParser || !variantsDef) return
  const index = variantsDef.findIndex((v) => v.name === variantName)
  if (index < 0) return
  const pending = []
  car.traverse((object) => {
    if (!object.isMesh || !object.userData.gltfExtensions) return
    const def = object.userData.gltfExtensions.KHR_materials_variants
    if (!def) return
    const mapping = def.mappings.find((m) => m.variants.includes(index))
    if (mapping) {
      pending.push(
        gltfParser.getDependency('material', mapping.material)
          .then((material) => { object.material = material })
      )
    }
  })
  await Promise.all(pending)
}

// ---------- scroll-driven camera ----------
// One keyframe per panel; scroll interpolates between them.
const KEYFRAMES = [
  { pos: new THREE.Vector3(4.6, 1.5, -4.6), look: new THREE.Vector3(0, 0.4, 0) },   // hero: front 3/4
  { pos: new THREE.Vector3(7.0, 0.95, 0.6), look: new THREE.Vector3(0, 0.55, 0.9) }, // design: profile, car pushed right
  { pos: new THREE.Vector3(-4.8, 1.05, 4.8), look: new THREE.Vector3(0, 0.45, 1.3) }, // aero: rear 3/4, car pushed left
  { pos: new THREE.Vector3(0, 1.06, 0.85), look: new THREE.Vector3(0, 0.6, -1.2) },  // cockpit: driver eye to dash
  { pos: new THREE.Vector3(2.7, 3.9, 0.5), look: new THREE.Vector3(0.45, 0.2, -1.75) }, // performance: over the windshield into the open engine bay
  { pos: new THREE.Vector3(0, 1.3, -6.4), look: new THREE.Vector3(0, 0.55, 0) },  // configure: head-on front
]

const smooth = (a, b, t) => a + (b - a) * (t * t * (3 - 2 * t)) // smoothstep lerp
// 0..1 smoothstep bump, peaks when progress == kf
const proximity = (progress, kf, spread) => {
  const near = Math.max(0, 1 - Math.abs(progress - kf) * spread)
  return near * near * (3 - 2 * near)
}

// dev: ?kf=N pins the camera to keyframe N; ?inspect=<id> opens a subsystem
const urlParams = new URLSearchParams(location.search)
const kfParam = urlParams.get('kf')
const DEBUG_KF = kfParam === null ? null : Math.min(Number(kfParam), KEYFRAMES.length - 1)
const DEBUG_DOOR = urlParams.has('door') // dev: pin the left door open
const DEBUG_INSPECT = urlParams.get('inspect')
const SNAP = DEBUG_KF !== null || DEBUG_INSPECT !== null // no damping, for screenshots

const camPos = KEYFRAMES[0].pos.clone()
const camLook = KEYFRAMES[0].look.clone()
const targetPos = new THREE.Vector3()
const targetLook = new THREE.Vector3()

const UP = new THREE.Vector3(0, 1, 0)
let pointerX = 0
window.addEventListener('pointermove', (e) => {
  pointerX = (e.clientX / window.innerWidth) * 2 - 1
})

// ---------- component inspector ----------
// Each subsystem: which meshes stay lit (keep), where the camera sits, whether
// the hood/door open, and the labeled hotspots anchored to real model nodes.
const SUBSYSTEMS = [
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

const GHOST_MAT = new THREE.MeshStandardMaterial({
  color: 0x0e1013, metalness: 0, roughness: 1,
  transparent: true, opacity: 0.06, depthWrite: false,
})

let activeSub = null
let markers = []
const _hs = new THREE.Vector3()

// full ancestor name path, so mesh_NN children inherit their parent's identity
const nameChain = (o) => { let s = '', p = o; while (p) { if (p.name) s += p.name + '/'; p = p.parent } return s }

function applyIsolation(keep) {
  car.traverse((o) => {
    if (!o.isMesh) return
    if (keep.test(nameChain(o))) {
      if (o.userData._stash) { o.material = o.userData._stash; o.userData._stash = null }
    } else if (!o.userData._stash) {
      o.userData._stash = o.material
      o.material = GHOST_MAT
    }
  })
}
function clearIsolation() {
  car.traverse((o) => {
    if (o.isMesh && o.userData._stash) { o.material = o.userData._stash; o.userData._stash = null }
  })
}

function buildHotspots(sub) {
  const wrap = document.getElementById('hotspots')
  wrap.innerHTML = ''
  markers = sub.hotspots.map((h) => {
    const node = car.getObjectByName(h.node)
    if (!node) return null
    const el = document.createElement('div')
    el.className = 'hotspot'
    el.innerHTML = `<span class="hs-dot"></span><span class="hs-label"><b>${h.label}</b>${h.spec}</span>`
    wrap.appendChild(el)
    return { el, node, off: h.off ? new THREE.Vector3(...h.off) : null }
  }).filter(Boolean)
}
function updateHotspots() {
  for (const m of markers) {
    m.node.getWorldPosition(_hs)
    if (m.off) _hs.add(m.off)
    _hs.project(camera)
    const behind = _hs.z > 1
    const x = (_hs.x * 0.5 + 0.5) * window.innerWidth
    const y = (-_hs.y * 0.5 + 0.5) * window.innerHeight
    m.el.style.transform = `translate(${x}px, ${y}px)`
    m.el.style.opacity = behind ? '0' : '1'
    m.el.classList.toggle('flip', x > window.innerWidth * 0.62)
  }
}

function selectSub(id) {
  const sub = SUBSYSTEMS.find((s) => s.id === id)
  if (!sub) return
  activeSub = sub
  clearIsolation()
  applyIsolation(sub.keep)
  buildHotspots(sub)
  document.querySelector('.inspect-title').textContent = sub.label
  document.querySelector('.inspect-desc').textContent = sub.desc
  document.querySelectorAll('.inspect-chip').forEach((c) =>
    c.setAttribute('aria-selected', c.dataset.id === id ? 'true' : 'false'))
}
function openInspector(id) {
  if (!modelReady) return
  document.body.classList.add('inspecting')
  document.getElementById('inspector').setAttribute('aria-hidden', 'false')
  document.getElementById('inspect-toggle').setAttribute('aria-expanded', 'true')
  selectSub(id)
}
function exitInspector() {
  activeSub = null
  clearIsolation()
  document.getElementById('hotspots').innerHTML = ''
  markers = []
  document.body.classList.remove('inspecting')
  document.getElementById('inspector').setAttribute('aria-hidden', 'true')
  document.getElementById('inspect-toggle').setAttribute('aria-expanded', 'false')
}

function render() {
  const t = performance.now() / 1000
  let hoodTarget = 0
  let doorTarget = 0

  if (activeSub) {
    if (orbiting) { controls.enabled = false; orbiting = false }
    // inspector: fixed pose framing the subsystem (no sweep — it swung into bad angles)
    const c = activeSub.cam
    targetLook.set(c.look[0], c.look[1], c.look[2])
    targetPos.set(c.pos[0], c.pos[1], c.pos[2])
    hoodTarget = activeSub.hood ? HOOD_MAX_ANGLE : 0
    doorTarget = activeSub.door ? DOOR_MAX_ANGLE : 0
  } else {
    // scroll: interpolate the camera along the keyframe path
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight
    const progress = DEBUG_KF !== null
      ? DEBUG_KF
      : maxScroll > 0 ? (window.scrollY / maxScroll) * (KEYFRAMES.length - 1) : 0
    const i = Math.min(Math.floor(progress), KEYFRAMES.length - 2)
    const f = progress - i
    const a = KEYFRAMES[i], b = KEYFRAMES[i + 1]

    targetPos.set(smooth(a.pos.x, b.pos.x, f), smooth(a.pos.y, b.pos.y, f), smooth(a.pos.z, b.pos.z, f))
    targetLook.set(smooth(a.look.x, b.look.x, f), smooth(a.look.y, b.look.y, f), smooth(a.look.z, b.look.z, f))

    // gentle orbit + pointer parallax in the hero, fading out with scroll
    if (!reducedMotion) {
      const fade = Math.max(0, 1 - progress * 1.6)
      const angle = (Math.sin(t * 0.18) * 0.35 + pointerX * 0.12) * fade
      targetPos.applyAxisAngle(UP, angle)
      // wheels idle-spin in the hero, tied to the same fade.
      // rotateX (about each node's own local axle) not rotation.x: the front
      // wheels carry a compound baked rest rotation, so nudging the euler.x
      // component tumbles them off-axis instead of spinning them.
      for (const w of wheels) w.rotateX(WHEEL_SPIN * fade)
    }

    // panels articulate as their keyframe approaches (scroll-scrubbed)
    hoodTarget = proximity(progress, ENGINE_KF, 1.8) * HOOD_MAX_ANGLE
    doorTarget = proximity(progress, COCKPIT_KF, 1.5) * DOOR_MAX_ANGLE

    // hand the camera to OrbitControls once the scroll path has actually settled
    // on the Configure view. Wait for the damped camera to converge on the last
    // keyframe (not just for the scroll to cross a threshold) so the takeover is
    // seamless — no snap. Hysteresis on progress releases it when scrolling back up.
    const last = KEYFRAMES[KEYFRAMES.length - 1]
    const canOrbit = ORBIT_OK && DEBUG_KF === null
    if (canOrbit && !orbiting && progress > 4.9 && camera.position.distanceTo(last.pos) < 0.15) {
      controls.target.copy(last.look)
      controls.enabled = true
      controls.update() // camera is already at KF5, so this changes nothing visually
      orbiting = true
    } else if (orbiting && progress < 4.8) {
      controls.enabled = false
      orbiting = false
      camPos.copy(camera.position) // resume the keyframe path from here
      camLook.copy(controls.target)
    }
  }

  const rate = SNAP ? 1 : 0.08
  if (hood) hood.rotation.x += (hoodTarget - hood.rotation.x) * rate
  if (doorL) doorL.rotation.z += (doorTarget - doorL.rotation.z) * rate
  if (DEBUG_DOOR && doorL) doorL.rotation.z = Number(urlParams.get('door')) || 0

  if (orbiting) {
    controls.update()
  } else {
    const damp = SNAP ? 1 : 0.06
    camPos.lerp(targetPos, damp)
    camLook.lerp(targetLook, damp)
    camera.position.copy(camPos)
    camera.lookAt(camLook)
  }

  if (activeSub) updateHotspots()

  renderer.render(scene, camera)
}
renderer.setAnimationLoop(render)

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})

// ---------- copy reveal + stat count-up ----------
function countUp(dd) {
  const match = dd.textContent.match(/[\d,.]*\d/)
  if (!match) return
  const raw = match[0]
  const target = parseFloat(raw.replace(/,/g, ''))
  const decimals = (raw.split('.')[1] || '').length
  const grouped = raw.includes(',')
  const start = performance.now()
  const DURATION = 1100
  const tick = (now) => {
    const k = Math.min((now - start) / DURATION, 1)
    const eased = 1 - (1 - k) ** 3
    let value = (target * eased).toFixed(decimals)
    if (grouped) value = Number(value).toLocaleString('en-US', { minimumFractionDigits: decimals })
    dd.textContent = dd.textContent.replace(/[\d,.]*\d/, value)
    if (k < 1) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

const observer = new IntersectionObserver(
  (entries) => entries.forEach((e) => {
    e.target.classList.toggle('visible', e.isIntersecting)
    if (e.isIntersecting && !reducedMotion && !e.target.dataset.counted) {
      e.target.dataset.counted = 'true'
      e.target.querySelectorAll('.stat-row dd').forEach(countUp)
    }
  }),
  { threshold: 0.35 }
)
document.querySelectorAll('.copy').forEach((el) => observer.observe(el))

// ---------- configurator ----------
const swatchWrap = document.getElementById('swatches')
const swatchName = document.getElementById('swatch-name')
VARIANTS.forEach((c, idx) => {
  const btn = document.createElement('button')
  btn.className = 'swatch'
  btn.type = 'button'
  btn.role = 'radio'
  btn.setAttribute('aria-checked', idx === 0 ? 'true' : 'false')
  btn.setAttribute('aria-label', c.name)
  btn.style.background = c.swatch
  btn.addEventListener('click', () => {
    selectVariant(c.name)
    swatchName.textContent = c.name
    swatchWrap.querySelectorAll('.swatch').forEach((s) => s.setAttribute('aria-checked', 'false'))
    btn.setAttribute('aria-checked', 'true')
  })
  swatchWrap.appendChild(btn)
})

// ---------- inspector UI ----------
const chipsWrap = document.getElementById('inspect-chips')
SUBSYSTEMS.forEach((s) => {
  const chip = document.createElement('button')
  chip.type = 'button'
  chip.className = 'inspect-chip'
  chip.dataset.id = s.id
  chip.textContent = s.label
  chip.setAttribute('role', 'tab')
  chip.setAttribute('aria-selected', 'false')
  chip.addEventListener('click', () => selectSub(s.id))
  chipsWrap.appendChild(chip)
})
document.getElementById('inspect-toggle').addEventListener('click', () => openInspector(activeSub?.id || 'powertrain'))
document.getElementById('inspect-close').addEventListener('click', exitInspector)
window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && activeSub) exitInspector() })
window.addEventListener('wheel', (e) => { if (activeSub) e.preventDefault() }, { passive: false })
