import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { useStore, scroll, view } from './store'
import { proximity } from './math'
import {
  SUBSYSTEMS, WHEEL_SPIN,
  COCKPIT_KF, DOOR_MAX_ANGLE, ENGINE_KF, HOOD_MAX_ANGLE,
} from './constants'

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

const GHOST_MAT = new THREE.MeshStandardMaterial({
  color: 0x0e1013, metalness: 0, roughness: 1,
  transparent: true, opacity: 0.06, depthWrite: false,
})

// full ancestor name path, so mesh_NN children inherit their parent's identity
const nameChain = (o) => { let s = '', p = o; while (p) { if (p.name) s += p.name + '/'; p = p.parent } return s }

export function Car() {
  const { scene, parser, userData } = useGLTF('/models/car.glb')
  const setReady = useStore((s) => s.setReady)
  const variant = useStore((s) => s.variant)
  const activeSubId = useStore((s) => s.activeSubId)

  // normalize once, and gather the nodes the animation touches. Guarded so it is
  // idempotent: the scene is a shared cached object and the scale math reads the
  // live bounds, so running it twice (StrictMode, remounts) would double-apply.
  const nodes = useMemo(() => {
    if (!scene.userData._normalized) {
      scene.rotation.y = Math.PI // nose towards -Z, matching the camera keyframes
      const box = new THREE.Box3().setFromObject(scene)
      const size = box.getSize(new THREE.Vector3())
      scene.scale.setScalar(4.5 / Math.max(size.x, size.z))
      box.setFromObject(scene)
      const center = box.getCenter(new THREE.Vector3())
      scene.position.set(-center.x, -box.min.y, -center.z)
      scene.userData._normalized = true
    }

    return {
      hood: scene.getObjectByName('BodyHood'),
      doorL: scene.getObjectByName('BodyDoorLColor1'),
      wheels: ['WheelFrontL', 'WheelFrontR', 'WheelRearL', 'WheelRearR']
        .map((n) => scene.getObjectByName(n)).filter(Boolean),
      variants: userData.gltfExtensions?.KHR_materials_variants?.variants ?? null,
    }
  }, [scene, userData])

  useEffect(() => { view.scene = scene; setReady(true) }, [scene, setReady])

  // ---- paint variant (KHR_materials_variants) ----
  useEffect(() => {
    if (!parser || !nodes.variants) return
    const index = nodes.variants.findIndex((v) => v.name === variant)
    if (index < 0) return
    let cancelled = false
    scene.traverse((object) => {
      if (!object.isMesh || !object.userData.gltfExtensions) return
      const def = object.userData.gltfExtensions.KHR_materials_variants
      if (!def) return
      const mapping = def.mappings.find((m) => m.variants.includes(index))
      if (mapping) {
        parser.getDependency('material', mapping.material).then((material) => {
          if (!cancelled) object.material = material
        })
      }
    })
    return () => { cancelled = true }
  }, [variant, parser, nodes, scene])

  // ---- inspector isolation: ghost every mesh not in the active subsystem ----
  useEffect(() => {
    const sub = SUBSYSTEMS.find((s) => s.id === activeSubId)
    scene.traverse((o) => {
      if (!o.isMesh) return
      if (sub && sub.keep.test(nameChain(o))) {
        if (o.userData._stash) { o.material = o.userData._stash; o.userData._stash = null }
      } else if (sub) {
        if (!o.userData._stash) { o.userData._stash = o.material; o.material = GHOST_MAT }
      } else if (o.userData._stash) {
        o.material = o.userData._stash; o.userData._stash = null
      }
    })
  }, [activeSubId, scene, variant])

  // ---- per-frame articulation: hood, door, wheel idle-spin ----
  const state = useRef({ hood: 0, door: 0 }).current
  useFrame(() => {
    const { hood, doorL, wheels } = nodes
    const activeSub = SUBSYSTEMS.find((s) => s.id === useStore.getState().activeSubId)
    const progress = scroll.progress
    let hoodTarget = 0
    let doorTarget = 0

    if (activeSub) {
      hoodTarget = activeSub.hood ? HOOD_MAX_ANGLE : 0
      doorTarget = activeSub.door ? DOOR_MAX_ANGLE : 0
    } else {
      hoodTarget = proximity(progress, ENGINE_KF, 1.8) * HOOD_MAX_ANGLE
      doorTarget = proximity(progress, COCKPIT_KF, 1.5) * DOOR_MAX_ANGLE
      if (!reducedMotion) {
        // wheels idle-spin in the hero, fading out with scroll. rotateX (about each
        // node's own local axle) not rotation.x: the front wheels carry a compound
        // baked rest rotation, so nudging euler.x tumbles them off-axis.
        const fade = Math.max(0, 1 - progress * 1.6)
        for (const w of wheels) w.rotateX(WHEEL_SPIN * fade)
      }
    }

    const rate = 0.08
    if (hood) { state.hood += (hoodTarget - state.hood) * rate; hood.rotation.x = state.hood }
    if (doorL) { state.door += (doorTarget - state.door) * rate; doorL.rotation.z = state.door }
  })

  return <primitive object={scene} />
}

useGLTF.preload('/models/car.glb')
