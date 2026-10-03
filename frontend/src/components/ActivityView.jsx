import React from 'react'
import { Check, ChevronRight, History, X } from 'lucide-react'

import { Empty } from './ui'

const actionLabel = (a) => a.replaceAll('_', ' ')

export default function ActivityView({ history }) {
  return (
    <div className="page-content">
      <div className="page-heading">
        <span className="eyebrow">EVERY ACTION, ACCOUNTED FOR</span>
        <h1>
          A little look back<span>.</span>
        </h1>
        <p>Real results from your conversations and computer actions.</p>
      </div>
      {history.length ? (
        <div className="activity-list">
          {history.map((h) => (
            <details className="activity-record" key={h.id}>
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
                    {s.success ? '✓' : '×'} {actionLabel(s.action)} · {s.target}
                  </div>
                ))}
              </div>
            </details>
          ))}
        </div>
      ) : (
        <Empty icon={History} title="A fresh start">
          Completed requests will appear here, with their actual results.
        </Empty>
      )}
    </div>
  )
}
