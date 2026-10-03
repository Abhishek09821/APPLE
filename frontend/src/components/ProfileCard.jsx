import React, { useEffect, useState } from 'react'
import { ArrowRight } from 'lucide-react'

export default function ProfileCard({ profile, onSave, onTour }) {
  const [name, setName] = useState(profile?.name || '')
  const [working, setWorking] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  useEffect(() => setName(profile?.name || ''), [profile?.name])
  async function save(event) {
    event.preventDefault()
    setWorking(true)
    setError('')
    setMessage('')
    try {
      await onSave({ name: name.trim(), tutorial_completed: profile?.tutorial_completed ?? true })
      setMessage('Your name is saved. APPLE will use it in future conversations.')
    } catch (e) {
      setError(e.message)
    } finally {
      setWorking(false)
    }
  }
  return (
    <section className="settings-card profile-card">
      <h3>A name to remember</h3>
      <p>
        This Mac has one shared workspace. Your name personalizes conversations; it isn’t an account
        or a password.
      </p>
      <form onSubmit={save}>
        <label htmlFor="profile-name">
          Your name
          <input
            id="profile-name"
            autoComplete="given-name"
            maxLength={60}
            required
            value={name}
            onChange={(event) => {
              setName(event.target.value)
              setMessage('')
            }}
          />
        </label>
        <button
          className="secondary-button"
          disabled={working || !name.trim() || name.trim() === profile?.name}
        >
          {working ? 'Saving…' : 'Save name'}
        </button>
      </form>
      {message && <p role="status">{message}</p>}
      {error && (
        <p className="danger-text" role="alert">
          {error}
        </p>
      )}
      <div className="profile-tour">
        <div>
          <strong>Need a quick walkthrough?</strong>
          <p>Save WhatsApp contacts and learn your way around the library.</p>
        </div>
        <button className="secondary-button" onClick={onTour}>
          Replay welcome tour
          <ArrowRight size={15} />
        </button>
      </div>
    </section>
  )
}
