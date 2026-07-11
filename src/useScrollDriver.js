import { useEffect } from 'react'
import Lenis from 'lenis'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { scroll } from './store'
import { KEYFRAMES as KF } from './constants'

gsap.registerPlugin(ScrollTrigger)

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

// count a stat value up from 0 when its section reveals
function countUp(dd) {
  const match = dd.textContent.match(/[\d,.]*\d/)
  if (!match) return
  const raw = match[0]
  const target = parseFloat(raw.replace(/,/g, ''))
  const decimals = (raw.split('.')[1] || '').length
  const grouped = raw.includes(',')
  const obj = { v: 0 }
  gsap.to(obj, {
    v: target,
    duration: 1.1,
    ease: 'power3.out',
    onUpdate: () => {
      let value = obj.v.toFixed(decimals)
      if (grouped) value = Number(value).toLocaleString('en-US', { minimumFractionDigits: decimals })
      dd.textContent = dd.textContent.replace(/[\d,.]*\d/, value)
    },
  })
}

// Lenis smooth scroll + a single ScrollTrigger that maps page scroll to the
// 0..(N-1) keyframe progress the camera rig consumes. Per-section triggers drive
// the CSS copy reveals and the stat count-up.
export function useScrollDriver() {
  useEffect(() => {
    const lenis = reducedMotion ? null : new Lenis({ lerp: 0.1, wheelMultiplier: 1 })

    if (lenis && import.meta.env.DEV) window.__lenis = lenis // dev: drive scroll from console
    if (lenis) {
      lenis.on('scroll', ScrollTrigger.update)
      const raf = (time) => lenis.raf(time * 1000)
      gsap.ticker.add(raf)
      gsap.ticker.lagSmoothing(0)
      var cleanupRaf = () => gsap.ticker.remove(raf)
    }

    const last = KF.length - 1
    const master = ScrollTrigger.create({
      trigger: document.documentElement,
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: (self) => { scroll.progress = self.progress * last },
    })

    // reveal each copy block and count its stats once
    const triggers = []
    document.querySelectorAll('.copy').forEach((el) => {
      triggers.push(ScrollTrigger.create({
        trigger: el,
        start: 'top 78%',
        onEnter: () => {
          el.classList.add('visible')
          if (!reducedMotion) el.querySelectorAll('.stat-row dd').forEach(countUp)
        },
        onLeaveBack: () => el.classList.remove('visible'),
      }))
    })

    return () => {
      master.kill()
      triggers.forEach((t) => t.kill())
      if (lenis) { cleanupRaf(); lenis.destroy() }
    }
  }, [])
}
