import React from "react"
import './index.scss';

export default function Debug({ debug, people, target }) {

  return (
    <div className={`debug ${debug ? '' : 'hidden'}`}>
      <h1>Detected {people.length} {people.length > 1 ? 'people' : 'person'}</h1>
      {people.map((p) => (
        <p className={`debug-person ${p.id === target?.id ? 'target' : ''}`} key={p.id} style={{ color: p.color }}>
          {p.label ?? "person"} ({Math.round(p.score * 100)}%) – dist:{" "}
          {p.distance.toFixed(2)}
        </p>
      ))}
    </div>
  )
}