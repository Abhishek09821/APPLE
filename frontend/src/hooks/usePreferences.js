import { useEffect, useState } from 'react'

export const colorThemes = [
  { id: 'blue', label: 'Blue', color: '#8fb8ef' },
  { id: 'graphite', label: 'Graphite', color: '#aeb6c1' },
  { id: 'violet', label: 'Violet', color: '#ba9cff' },
  { id: 'rose', label: 'Rose', color: '#eea0bc' },
  { id: 'amber', label: 'Amber', color: '#f1c477' },
  { id: 'mint', label: 'Mint', color: '#8ed8bb' },
]

export function usePreferences() {
  const [theme, setTheme] = useState(
    () =>
      (['dark', 'light'].includes(localStorage.getItem('apple-theme'))
        ? localStorage.getItem('apple-theme')
        : null) || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'),
  )
  const [palette, setPalette] = useState(() => {
    const saved = localStorage.getItem('apple-palette')
    return colorThemes.some(({ id }) => id === saved) ? saved : 'blue'
  })
  const [muted, setMuted] = useState(() => localStorage.getItem('apple-audio-muted') === 'true')
  const [sounds, setSounds] = useState(() => localStorage.getItem('apple-ui-sounds') === 'true')
  const [soundVolume, setSoundVolume] = useState(() =>
    Math.max(0, Math.min(1, Number(localStorage.getItem('apple-sound-volume') ?? 0.15) || 0)),
  )
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('apple-theme', theme)
  }, [theme])
  useEffect(() => {
    document.documentElement.dataset.palette = palette
    localStorage.setItem('apple-palette', palette)
  }, [palette])
  useEffect(() => {
    localStorage.setItem('apple-audio-muted', String(muted))
  }, [muted])
  useEffect(() => {
    localStorage.setItem('apple-ui-sounds', String(sounds))
  }, [sounds])
  useEffect(() => {
    localStorage.setItem('apple-sound-volume', String(soundVolume))
  }, [soundVolume])
  return {
    theme,
    setTheme,
    palette,
    setPalette,
    muted,
    setMuted,
    toggleTheme: () => setTheme((value) => (value === 'dark' ? 'light' : 'dark')),
    sounds,
    setSounds,
    soundVolume,
    setSoundVolume,
  }
}
