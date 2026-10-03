import { useCallback, useEffect, useRef, useState } from 'react'

export function useFloatingAssistant({ theme, palette, onClose, onError }) {
  const [floatingWindow, setFloatingWindow] = useState(null)
  const current = useRef(null),
    callbacks = useRef({ onClose, onError }),
    returning = useRef(false)
  callbacks.current = { onClose, onError }
  const supported = Boolean(window.documentPictureInPicture?.requestWindow)
  const open = useCallback(async () => {
    if (current.current && !current.current.closed) {
      current.current.focus()
      return
    }
    if (!window.documentPictureInPicture?.requestWindow) {
      callbacks.current.onError(
        'Floating assistant is available in desktop Chrome. Open APPLE in Chrome to keep it above other windows.',
      )
      return
    }
    try {
      // Must happen directly from a user gesture. Chrome remembers the position
      // selected by the user; we never move the window behind their back.
      const popup = await window.documentPictureInPicture.requestWindow({ width: 300, height: 390 })
      returning.current = false
      current.current = popup
      popup.document.title = 'APPLE companion'
      popup.document.documentElement.lang = 'en'
      for (const sheet of document.styleSheets) {
        try {
          // Reuse loaded styles immediately; opening the companion needs no
          // extra asset request and works even if the server just restarted.
          const copy = popup.document.createElement('style')
          copy.textContent = Array.from(sheet.cssRules, (rule) => rule.cssText).join('\n')
          popup.document.head.appendChild(copy)
        } catch {
          if (!sheet.href) continue
          const link = popup.document.createElement('link')
          link.rel = 'stylesheet'
          link.href = sheet.href
          popup.document.head.appendChild(link)
        }
      }
      popup.document.body.className = 'floating-body'
      popup.addEventListener(
        'pagehide',
        () => {
          if (current.current !== popup) return
          current.current = null
          setFloatingWindow(null)
          if (!returning.current) callbacks.current.onClose()
        },
        { once: true },
      )
      setFloatingWindow(popup)
    } catch (e) {
      callbacks.current.onError(`Could not open the floating assistant. ${e.message}`)
    }
  }, [])
  const close = useCallback((returnToApp = false) => {
    returning.current = returnToApp
    if (returnToApp) window.focus()
    current.current?.close()
  }, [])
  useEffect(() => {
    if (floatingWindow) {
      floatingWindow.document.documentElement.dataset.theme = theme
      floatingWindow.document.documentElement.dataset.palette = palette
    }
  }, [floatingWindow, theme, palette])
  useEffect(
    () => () => {
      const popup = current.current
      current.current = null
      popup?.close()
    },
    [],
  )
  return { floatingWindow, supported, open, close }
}
