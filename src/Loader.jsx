import { useProgress } from '@react-three/drei'
import { useStore } from './store'

export function Loader() {
  const { progress } = useProgress()
  const ready = useStore((s) => s.ready)
  return (
    <div id="loader" className={ready ? 'done' : ''} aria-hidden="true">
      <span className="loader-mark">APEX</span>
      <span className="loader-bar">
        <span className="loader-fill" style={{ width: `${ready ? 100 : progress}%` }} />
      </span>
    </div>
  )
}
