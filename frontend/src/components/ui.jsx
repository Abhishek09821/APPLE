import React from 'react'
export function Orb({ small = false, active = false }) {
  return (
    <div className={`orb ${small ? 'small' : ''} ${active ? 'active' : ''}`} aria-hidden="true">
      <div className="orb-halo" />
      <div className="orb-core">
        <div className="orb-wave wave-one" />
        <div className="orb-wave wave-two" />
        <div className="orb-shine" />
      </div>
    </div>
  )
}
export function IconButton({ label, children, ...props }) {
  return (
    <button className="icon-button" aria-label={label} title={label} {...props}>
      {children}
    </button>
  )
}
export function Empty({ icon: Icon, title, children }) {
  return (
    <div className="empty">
      <Icon size={32} />
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  )
}
