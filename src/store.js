import { create } from 'zustand'

// Reactive UI state shared between the DOM overlay and the R3F canvas.
export const useStore = create((set) => ({
  ready: false,
  activeSubId: null, // null = scroll tour; otherwise the inspected subsystem id
  variant: 'Carmine Candy',
  setReady: (ready) => set({ ready }),
  openInspector: (id) => set({ activeSubId: id }),
  closeInspector: () => set({ activeSubId: null }),
  setVariant: (variant) => set({ variant }),
}))

// Scroll progress mutates every frame, so it lives outside React to avoid
// re-rendering the tree 60x/second. The scroll driver writes it; the camera
// rig reads it inside useFrame.
export const scroll = { progress: 0 }

// Live three objects shared with the DOM-side hotspots (which project model
// nodes to screen each frame but must render in the react-dom tree, not R3F's).
export const view = { camera: null, scene: null }
