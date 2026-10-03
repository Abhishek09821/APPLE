import React, { useEffect } from 'react'
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'motion/react'
import './ambient-field.css'

export default function AmbientField({ audioLevel }) {
  const reduced = useReducedMotion()
  const pointerX = useMotionValue(0.5)
  const pointerY = useMotionValue(0.42)
  const x = useSpring(pointerX, { stiffness: 65, damping: 24 })
  const y = useSpring(pointerY, { stiffness: 65, damping: 24 })
  const fallbackLevel = useMotionValue(0)
  const level = useTransform(audioLevel || fallbackLevel, (value) =>
    Math.min(1, Math.max(0, Number(value) || 0)),
  )
  const energy = useSpring(level, { stiffness: 180, damping: 27 })
  const pointerLeft = useTransform(x, (value) => `${value * 100}%`)
  const pointerTop = useTransform(y, (value) => `${value * 100}%`)
  const fieldX = useTransform(x, [0, 1], reduced ? [0, 0] : [-12, 12])
  const fieldY = useTransform(y, [0, 1], reduced ? [0, 0] : [-8, 8])
  const auraX = useTransform(x, [0, 1], reduced ? [0, 0] : [24, -24])
  const auraY = useTransform(y, [0, 1], reduced ? [0, 0] : [18, -18])
  const auraScale = useTransform(energy, [0, 1], reduced ? [1, 1] : [1, 1.12])
  const auraOpacity = useTransform(energy, [0, 1], [0.5, 0.9])

  useEffect(() => {
    if (reduced) {
      pointerX.set(0.5)
      pointerY.set(0.42)
      return
    }
    const track = (event) => {
      if (event.pointerType === 'touch') return
      pointerX.set(event.clientX / Math.max(window.innerWidth, 1))
      pointerY.set(event.clientY / Math.max(window.innerHeight, 1))
    }
    const reset = (event) => {
      if (event.relatedTarget) return
      pointerX.set(0.5)
      pointerY.set(0.42)
    }
    window.addEventListener('pointermove', track, { passive: true })
    window.addEventListener('pointerout', reset, { passive: true })
    return () => {
      window.removeEventListener('pointermove', track)
      window.removeEventListener('pointerout', reset)
    }
  }, [pointerX, pointerY, reduced])

  return (
    <motion.div
      className="ambient-field"
      aria-hidden="true"
      style={{ '--pointer-x': pointerLeft, '--pointer-y': pointerTop, '--field-energy': energy }}
    >
      <motion.div
        className="ambient-aurora"
        style={{ x: auraX, y: auraY, scale: auraScale, opacity: auraOpacity }}
      />
      <motion.div className="ambient-dots" style={{ x: fieldX, y: fieldY }} />
      <div className="ambient-pointer-light" />
      <div className="ambient-horizon" />
      <div className="ambient-vignette" />
    </motion.div>
  )
}
