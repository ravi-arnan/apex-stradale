import { useEffect } from 'react'
import { Loader } from './Loader'
import { Scene } from './Scene'
import { Hotspots } from './Hotspots'
import { useScrollDriver } from './useScrollDriver'
import { useStore } from './store'
import { VARIANTS, SUBSYSTEMS } from './constants'

function Configurator() {
  const variant = useStore((s) => s.variant)
  const setVariant = useStore((s) => s.setVariant)
  return (
    <>
      <div className="swatches" role="radiogroup" aria-label="Body color">
        {VARIANTS.map((c) => (
          <button
            key={c.name}
            className="swatch"
            type="button"
            role="radio"
            aria-checked={variant === c.name}
            aria-label={c.name}
            style={{ background: c.swatch }}
            onClick={() => setVariant(c.name)}
          />
        ))}
      </div>
      <p className="swatch-name">{variant}</p>
    </>
  )
}

function Inspector() {
  const activeSubId = useStore((s) => s.activeSubId)
  const openInspector = useStore((s) => s.openInspector)
  const closeInspector = useStore((s) => s.closeInspector)
  const active = SUBSYSTEMS.find((s) => s.id === activeSubId) || SUBSYSTEMS[0]

  return (
    <>
      <button
        id="inspect-toggle"
        type="button"
        aria-expanded={activeSubId != null}
        aria-controls="inspector"
        onClick={() => openInspector(activeSubId || 'powertrain')}
      >
        <span className="dot" aria-hidden="true" /> Explore components
      </button>

      <div id="inspector" aria-hidden={activeSubId == null} aria-label="Component inspector">
        <div id="hotspots"><Hotspots /></div>
        <div className="inspect-bar">
          <div className="inspect-meta">
            <p className="inspect-title">{active.label}</p>
            <p className="inspect-desc">{active.desc}</p>
          </div>
          <div className="inspect-chips" role="tablist">
            {SUBSYSTEMS.map((s) => (
              <button
                key={s.id}
                type="button"
                className="inspect-chip"
                role="tab"
                aria-selected={s.id === activeSubId}
                onClick={() => openInspector(s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>
          <button className="inspect-close" type="button" onClick={closeInspector}>Close</button>
        </div>
      </div>
    </>
  )
}

export default function App() {
  useScrollDriver()
  const ready = useStore((s) => s.ready)
  const activeSubId = useStore((s) => s.activeSubId)
  const closeInspector = useStore((s) => s.closeInspector)

  useEffect(() => { document.body.classList.toggle('ready', ready) }, [ready])
  useEffect(() => { document.body.classList.toggle('inspecting', activeSubId != null) }, [activeSubId])

  // Esc closes the inspector; block wheel scroll while it's open
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && useStore.getState().activeSubId) closeInspector() }
    const onWheel = (e) => { if (useStore.getState().activeSubId) e.preventDefault() }
    window.addEventListener('keydown', onKey)
    window.addEventListener('wheel', onWheel, { passive: false })
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('wheel', onWheel) }
  }, [closeInspector])

  return (
    <>
      <Loader />
      <Scene />

      <header className="nav">
        <span className="nav-mark">APEX</span>
        <nav aria-label="Main navigation">
          <a href="#design">Design</a>
          <a href="#aero">Aero</a>
          <a href="#cockpit">Cockpit</a>
          <a href="#performance">Performance</a>
          <a href="#configure">Configure</a>
        </nav>
      </header>

      <main>
        <section className="panel panel-hero" id="hero" aria-labelledby="hero-heading">
          <p className="kicker">Series 9. Front mid-engine V8.</p>
          <h1 id="hero-heading">
            <span className="line"><span>STRA</span></span>
            <span className="line"><span>DALE</span></span>
          </h1>
          <p className="lede">Sculpted by wind. Held to the road by 620 horses.</p>
          <div className="scroll-cue" aria-hidden="true"><span />Scroll</div>
        </section>

        <section className="panel panel-left" id="design" aria-labelledby="design-heading">
          <div className="copy">
            <p className="kicker">01 / Design</p>
            <h2 id="design-heading">A silhouette drawn<br />at 300 km/h</h2>
            <p>Every line begins in the wind tunnel. The carbon monocoque weighs
              less than its own shadow, and the body above it exists for one
              reason: to keep air exactly where the engineers want it.</p>
            <dl className="stat-row">
              <div><dt>Dry weight</dt><dd>1,395 kg</dd></div>
              <div><dt>Downforce</dt><dd>360 kg @ 250</dd></div>
              <div><dt>Drag coeff.</dt><dd>0.33 Cd</dd></div>
            </dl>
          </div>
        </section>

        <section className="panel panel-right" id="aero" aria-labelledby="aero-heading">
          <div className="copy">
            <p className="kicker">02 / Aerodynamics</p>
            <h2 id="aero-heading">The air leaves<br />through the back</h2>
            <p>What the nose gathers, the tail resolves. A full width diffuser
              and a single blade of taillight finish the bodywork the wind
              started. Nothing decorates. Everything works.</p>
            <dl className="stat-row">
              <div><dt>Diffuser</dt><dd>Full width</dd></div>
              <div><dt>Spoiler</dt><dd>Active</dd></div>
              <div><dt>Exhaust</dt><dd>Center exit</dd></div>
            </dl>
          </div>
        </section>

        <section className="panel panel-left" id="cockpit" aria-labelledby="cockpit-heading">
          <div className="copy">
            <p className="kicker">03 / Cockpit</p>
            <h2 id="cockpit-heading">You sit in<br />the center</h2>
            <p>A central driving position, flanked by two passenger seats set
              just behind. Every control falls to hand, every sightline converges
              on the road. The car disappears around you.</p>
          </div>
        </section>

        <section className="panel panel-right" id="performance" aria-labelledby="perf-heading">
          <div className="copy">
            <p className="kicker">04 / Performance</p>
            <h2 id="perf-heading">Numbers that<br />need no adjectives</h2>
            <p>Under that long hood: a naturally aspirated 4.5 litre V8 revving
              to 9,000 rpm, bolted to a seven-speed dual-clutch that shifts faster
              than you can blink.</p>
            <dl className="stat-row">
              <div><dt>Power</dt><dd>620 cv</dd></div>
              <div><dt>0 to 100</dt><dd>2.9 s</dd></div>
              <div><dt>Top speed</dt><dd>340 km/h</dd></div>
            </dl>
          </div>
        </section>

        <section className="panel panel-center" id="configure" aria-labelledby="config-heading">
          <div className="copy">
            <p className="kicker">05 / Configure</p>
            <h2 id="config-heading">Choose your finish</h2>
            <Configurator />
            <a className="cta" href="#hero">Reserve yours</a>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <span>APEX Automobili. A fictional marque.</span>
        <span>Model: Car Concept, Khronos Group glTF Sample Assets (CC BY 4.0)</span>
      </footer>

      <Inspector />
    </>
  )
}
