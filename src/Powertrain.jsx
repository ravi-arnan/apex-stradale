import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { useStore, view } from './store'
import { REDUCED_MOTION } from './constants'

// A procedural, modern naturally-aspirated V8 + 7-speed dual-clutch transaxle,
// stood in for the crude low-poly "Engine" box baked into car.glb. Rendered only
// while the powertrain subsystem is isolated (Car.jsx hides the original box).
// It auto-fits to the real Engine node's world bounds. In "exploded" mode each
// major component fans out along its assembly axis with a floating label, and the
// internals (crankshaft + pistons/rods) turn over so you can see how the V8 works.

const deg = THREE.MathUtils.degToRad

// --- shared materials (immutable, built once) --------------------------------
const M = {
  block:   new THREE.MeshStandardMaterial({ color: 0x82868b, metalness: 0.96, roughness: 0.46 }),
  head:    new THREE.MeshStandardMaterial({ color: 0x9aa0a6, metalness: 0.95, roughness: 0.4 }),
  carbon:  new THREE.MeshStandardMaterial({ color: 0x0d0e11, metalness: 0.45, roughness: 0.28 }),
  carbonM: new THREE.MeshStandardMaterial({ color: 0x16181c, metalness: 0.3,  roughness: 0.55 }),
  red:     new THREE.MeshStandardMaterial({ color: 0x9c1622, metalness: 0.85, roughness: 0.33 }),
  chrome:  new THREE.MeshStandardMaterial({ color: 0xe4e8ec, metalness: 1,    roughness: 0.12 }),
  steel:   new THREE.MeshStandardMaterial({ color: 0xb9bec4, metalness: 1,    roughness: 0.24 }),
  titan:   new THREE.MeshStandardMaterial({ color: 0x8d9095, metalness: 1,    roughness: 0.34 }),
  gearbox: new THREE.MeshStandardMaterial({ color: 0x84888d, metalness: 0.9,  roughness: 0.52 }),
  bolt:    new THREE.MeshStandardMaterial({ color: 0x2f3236, metalness: 1,    roughness: 0.3 }),
}

const ZC = [-0.66, -0.22, 0.22, 0.66] // per-cylinder longitudinal stations
const BANK = deg(22) // half V-angle

// intake runner: central carbon airbox -> sweep out and down into each head
const runnerCurve = (sx, z) => new THREE.CatmullRomCurve3([
  new THREE.Vector3(sx * 0.06, 0.62, z),
  new THREE.Vector3(sx * 0.2, 0.56, z),
  new THREE.Vector3(sx * 0.3, 0.44, z),
  new THREE.Vector3(sx * 0.26, 0.34, z),
])
const RUNNERS = [-1, 1].flatMap((sx) => ZC.map((z) => ({ sx, z, curve: runnerCurve(sx, z) })))

// exhaust runner: head outer face -> arc out and down -> per-bank collector
const headerCurve = (sx, z) => new THREE.CatmullRomCurve3([
  new THREE.Vector3(sx * 0.34, 0.14, z),
  new THREE.Vector3(sx * 0.5, 0.0, z),
  new THREE.Vector3(sx * 0.54, -0.24, z * 0.45 + 0.28),
  new THREE.Vector3(sx * 0.5, -0.34, 0.5),
])
const collectorCurve = (sx) => new THREE.CatmullRomCurve3([
  new THREE.Vector3(sx * 0.5, -0.34, 0.5),
  new THREE.Vector3(sx * 0.42, -0.4, 0.85),
  new THREE.Vector3(sx * 0.34, -0.42, 1.15),
])

// world bounds of the Engine node, ignoring visibility (the box gets hidden)
function nodeBounds(node) {
  const box = new THREE.Box3()
  node.updateWorldMatrix(true, true)
  node.traverse((o) => {
    if (!o.geometry) return
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox()
    box.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld))
  })
  return box
}

// ---- component sub-renderers (assembled local space) ------------------------

function Block() {
  return (
    <group>
      <mesh position={[0, -0.05, 0]} material={M.block}>
        <boxGeometry args={[0.72, 0.6, 1.6]} />
      </mesh>
      {[-1, 1].flatMap((sx) =>
        [-0.5, -0.17, 0.17, 0.5].map((z) => (
          <mesh key={`${sx}${z}`} position={[sx * 0.37, -0.05, z]} material={M.block}>
            <boxGeometry args={[0.03, 0.5, 0.06]} />
          </mesh>
        )),
      )}
      <mesh position={[0, -0.44, 0.05]} material={M.block}>
        <boxGeometry args={[0.54, 0.3, 1.34]} />
      </mesh>
      <mesh position={[0, 0.28, 0]} material={M.head}>
        <boxGeometry args={[0.42, 0.2, 1.56]} />
      </mesh>
    </group>
  )
}

function Head({ sx }) {
  return (
    <group rotation-z={sx * BANK}>
      <mesh position={[sx * 0.26, 0.17, 0]} material={M.head}>
        <boxGeometry args={[0.28, 0.26, 1.56]} />
      </mesh>
      <mesh position={[sx * 0.28, 0.33, 0]} material={M.carbon}>
        <boxGeometry args={[0.24, 0.12, 1.5]} />
      </mesh>
      {/* camshaft peeking under the cover */}
      <mesh position={[sx * 0.28, 0.26, 0]} rotation-x={Math.PI / 2} material={M.steel}>
        <cylinderGeometry args={[0.035, 0.035, 1.5, 16]} />
      </mesh>
      {[-0.62, -0.31, 0, 0.31, 0.62].map((z) => (
        <mesh key={z} position={[sx * 0.28, 0.4, z]} rotation-x={Math.PI / 2} material={M.bolt}>
          <cylinderGeometry args={[0.018, 0.018, 0.04, 6]} />
        </mesh>
      ))}
      {ZC.map((z) => (
        <mesh key={z} position={[sx * 0.24, 0.34, z]} rotation-z={sx * deg(30)} material={M.titan}>
          <cylinderGeometry args={[0.05, 0.05, 0.1, 16]} />
        </mesh>
      ))}
    </group>
  )
}

function Intake() {
  return (
    <group>
      <mesh position={[0, 0.62, 0.02]} rotation-x={Math.PI / 2} material={M.carbon}>
        <cylinderGeometry args={[0.17, 0.17, 1.42, 32]} />
      </mesh>
      <mesh position={[0, 0.5, 0.02]} material={M.carbon}>
        <boxGeometry args={[0.3, 0.16, 1.42]} />
      </mesh>
      <mesh position={[0, 0.62, -0.72]} rotation-x={Math.PI / 2} material={M.chrome}>
        <torusGeometry args={[0.15, 0.028, 12, 32]} />
      </mesh>
      <mesh position={[0, 0.62, -0.7]} rotation-x={Math.PI / 2} material={M.carbonM}>
        <cylinderGeometry args={[0.14, 0.14, 0.05, 32]} />
      </mesh>
      <mesh position={[0, 0.79, 0.02]} material={M.red}>
        <boxGeometry args={[0.08, 0.03, 1.3]} />
      </mesh>
      {RUNNERS.map(({ sx, z, curve }) => (
        <mesh key={`${sx}${z}`} material={M.red}>
          <tubeGeometry args={[curve, 28, 0.033, 12, false]} />
        </mesh>
      ))}
    </group>
  )
}

function HeaderBank({ sx }) {
  return (
    <group>
      {ZC.map((z) => (
        <mesh key={z} material={M.chrome}>
          <tubeGeometry args={[headerCurve(sx, z), 40, 0.03, 10, false]} />
        </mesh>
      ))}
      <mesh material={M.chrome}>
        <tubeGeometry args={[collectorCurve(sx), 30, 0.065, 12, false]} />
      </mesh>
    </group>
  )
}

// crankshaft: main shaft + counterweight lobes + offset rod journals. crankRef
// spins the whole thing about its own (Z) axis in exploded mode.
function Crankshaft({ crankRef }) {
  return (
    <group ref={crankRef} position={[0, -0.05, 0]}>
      <mesh rotation-x={Math.PI / 2} material={M.steel}>
        <cylinderGeometry args={[0.045, 0.045, 1.62, 20]} />
      </mesh>
      {ZC.map((z, i) => {
        const a = i * Math.PI // flat-plane: pins at 0 / 180
        return (
          <group key={z} position={[0, 0, z]}>
            {/* counterweights either side of the throw */}
            {[-0.08, 0.08].map((dz) => (
              <mesh key={dz} position={[0, 0, dz]} rotation-x={Math.PI / 2} material={M.steel}>
                <cylinderGeometry args={[0.14, 0.14, 0.05, 24, 1, false, 0, Math.PI]} />
              </mesh>
            ))}
            {/* rod journal pin, offset from the axis */}
            <mesh position={[Math.sin(a) * 0.11, -Math.cos(a) * 0.11, 0]} rotation-x={Math.PI / 2} material={M.bolt}>
              <cylinderGeometry args={[0.05, 0.05, 0.14, 16]} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}

// 8 pistons + rods, in the V. pistonRefs bob each slug along its bank axis.
function Pistons({ pistonRefs }) {
  let idx = 0
  return (
    <group>
      {[-1, 1].flatMap((sx) =>
        ZC.map((z) => {
          const i = idx++
          return (
            <group key={`${sx}${z}`} position={[0, -0.05, z]} rotation-z={sx * BANK}>
              <group ref={(el) => { if (el) pistonRefs.current[i] = { el, sx } }} position={[0, 0.22, 0]}>
                <mesh material={M.steel}>
                  <cylinderGeometry args={[0.1, 0.1, 0.16, 24]} />
                </mesh>
                {[0.04, -0.02].map((y) => (
                  <mesh key={y} position={[0, y, 0]} rotation-x={Math.PI / 2} material={M.chrome}>
                    <torusGeometry args={[0.1, 0.008, 8, 24]} />
                  </mesh>
                ))}
                {/* connecting rod */}
                <mesh position={[0, -0.19, 0]} material={M.titan}>
                  <boxGeometry args={[0.05, 0.26, 0.09]} />
                </mesh>
                <mesh position={[0, -0.33, 0]} rotation-x={Math.PI / 2} material={M.bolt}>
                  <cylinderGeometry args={[0.055, 0.055, 0.1, 16]} />
                </mesh>
              </group>
            </group>
          )
        }),
      )}
    </group>
  )
}

function Flywheel() {
  return (
    <group position={[0, -0.05, 0.82]}>
      <mesh rotation-x={Math.PI / 2} material={M.steel}>
        <cylinderGeometry args={[0.33, 0.33, 0.06, 40]} />
      </mesh>
      {/* ring-gear teeth, concentric with the disc (the group already carries
          the flywheel's offset, so these are pure local radius) */}
      {Array.from({ length: 48 }).map((_, i) => {
        const a = (i / 48) * Math.PI * 2
        return (
          <mesh key={i} position={[Math.cos(a) * 0.34, Math.sin(a) * 0.34, 0]} material={M.steel}>
            <boxGeometry args={[0.02, 0.02, 0.05]} />
          </mesh>
        )
      })}
      {/* twin clutch discs */}
      {[0.06, 0.11].map((z) => (
        <mesh key={z} position={[0, 0, z]} rotation-x={Math.PI / 2} material={M.bolt}>
          <cylinderGeometry args={[0.26, 0.26, 0.03, 32]} />
        </mesh>
      ))}
    </group>
  )
}

function Gearbox() {
  const fins = []
  for (let i = 0; i < 11; i++) fins.push(1.15 + i * 0.052)
  return (
    <group>
      <mesh position={[0, -0.02, 0.96]} rotation-x={Math.PI / 2} material={M.gearbox}>
        <cylinderGeometry args={[0.42, 0.33, 0.24, 28]} />
      </mesh>
      <mesh position={[0, -0.02, 1.05]} rotation-x={Math.PI / 2} material={M.gearbox}>
        <cylinderGeometry args={[0.43, 0.43, 0.14, 32]} />
      </mesh>
      <mesh position={[0, 0.3, 1.05]} rotation-x={Math.PI / 2} material={M.carbon}>
        <cylinderGeometry args={[0.2, 0.2, 0.16, 20, 1, false, 0, Math.PI]} />
      </mesh>
      {Array.from({ length: 14 }).map((_, i) => {
        const a = (i / 14) * Math.PI * 2
        return (
          <mesh key={i} position={[Math.cos(a) * 0.4, -0.02 + Math.sin(a) * 0.4, 1.05]} rotation-x={Math.PI / 2} material={M.bolt}>
            <cylinderGeometry args={[0.018, 0.018, 0.16, 6]} />
          </mesh>
        )
      })}
      {[-0.22, 0.22].map((x) => (
        <mesh key={x} position={[x, 0.34, 1.04]} rotation-x={Math.PI / 2} material={M.titan}>
          <cylinderGeometry args={[0.06, 0.06, 0.22, 16]} />
        </mesh>
      ))}
      <mesh position={[0, -0.04, 1.44]} rotation-x={Math.PI / 2} material={M.gearbox}>
        <cylinderGeometry args={[0.3, 0.3, 0.66, 28]} />
      </mesh>
      {fins.map((z) => (
        <mesh key={z} position={[0, -0.04, z]} rotation-x={Math.PI / 2} material={M.gearbox}>
          <cylinderGeometry args={[0.34, 0.34, 0.016, 28]} />
        </mesh>
      ))}
      <mesh position={[0.18, 0.18, 1.44]} material={M.titan}>
        <boxGeometry args={[0.14, 0.16, 0.4]} />
      </mesh>
      <mesh position={[0, -0.04, 1.88]} rotation-x={Math.PI / 2} material={M.bolt}>
        <cylinderGeometry args={[0.05, 0.05, 0.3, 16]} />
      </mesh>
    </group>
  )
}

function Accessories({ fanRef }) {
  return (
    <group>
      <mesh position={[0, 0.02, -0.86]} material={M.carbon}>
        <boxGeometry args={[0.54, 0.7, 0.14]} />
      </mesh>
      <mesh position={[0, -0.14, -0.96]} rotation-x={Math.PI / 2} material={M.bolt}>
        <cylinderGeometry args={[0.17, 0.17, 0.12, 28]} />
      </mesh>
      <mesh position={[0, -0.14, -1.03]} rotation-x={Math.PI / 2} material={M.chrome}>
        <cylinderGeometry args={[0.08, 0.08, 0.06, 20]} />
      </mesh>
      <mesh position={[0, 0.05, -0.98]} rotation-x={Math.PI / 2} material={M.carbonM}>
        <torusGeometry args={[0.22, 0.022, 8, 32]} />
      </mesh>
      <group ref={fanRef} position={[0, 0.05, -1.1]}>
        <mesh rotation-x={Math.PI / 2} material={M.bolt}>
          <cylinderGeometry args={[0.06, 0.06, 0.04, 12]} />
        </mesh>
        {Array.from({ length: 9 }).map((_, i) => {
          const a = (i / 9) * Math.PI * 2
          return (
            <mesh key={i} position={[Math.cos(a) * 0.16, Math.sin(a) * 0.16, 0]} rotation-z={a} material={M.carbonM}>
              <boxGeometry args={[0.18, 0.055, 0.014]} />
            </mesh>
          )
        })}
      </group>
    </group>
  )
}

// ---- exploded-view component registry ---------------------------------------
// key -> { label, spec, offset (explode vector), anchor (label position), node }
const PARTS = [
  { key: 'intake',   label: 'Carbon airbox',  spec: 'Variable-length runners', offset: [0, 1.35, 0],      anchor: [0, 0.82, 0],    node: () => <Intake /> },
  { key: 'headL',    label: 'Cylinder head',  spec: 'DOHC, 4 valves / cyl',    offset: [-1.15, 0.55, 0],  anchor: [-0.34, 0.42, -0.7], node: () => <Head sx={-1} /> },
  { key: 'headR',    label: 'Cylinder head',  spec: 'Titanium valves',         offset: [1.15, 0.55, 0],   anchor: [0.34, 0.42, -0.7],  node: () => <Head sx={1} /> },
  { key: 'pistons',  label: 'Pistons & rods', spec: 'Forged, 88 mm bore',      offset: [0, 0.55, -1.0],   anchor: [0, 0.4, 0.66],   node: null },
  { key: 'crank',    label: 'Crankshaft',     spec: 'Flat-plane, forged',      offset: [0, -1.15, 0],     anchor: [0, -0.05, 0.72], node: null },
  { key: 'block',    label: 'Aluminium block', spec: '90° V8 · 4.5 L',         offset: [0, 0, 0],         anchor: [0.62, -0.32, 0.35], node: () => <Block /> },
  { key: 'headersL', label: 'Exhaust headers', spec: 'Equal-length, Inconel',  offset: [-1.05, -0.7, 0.35], anchor: [-0.62, -0.55, -0.15], node: () => <HeaderBank sx={-1} /> },
  { key: 'headersR', label: 'Exhaust headers', spec: 'Center exit, Ti tips',   offset: [1.05, -0.7, 0.35], anchor: [0.5, -0.3, -0.5], node: () => <HeaderBank sx={1} /> },
  { key: 'flywheel', label: 'Flywheel',       spec: 'Twin-plate clutch',       offset: [0, -0.25, 0.75],  anchor: [0, 0.52, 0.82],   node: null },
  { key: 'gearbox',  label: '7-speed DCT',    spec: 'Rear transaxle',          offset: [0, 0.1, 1.55],    anchor: [0, 0.34, 1.44],  node: () => <Gearbox /> },
  { key: 'front',    label: 'Accessory drive', spec: 'Cam & ancillary belt',   offset: [0, 0.2, -1.35],   anchor: [0, 0.32, -0.95], node: null },
]

function PartLabel({ label, spec }) {
  return (
    <Html center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }} occlude={false}>
      <div style={{
        whiteSpace: 'nowrap', transform: 'translate(12px, -50%)',
        padding: '0.28rem 0.55rem', background: 'oklch(14% 0.01 260 / 0.8)',
        backdropFilter: 'blur(6px)', borderLeft: '2px solid var(--accent)',
        fontSize: '0.58rem', letterSpacing: '0.03em', lineHeight: 1.35,
        color: 'var(--text-dim)', fontFamily: 'var(--font-body)',
      }}>
        <b style={{
          display: 'block', color: 'var(--text)', fontFamily: 'var(--font-display)',
          fontWeight: 500, letterSpacing: '0.09em', textTransform: 'uppercase', fontSize: '0.58rem',
        }}>{label}</b>
        {spec}
      </div>
    </Html>
  )
}

const LOCAL_MAX = 3.2 // longest local extent (front accessories -> transaxle tail)
const _off = new THREE.Vector3()

export function Powertrain() {
  const ready = useStore((s) => s.ready)
  const exploded = useStore((s) => s.exploded)
  const rootRef = useRef()
  const fanRef = useRef()
  const crankRef = useRef()
  const pistonRefs = useRef([])
  const groupRefs = useRef({})
  const innerRef = useRef()
  const anim = useRef({ t: 0, turn: 0 }).current

  // the Engine node is static once the model is normalized, so fit just once
  const fit = useMemo(() => {
    if (!ready || !view.scene) return null
    const node = view.scene.getObjectByName('Engine')
    if (!node) return null
    const box = nodeBounds(node)
    if (box.isEmpty()) return null
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    const k = (0.92 * Math.max(size.x, size.y, size.z)) / LOCAL_MAX
    const yaw = size.x > size.z ? Math.PI / 2 : 0
    return { center, k, yaw }
  }, [ready])

  useFrame((_, dt) => {
    // only draw when the engine is exposed (Car.jsx sets the shared signal)
    if (rootRef.current) rootRef.current.visible = view.engineExposed
    // ease the explode factor toward its target and drive each component out.
    // Reduced motion still gets the breakdown, it just arrives without the fan-out.
    const target = exploded ? 1 : 0
    anim.t = REDUCED_MOTION ? target : anim.t + (target - anim.t) * Math.min(1, dt * 6)
    for (const p of PARTS) {
      const g = groupRefs.current[p.key]
      if (g) g.position.copy(_off.set(p.offset[0], p.offset[1], p.offset[2])).multiplyScalar(anim.t)
    }
    // pull back a touch as it opens up so the spread stays in frame
    if (innerRef.current) innerRef.current.scale.setScalar(1 - 0.24 * anim.t)

    // everything below turns on its own, with no user input driving it
    if (REDUCED_MOTION) return

    // turn the bottom end over so the V8 reads as "working" once it's opened up
    if (anim.t > 0.02) {
      anim.turn += dt * 1.6 * anim.t
      if (crankRef.current) crankRef.current.rotation.z = anim.turn
      for (const pr of pistonRefs.current) {
        if (pr?.el) pr.el.position.y = 0.22 + Math.sin(anim.turn + (pr.sx > 0 ? Math.PI : 0)) * 0.06 * anim.t
      }
    }
    if (fanRef.current) fanRef.current.rotation.z += dt * 3.6 // was 0.06/frame, i.e. 60 Hz only
  })

  if (!fit) return null
  return (
    <group ref={rootRef} visible={false} position={fit.center} scale={fit.k}>
      <group ref={innerRef} rotation-y={fit.yaw} position={[0, -0.05, -0.3]}>
        {PARTS.map((p) => (
          <group key={p.key} ref={(el) => { if (el) groupRefs.current[p.key] = el }}>
            {p.key === 'pistons' ? <Pistons pistonRefs={pistonRefs} />
              : p.key === 'crank' ? <Crankshaft crankRef={crankRef} />
              : p.key === 'flywheel' ? <Flywheel />
              : p.key === 'front' ? <Accessories fanRef={fanRef} />
              : p.node()}
            {exploded && (
              <group position={p.anchor}>
                <PartLabel label={p.label} spec={p.spec} />
              </group>
            )}
          </group>
        ))}
      </group>
    </group>
  )
}
