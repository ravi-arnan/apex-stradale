import { Component, Suspense, useEffect, useMemo } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { Car } from './Car'
import { Powertrain } from './Powertrain'
import { CameraRig } from './CameraRig'
import { useStore } from './store'
import { KEYFRAMES } from './constants'

// A failed useGLTF throws inside the Canvas, which R3F renders in its own
// reconciler root. Boundaries out in the DOM tree cannot see that, so without
// this the car silently never appears and the loader sits there for ever.
// Drop the model, flag the store, and let App show a message instead.
class ModelBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error) {
    console.error('car.glb failed to load', error)
    useStore.getState().failLoad()
  }
  render() { return this.state.failed ? null : this.props.children }
}

// PMREM-baked RoomEnvironment, matching the original vanilla lighting.
function RoomEnv() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl)
    const env = pmrem.fromScene(new RoomEnvironment()).texture
    scene.environment = env
    return () => { env.dispose(); pmrem.dispose() }
  }, [gl, scene])
  return null
}

// soft contact shadow: black plane, radial alpha falloff
function ContactShadow() {
  const tex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 128
    const ctx = c.getContext('2d')
    const g = ctx.createRadialGradient(64, 64, 8, 64, 64, 64)
    g.addColorStop(0, 'rgba(0,0,0,0.75)')
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 128, 128)
    return new THREE.CanvasTexture(c)
  }, [])
  // R3F disposes the geometry and material it created for us, but not this
  useEffect(() => () => tex.dispose(), [tex])
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={0.01} renderOrder={2}>
      <planeGeometry args={[6.5, 3.2]} />
      <meshBasicMaterial map={tex} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  )
}

export function Scene() {
  return (
    <Canvas
      className="stage"
      style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh' }}
      dpr={[1, 1.5]}
      gl={{ antialias: true }}
      camera={{ fov: 38, near: 0.1, far: 100, position: KEYFRAMES[0].pos.toArray() }}
      onCreated={({ gl }) => { gl.toneMappingExposure = 0.85 }}
    >
      <color attach="background" args={[0x131316]} />
      <fog attach="fog" args={[0x131316, 12, 42]} />
      <RoomEnv />
      <gridHelper args={[120, 60, 0x2a2a30, 0x1c1c21]} />
      <CameraRig />
      <ModelBoundary>
        <Suspense fallback={null}>
          <Car />
          <Powertrain />
          <ContactShadow />
        </Suspense>
      </ModelBoundary>
    </Canvas>
  )
}
