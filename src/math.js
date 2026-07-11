// smoothstep-eased lerp between a and b
export const smooth = (a, b, t) => a + (b - a) * (t * t * (3 - 2 * t))

// 0..1 smoothstep bump, peaks when progress == kf, width set by spread
export const proximity = (progress, kf, spread) => {
  const near = Math.max(0, 1 - Math.abs(progress - kf) * spread)
  return near * near * (3 - 2 * near)
}
