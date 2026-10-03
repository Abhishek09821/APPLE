import { useEffect, useState } from 'react'

export function usePreferences() {
  const [theme, setTheme] = useState(
    () =>
      (['dark', 'light'].includes(localStorage.getItem('apple-theme'))
        ? localStorage.getItem('apple-theme')
        : null) || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'),
  )
  const [sounds, setSounds] = useState(() => localStorage.getItem('apple-ui-sounds') === 'true')
  const [soundVolume, setSoundVolume] = useState(() =>
    Math.max(0, Math.min(1, Number(localStorage.getItem('apple-sound-volume') ?? 0.15) || 0)),
  )
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('apple-theme', theme)
  }, [theme])
  useEffect(() => {
    localStorage.setItem('apple-ui-sounds', String(sounds))
  }, [sounds])
  useEffect(() => {
    localStorage.setItem('apple-sound-volume', String(soundVolume))
  }, [soundVolume])
  return {
    theme,
    setTheme,
    toggleTheme: () => setTheme((value) => (value === 'dark' ? 'light' : 'dark')),
    sounds,
    setSounds,
    soundVolume,
    setSoundVolume,
  }
}
