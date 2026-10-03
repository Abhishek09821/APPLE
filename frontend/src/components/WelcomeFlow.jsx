import React, { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, BookOpen, MessageCircle, Check } from 'lucide-react'

export default function WelcomeFlow({ profile, onSave, onFinish }) {
  const dialog = useRef(null)
  const heading = useRef(null)
  const [step, setStep] = useState(profile?.name ? 1 : 0)
  const [name, setName] = useState(profile?.name || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    const node = dialog.current
    node.showModal()
    return () => node.close()
  }, [])
  useEffect(() => {
    if (step) heading.current?.focus()
  }, [step])
  async function save(complete, destination) {
    if (saving) return
    setError('')
    setSaving(true)
    try {
      const saved = await onSave({ name: name.trim(), tutorial_completed: complete })
      setName(saved.name)
      if (complete) onFinish(destination)
      else setStep(1)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }
  return (
    <dialog
      ref={dialog}
      className="welcome-dialog"
      aria-labelledby="welcome-title"
      onCancel={(event) => {
        event.preventDefault()
        if (step && !saving) save(true)
      }}
    >
      <div className="welcome-topline">
        <span className="welcome-brand">APPLE</span>
        <span>{step === 0 ? 'A quick hello' : `Quick tour · ${step} of 2`}</span>
        {step > 0 && (
          <button disabled={saving} onClick={() => save(true)}>
            Skip tour
          </button>
        )}
      </div>
      <div className="welcome-content">
        {step === 0 ? (
          <>
            <span className="welcome-sticker" aria-hidden="true">
              hello.
            </span>
            <h1 id="welcome-title">
              What should
              <br />I call you?
            </h1>
            <p>Just your name, and we’re good to go.</p>
            <form
              onSubmit={(event) => {
                event.preventDefault()
                save(false)
              }}
            >
              <label htmlFor="welcome-name">Your name</label>
              <input
                id="welcome-name"
                autoFocus
                autoComplete="given-name"
                maxLength={60}
                placeholder="e.g. Abhishek"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                disabled={saving}
              />
              {error && (
                <p className="welcome-error" role="alert">
                  {error}
                </p>
              )}
              <button className="neo-button" disabled={saving || !name.trim()}>
                {saving ? 'Saving…' : 'Let’s get started'}
                <ArrowRight size={18} />
              </button>
            </form>
            <p className="welcome-note">
              No email or password. Your name stays in this Mac’s workspace so APPLE remembers it
              next time. You can change it in Settings.
            </p>
          </>
        ) : (
          <>
            <span className={`tour-icon ${step === 1 ? 'green' : 'violet'}`}>
              {step === 1 ? <MessageCircle size={26} /> : <BookOpen size={26} />}
            </span>
            <h1 id="welcome-title" ref={heading} tabIndex={-1}>
              {step === 1 ? `Hi ${name}. Let’s save you some typing.` : 'Put your notes to work.'}
            </h1>
            <p>
              {step === 1
                ? 'Save a WhatsApp contact once. Then ask for them by name.'
                : 'Upload a document. Ask about it, or practise with a voice teacher.'}
            </p>
            {step === 1 ? (
              <>
                <ol className="tour-steps">
                  <li>
                    <b>Open Settings → WhatsApp contacts.</b>
                    <span>
                      Use the exact name shown in WhatsApp and their phone number with country code.
                    </span>
                  </li>
                  <li>
                    <b>Add the names you actually say.</b>
                    <span>Aliases like “Mum” or “Mummy” can point to the same saved contact.</span>
                  </li>
                  <li>
                    <b>Say who it’s for and what to send.</b>
                    <span>Start listening in Assistant, then try the example below.</span>
                  </li>
                </ol>
                <blockquote className="tour-example">“WhatsApp Mum: I’m on my way.”</blockquote>
                <p className="welcome-note">
                  Use the installed WhatsApp Mac app and allow Accessibility access. APPLE asks you
                  to review messages unless you enable trusted automation. This tour doesn’t send
                  anything.
                </p>
              </>
            ) : (
              <>
                <ol className="tour-steps">
                  <li>
                    <b>Open Library and add a document.</b>
                    <span>
                      PDF, DOCX, TXT and Markdown work. Scanned PDFs need text recognition first.
                    </span>
                  </li>
                  <li>
                    <b>Choose Ask to talk about the document.</b>
                    <span>Your questions use the selected document as context.</span>
                  </li>
                  <li>
                    <b>Choose Teach me aloud to practise.</b>
                    <span>
                      APPLE asks a question, listens to your answer, explains the result, then moves
                      on. You can also type answers.
                    </span>
                  </li>
                </ol>
                <blockquote className="tour-example violet">
                  “Ask me a question from these notes.”
                </blockquote>
                <p className="welcome-note">
                  Lessons need a downloaded Ollama model. “Teach me after upload” starts a lesson
                  automatically; turn it off in Settings if you prefer. Check feedback against your
                  source.
                </p>
              </>
            )}
            {error && (
              <p className="welcome-error" role="alert">
                {error}
              </p>
            )}
            <div className="tour-actions">
              {step === 2 && (
                <button className="tour-back" onClick={() => setStep(1)} disabled={saving}>
                  <ArrowLeft size={16} />
                  Back
                </button>
              )}
              <button
                className="neo-button"
                disabled={saving}
                onClick={() => (step === 1 ? setStep(2) : save(true, 'assistant'))}
              >
                {saving ? 'Saving…' : step === 1 ? 'Next: your library' : 'Open my assistant'}
                {step === 1 ? <ArrowRight size={18} /> : <Check size={18} />}
              </button>
            </div>
            {step === 2 && (
              <p className="tour-replay">
                You can replay this tour from Settings whenever you need it.
              </p>
            )}
          </>
        )}
      </div>
    </dialog>
  )
}
