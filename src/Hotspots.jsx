import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useStore, view } from './store'
import { SUBSYSTEMS } from './constants'

const _v = new THREE.Vector3()

// HTML markers (dot + spec label) projected each frame from the world position
// of real model nodes. Rendered in the react-dom tree (not inside the Canvas),
// reading the live camera/scene from shared refs. Labels flip left near the
// right edge; hidden when behind the camera.
export function Hotspots() {
  const activeSubId = useStore((s) => s.activeSubId)
  const refs = useRef([])

  const sub = SUBSYSTEMS.find((s) => s.id === activeSubId)
  const markers = useMemo(() => {
    if (!sub || !view.scene) return []
    return sub.hotspots
      .map((h) => ({
        ...h,
        node: view.scene.getObjectByName(h.node),
        offv: h.off ? new THREE.Vector3(...h.off) : null,
      }))
      .filter((m) => m.node)
  }, [sub])

  useEffect(() => {
    if (!markers.length) return
    let raf
    const tick = () => {
      const cam = view.camera
      if (cam) {
        const w = window.innerWidth
        const h = window.innerHeight
        for (let i = 0; i < markers.length; i++) {
          const m = markers[i]
          const el = refs.current[i]
          if (!el) continue
          m.node.getWorldPosition(_v)
          if (m.offv) _v.add(m.offv)
          _v.project(cam)
          const behind = _v.z > 1
          const x = (_v.x * 0.5 + 0.5) * w
          const y = (-_v.y * 0.5 + 0.5) * h
          el.style.transform = `translate(${x}px, ${y}px)`
          el.style.opacity = behind ? '0' : '1'
          el.classList.toggle('flip', x > w * 0.62)
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [markers])

  if (!sub) return null

  return markers.map((m, idx) => (
    <div key={`${sub.id}-${idx}`} className="hotspot" ref={(el) => { refs.current[idx] = el }}>
      <span className="hs-dot" />
      <span className="hs-label"><b>{m.label}</b>{m.spec}</span>
    </div>
  ))
}
