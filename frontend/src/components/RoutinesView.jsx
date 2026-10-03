import React from 'react'
import { Check, Layers, Play, Plus, Trash2, X, Zap } from 'lucide-react'
import { api } from '../utils/api'
import { IconButton, Empty } from './ui'

export default function RoutinesView({
  setRoutineForm,
  routineForm,
  routineName,
  setRoutineName,
  routineSteps,
  setRoutineSteps,
  doWork,
  refresh,
  setNotice,
  working,
  routines,
  busy,
  setSelectedDoc,
  setView,
  setInput,
}) {
  return (
    <div className="page-content">
      <div className="page-heading">
        <span className="eyebrow">MAKE ROOM FOR WHAT MATTERS</span>
        <h1>
          Once taught. Always ready<span>.</span>
        </h1>
        <p>Give your everyday actions a name. I’ll remember the steps.</p>
      </div>
      <div className="routine-intro">
        <span className="suggestion-icon amber">
          <Zap size={24} />
        </span>
        <div>
          <h3>A little instruction goes a long way.</h3>
          <p>
            “Focus time” can open Notes, search for ambient music, and launch your favorite apps.
          </p>
        </div>
        <button className="primary-button" onClick={() => setRoutineForm(true)}>
          <Plus size={16} />
          Teach a routine
        </button>
      </div>
      {routineForm && (
        <form
          className="routine-form"
          onSubmit={(e) => {
            e.preventDefault()
            doWork(async () => {
              await api('/routines', {
                method: 'POST',
                body: JSON.stringify({
                  name: routineName,
                  commands: routineSteps.split('\n').filter((s) => s.trim()),
                  description: '',
                }),
              })
              setRoutineForm(false)
              setRoutineName('')
              setRoutineSteps('')
              await refresh()
              setNotice('Routine remembered. Run it anytime.')
            })
          }}
        >
          <div className="list-heading">
            <h3>Teach me something</h3>
            <IconButton
              label="Close routine form"
              type="button"
              onClick={() => setRoutineForm(false)}
            >
              <X size={16} />
            </IconButton>
          </div>
          <label>
            Give it a name
            <input
              required
              maxLength={80}
              placeholder="My morning routine"
              value={routineName}
              onChange={(e) => setRoutineName(e.target.value)}
            />
          </label>
          <label>
            What should I do? <span>One command per line, up to 12 steps.</span>
            <textarea
              required
              rows={5}
              placeholder={'Open Calendar\nOpen https://news.ycombinator.com\nOpen Notes'}
              value={routineSteps}
              onChange={(e) => setRoutineSteps(e.target.value)}
            />
          </label>
          <button
            className="primary-button"
            disabled={working || !routineName.trim() || !routineSteps.trim()}
          >
            <Check size={15} />
            Remember this routine
          </button>
        </form>
      )}
      <div className="list-heading">
        <h3>
          Your routines <span>{routines.length}</span>
        </h3>
      </div>
      {routines.length ? (
        <div className="routine-grid">
          {routines.map((r) => (
            <div className="routine-card" key={r.id}>
              <div className="routine-card-top">
                <span className="suggestion-icon blue">
                  <Layers size={19} />
                </span>
                <IconButton
                  label={`Delete routine ${r.name}`}
                  onClick={() =>
                    doWork(async () => {
                      await api(`/routines/${r.id}`, { method: 'DELETE' })
                      await refresh()
                    })
                  }
                >
                  <Trash2 size={15} />
                </IconButton>
              </div>
              <h3>{r.name}</h3>
              <ol>
                {r.commands.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ol>
              <button
                className="secondary-button"
                disabled={busy}
                onClick={() => {
                  setSelectedDoc(null)
                  setView('assistant')
                  setInput(`Run ${r.name}`)
                }}
              >
                <Play size={13} />
                Use routine
              </button>
            </div>
          ))}
        </div>
      ) : (
        !routineForm && (
          <Empty icon={Layers} title="Your own way of doing things">
            Create a routine above. For advanced app behavior, create a macOS Shortcut and add “Run
            shortcut My Shortcut”.
          </Empty>
        )
      )}
    </div>
  )
}
