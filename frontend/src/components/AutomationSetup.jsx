import React, { useEffect, useRef } from 'react'
import { ShieldCheck } from 'lucide-react'

export default function AutomationSetup({ onChoose, working }) {
  const dialog = useRef(null)
  useEffect(() => {
    dialog.current?.showModal()
    return () => dialog.current?.close()
  }, [])
  return (
    <dialog
      ref={dialog}
      className="automation-setup"
      aria-labelledby="setup-title"
      onCancel={(event) => event.preventDefault()}
    >
      <div className="setup-card">
        <ShieldCheck size={28} />
        <span className="eyebrow">ONE-TIME SETUP</span>
        <h2 id="setup-title">Make APPLE your assistant.</h2>
        <p>
          Trusted automation lets APPLE run the app actions and messages you request without asking
          each time. Stop is always available, and you can change this in Settings.
        </p>
        <p>Your Mac may separately ask for microphone or Accessibility access.</p>
        <button className="primary-button" disabled={working} onClick={() => onChoose(true)}>
          Enable trusted automation
        </button>
        <button className="subtle-button" disabled={working} onClick={() => onChoose(false)}>
          Keep individual confirmations
        </button>
      </div>
    </dialog>
  )
}
