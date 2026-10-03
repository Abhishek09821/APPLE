import React, { useEffect, useId, useRef, useState } from 'react'
import { Check, Loader2, Pencil, ShieldCheck, Trash2, UserPlus, Users } from 'lucide-react'
import { api } from '../utils/api'
import './saved-contacts.css'

const emptyForm = { name: '', phone: '', aliases: '' }

export default function SavedContacts({ onChanged } = {}) {
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [busy, setBusy] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState({})
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const nameInput = useRef(null)
  const phoneInput = useRef(null)
  const id = useId()

  useEffect(() => {
    const controller = new AbortController()
    api('/contacts', { signal: controller.signal })
      .then((items) => setContacts(items))
      .catch((cause) => {
        if (controller.signal.aborted) return
        setError(cause.message || 'Could not load your contacts.')
        setLoadFailed(true)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [])

  async function reloadContacts(savedMessage = '') {
    try {
      const items = await api('/contacts')
      setContacts(items)
      setLoadFailed(false)
      return true
    } catch (cause) {
      setLoadFailed(true)
      setError(
        savedMessage
          ? `${savedMessage} The list could not refresh. Try loading it again.`
          : cause.message || 'Could not load your contacts.',
      )
      return false
    }
  }

  const changed = () => {
    // A parent refresh should not turn a successful local save into a save error.
    Promise.resolve()
      .then(() => onChanged?.())
      .catch(() => {})
  }

  function resetForm() {
    setEditingId(null)
    setForm(emptyForm)
    setErrors({})
  }

  function edit(contact) {
    setEditingId(contact.id)
    setForm({
      name: contact.name,
      phone: contact.phone,
      aliases: (contact.aliases || []).join(', '),
    })
    setErrors({})
    setNotice('')
    nameInput.current?.focus()
  }

  async function save(event) {
    event.preventDefault()
    if (busy || loading) return
    const name = form.name.trim()
    const phone = form.phone.trim().replace(/[\s().-]/g, '')
    const nextErrors = {}
    if (!name || !/[\p{L}\p{N}]/u.test(name))
      nextErrors.name = 'Enter the exact name shown in the WhatsApp chat.'
    if (!/^\+[1-9]\d{7,14}$/.test(phone))
      nextErrors.phone = 'Use +, your country code, and 8–15 digits in total.'
    const aliases = [
      ...new Map(
        form.aliases
          .split(/[,，،\n]/u)
          .map((alias) => alias.trim())
          .filter(Boolean)
          .map((alias) => [alias.normalize('NFKC').toLocaleLowerCase(), alias]),
      ).values(),
    ]
    if (aliases.length > 20) nextErrors.aliases = 'Use up to 20 aliases for one contact.'
    else if (aliases.some((alias) => alias.length > 80 || !/[\p{L}\p{N}]/u.test(alias)))
      nextErrors.aliases = 'Each alias needs a name and must be 80 characters or fewer.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) {
      if (nextErrors.name) nameInput.current?.focus()
      else if (nextErrors.phone) phoneInput.current?.focus()
      else document.getElementById(`${id}-aliases`)?.focus()
      return
    }

    setBusy('save')
    setError('')
    setNotice('')
    try {
      await api(editingId === null ? '/contacts' : `/contacts/${encodeURIComponent(editingId)}`, {
        method: editingId === null ? 'POST' : 'PUT',
        body: JSON.stringify({ name, phone, aliases }),
      })
      resetForm()
      setNotice(`${name} saved.`)
      await reloadContacts('Your contact was saved.')
      changed()
    } catch (cause) {
      setError(cause.message || 'Could not save this contact.')
    } finally {
      setBusy('')
    }
  }

  async function remove(contact) {
    if (busy) return
    setBusy(`remove-${contact.id}`)
    setError('')
    setNotice('')
    try {
      await api(`/contacts/${encodeURIComponent(contact.id)}`, { method: 'DELETE' })
      setContacts((items) => items.filter((item) => item.id !== contact.id))
      if (editingId === contact.id) resetForm()
      setNotice(`${contact.name} removed.`)
      changed()
    } catch (cause) {
      setError(cause.message || 'Could not remove this contact.')
    } finally {
      setBusy('')
    }
  }

  return (
    <section className="settings-card saved-contacts" aria-labelledby={`${id}-heading`}>
      <div className="settings-card-heading sc-heading">
        <span className="sc-heading-icon" aria-hidden="true">
          <Users size={19} strokeWidth={1.6} />
        </span>
        <div>
          <h3 id={`${id}-heading`}>WhatsApp contacts</h3>
          <p>Names and nicknames you can use in voice commands</p>
        </div>
        {!loading && <span className="sc-count">{contacts.length} saved</span>}
      </div>
      <p className="sc-intro">
        Enter the exact name shown in the WhatsApp chat so APPLE can verify the recipient. Add names
        you say aloud, such as Mummy, माँ or Mom, as aliases.
      </p>

      <form className="sc-form" onSubmit={save} noValidate>
        {editingId !== null && <div className="sc-editing-label">Editing contact</div>}
        <fieldset disabled={!!busy || loading}>
          <div className="sc-field-grid">
            <label className="sc-field" htmlFor={`${id}-name`}>
              WhatsApp name
              <input
                ref={nameInput}
                id={`${id}-name`}
                aria-label="WhatsApp name"
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="Name shown in the chat"
                autoComplete="off"
                maxLength={120}
                required
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? `${id}-name-error` : undefined}
              />
              {errors.name && (
                <span id={`${id}-name-error`} className="sc-field-error" role="alert">
                  {errors.name}
                </span>
              )}
            </label>
            <label className="sc-field" htmlFor={`${id}-phone`}>
              Phone number
              <input
                ref={phoneInput}
                id={`${id}-phone`}
                aria-label="Phone number"
                type="tel"
                inputMode="tel"
                value={form.phone}
                onChange={(event) =>
                  setForm((current) => ({ ...current, phone: event.target.value }))
                }
                placeholder="+91 98765 43210"
                autoComplete="off"
                maxLength={30}
                required
                aria-invalid={!!errors.phone}
                aria-describedby={errors.phone ? `${id}-phone-error` : `${id}-phone-hint`}
              />
              {errors.phone ? (
                <span id={`${id}-phone-error`} className="sc-field-error" role="alert">
                  {errors.phone}
                </span>
              ) : (
                <span id={`${id}-phone-hint`} className="sc-field-hint">
                  Include + and the country code.
                </span>
              )}
            </label>
          </div>
          <label className="sc-field" htmlFor={`${id}-aliases`}>
            Voice aliases <span className="sc-optional">Optional</span>
            <input
              id={`${id}-aliases`}
              aria-label="Voice aliases"
              value={form.aliases}
              onChange={(event) =>
                setForm((current) => ({ ...current, aliases: event.target.value }))
              }
              placeholder="Mummy, माँ, Mom"
              autoComplete="off"
              aria-invalid={!!errors.aliases}
              aria-describedby={errors.aliases ? `${id}-aliases-error` : `${id}-aliases-hint`}
            />
            {errors.aliases ? (
              <span id={`${id}-aliases-error`} className="sc-field-error" role="alert">
                {errors.aliases}
              </span>
            ) : (
              <span id={`${id}-aliases-hint`} className="sc-field-hint">
                Separate aliases with commas. Hindi and other languages are supported.
              </span>
            )}
          </label>
          <div className="sc-form-actions">
            <button className="primary-button sc-save" type="submit">
              {busy === 'save' ? <Loader2 size={14} className="spin" /> : <UserPlus size={14} />}
              Save contact
            </button>
            {editingId !== null && (
              <button className="secondary-button" type="button" onClick={resetForm}>
                Cancel edit
              </button>
            )}
          </div>
        </fieldset>
      </form>

      {error && (
        <div className="sc-error" role="alert">
          <span>{error}</span>
          {loadFailed && (
            <button
              type="button"
              disabled={!!busy || loading}
              onClick={async () => {
                setLoading(true)
                setError('')
                await reloadContacts()
                setLoading(false)
              }}
            >
              Retry loading
            </button>
          )}
        </div>
      )}
      <div className="sc-notice" role="status" aria-live="polite">
        {notice && (
          <>
            <Check size={13} /> {notice}
          </>
        )}
      </div>

      {loading ? (
        <div className="sc-empty" role="status">
          <Loader2 size={15} className="spin" /> Loading contacts…
        </div>
      ) : contacts.length ? (
        <ul className="sc-list" aria-label="Saved WhatsApp contacts">
          {contacts.map((contact) => (
            <li className={editingId === contact.id ? 'is-editing' : ''} key={contact.id}>
              <span className="sc-avatar" aria-hidden="true">
                {Array.from(contact.name.trim())[0]?.toLocaleUpperCase()}
              </span>
              <div className="sc-contact-body">
                <div className="sc-contact-name">{contact.name}</div>
                <div className="sc-contact-phone">{contact.phone}</div>
                {contact.aliases?.length > 0 && (
                  <div className="sc-aliases" aria-label={`Voice aliases for ${contact.name}`}>
                    {contact.aliases.map((alias) => (
                      <span key={alias}>{alias}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="sc-row-actions">
                <button
                  type="button"
                  aria-label={`Edit ${contact.name}`}
                  title={`Edit ${contact.name}`}
                  disabled={!!busy}
                  onClick={() => edit(contact)}
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  className="sc-remove"
                  aria-label={`Remove ${contact.name}`}
                  title={`Remove ${contact.name}`}
                  disabled={!!busy}
                  onClick={() => remove(contact)}
                >
                  {busy === `remove-${contact.id}` ? (
                    <Loader2 size={14} className="spin" />
                  ) : (
                    <Trash2 size={14} />
                  )}
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : !loadFailed ? (
        <p className="sc-empty">No saved contacts yet. Add someone you message often.</p>
      ) : null}

      <p className="sc-privacy">
        <ShieldCheck size={13} /> Saved locally on this Mac.
      </p>
    </section>
  )
}
