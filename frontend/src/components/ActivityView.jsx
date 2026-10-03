import React, { useEffect, useMemo, useState } from 'react'
import { Check, ChevronRight, History, Search, Trash2, X } from 'lucide-react'
import { Empty } from './ui'
import { api } from '../utils/api'

export default function ActivityView({ history, onDeleted }) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(new Set())
  const [pending, setPending] = useState(null)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')
  const visible = useMemo(
    () =>
      history.filter((h) =>
        `${h.command} ${h.reply}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
      ),
    [history, query],
  )
  useEffect(
    () =>
      setSelected(
        (previous) => new Set([...previous].filter((id) => history.some((h) => h.id === id))),
      ),
    [history],
  )
  const toggle = (id) =>
    setSelected((previous) => {
      const next = new Set(previous)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  async function remove() {
    setWorking(true)
    setError('')
    try {
      const selection = pending
      await api(
        selection === 'all' ? '/history' : '/history/delete',
        selection === 'all'
          ? { method: 'DELETE' }
          : { method: 'POST', body: JSON.stringify({ ids: selection }) },
      )
      setPending(null)
      setSelected(new Set())
      await onDeleted(selection)
    } catch (e) {
      setError(e.message)
    } finally {
      setWorking(false)
    }
  }
  return (
    <div className="page-content activity-page">
      <div className="page-heading">
        <span className="eyebrow">EVERY ACTION, ACCOUNTED FOR</span>
        <h1>
          A little look back<span>.</span>
        </h1>
        <p>Your conversations and actions. Keep what matters, remove what doesn’t.</p>
      </div>
      {history.length > 0 && (
        <>
          <div className="activity-toolbar">
            <label className="activity-search">
              <Search size={16} />
              <input
                aria-label="Search history"
                placeholder="Search your history…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <button
              className="secondary-button"
              disabled={!selected.size || working}
              onClick={() => setPending([...selected])}
            >
              <Trash2 size={14} /> Delete selected{selected.size ? ` (${selected.size})` : ''}
            </button>
            <button
              className="subtle-button danger-text"
              disabled={working}
              onClick={() => setPending('all')}
            >
              Clear all history
            </button>
          </div>
          <label className="activity-select-all">
            <input
              type="checkbox"
              aria-label="Select all shown history"
              checked={visible.length > 0 && visible.every((h) => selected.has(h.id))}
              onChange={(e) =>
                setSelected(e.target.checked ? new Set(visible.map((h) => h.id)) : new Set())
              }
            />{' '}
            Select shown · {visible.length} recent {visible.length === 1 ? 'entry' : 'entries'}
          </label>
        </>
      )}
      {pending && (
        <section
          className="history-confirm"
          role="alertdialog"
          aria-label="Confirm history deletion"
          aria-describedby="history-delete-description"
        >
          <div>
            <strong>
              {pending === 'all'
                ? 'Clear your entire activity history?'
                : `Delete ${pending.length} selected ${pending.length === 1 ? 'entry' : 'entries'}?`}
            </strong>
            <p id="history-delete-description">
              This permanently removes the selected records and their conversation context.
              Documents, contacts and saved memories stay in place.
            </p>
          </div>
          <button className="secondary-button" disabled={working} onClick={() => setPending(null)}>
            Keep history
          </button>
          <button className="danger-button" disabled={working} onClick={remove}>
            {working ? 'Deleting…' : 'Delete permanently'}
          </button>
        </section>
      )}
      {error && (
        <p role="alert" className="danger-text">
          {error}
        </p>
      )}
      {visible.length ? (
        <div className="activity-list">
          {visible.map((h) => (
            <div className="activity-selectable" key={h.id}>
              <input
                className="history-checkbox"
                type="checkbox"
                aria-label={`Select ${h.command}`}
                checked={selected.has(h.id)}
                onChange={() => toggle(h.id)}
              />
              <details className="activity-record">
                <summary>
                  <span className={`activity-result ${h.success ? '' : 'failure'}`}>
                    {h.success ? <Check size={16} /> : <X size={16} />}
                  </span>
                  <div>
                    <strong>{h.command}</strong>
                    <span>{new Date(h.created).toLocaleString()}</span>
                  </div>
                  <ChevronRight size={16} />
                </summary>
                <div className="activity-detail">
                  <p>{h.reply}</p>
                  {h.steps?.map((s, i) => (
                    <div key={i}>
                      {s.success ? '✓' : '×'} {String(s.action).replaceAll('_', ' ')} · {s.target}
                    </div>
                  ))}
                </div>
              </details>
              <button
                className="icon-button"
                aria-label={`Delete ${h.command}`}
                disabled={working}
                onClick={() => setPending([h.id])}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <Empty
          icon={History}
          title={history.length ? 'Nothing matches that search' : 'A fresh start'}
        >
          {history.length
            ? 'Try another word or clear the search.'
            : 'Completed requests will appear here, with their actual results.'}
        </Empty>
      )}
    </div>
  )
}
