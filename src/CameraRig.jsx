import { useEffect, useRef } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import * as THREE from 'three'
import { useStore, scroll, view } from './store'
import { smooth } from './math'
import { KEYFRAMES, SUBSYSTEMS } from './constants'

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const ORBIT_OK = window.matchMedia('(pointer: fine)').matches
const UP = new THREE.Vector3(0, 1, 0)

export function CameraRig() {
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)

  const rig = useRef({
    camPos: KEYFRAMES[0].pos.clone(),
    camLook: KEYFRAMES[0].look.clone(),
    targetPos: new THREE.Vector3(),
    targetLook: new THREE.Vector3(),
    pointerX: 0,
    orbiting: false,
    controls: null,
  }).current

  // free-orbit on the Configure view (mouse only, so touch scroll isn't trapped)
  useEffect(() => {
    const controls = new OrbitControls(camera, gl.domElement)
    controls.enableDamping = true
    controls.enablePan = false
    controls.enableZoom = false // let the wheel keep scrolling the page
    controls.rotateSpeed = 0.55
    controls.minPolarAngle = 0.15
    controls.maxPolarAngle = Math.PI * 0.52 // don't dip under the floor
    controls.target.set(0, 0.55, 0)
    controls.enabled = false
    rig.controls = controls
    view.camera = camera // share with the DOM-side hotspots

    const onMove = (e) => { rig.pointerX = (e.clientX / window.innerWidth) * 2 - 1 }
    window.addEventListener('pointermove', onMove)
    return () => { controls.dispose(); window.removeEventListener('pointermove', onMove) }
  }, [camera, gl, rig])

  useFrame((s) => {
    const t = s.clock.getElapsedTime()
    const { camPos, camLook, targetPos, targetLook, controls } = rig
    const activeSub = SUBSYSTEMS.find((sub) => sub.id === useStore.getState().activeSubId)

    if (activeSub) {
      if (rig.orbiting) { controls.enabled = false; rig.orbiting = false }
      // inspector: fixed pose framing the subsystem (no sweep — it swung into bad angles)
      const c = activeSub.cam
      targetLook.set(c.look[0], c.look[1], c.look[2])
      targetPos.set(c.pos[0], c.pos[1], c.pos[2])
    } else {
      const progress = scroll.progress
      const i = Math.min(Math.floor(progress), KEYFRAMES.length - 2)
      const f = progress - i
      const a = KEYFRAMES[i], b = KEYFRAMES[i + 1]

      targetPos.set(smooth(a.pos.x, b.pos.x, f), smooth(a.pos.y, b.pos.y, f), smooth(a.pos.z, b.pos.z, f))
      targetLook.set(smooth(a.look.x, b.look.x, f), smooth(a.look.y, b.look.y, f), smooth(a.look.z, b.look.z, f))

      // gentle orbit + pointer parallax in the hero, fading out with scroll
      if (!reducedMotion) {
        const fade = Math.max(0, 1 - progress * 1.6)
        const angle = (Math.sin(t * 0.18) * 0.35 + rig.pointerX * 0.12) * fade
        targetPos.applyAxisAngle(UP, angle)
      }

      // hand off to OrbitControls once the path has settled on the Configure view.
      // Wait for the damped camera to converge on the last keyframe (not just for
      // scroll to cross a threshold) so the takeover is seamless — no snap.
      const last = KEYFRAMES[KEYFRAMES.length - 1]
      if (ORBIT_OK && !rig.orbiting && progress > 4.9 && camera.position.distanceTo(last.pos) < 0.15) {
        controls.target.copy(last.look)
        controls.enabled = true
        controls.update()
        rig.orbiting = true
      } else if (rig.orbiting && progress < 4.8) {
        controls.enabled = false
        rig.orbiting = false
        camPos.copy(camera.position)
        camLook.copy(controls.target)
      }
    }

    if (rig.orbiting) {
      controls.update()
    } else {
      camPos.lerp(targetPos, 0.06)
      camLook.lerp(targetLook, 0.06)
      camera.position.copy(camPos)
      camera.lookAt(camLook)
    }
  })

  return null
}
