import React from 'react'
import { solutionRoutes } from '../solutionRoutes.js'

export function SolutionRoutes({ exp, x, view, onChoose }) {
  const guide = solutionRoutes(exp, x)
  return <section className="solution-routes" data-role="solution-routes" aria-label="Choose a solution route">
    <h3>Choose a solution route</h3>
    <p>{guide.intro} <b>{guide.guidance}</b></p>
    <div className="solution-route-cards">
      {guide.routes.map((route) => <div className="solution-route" key={route.id} data-route={route.id} data-current={route.view === view}>
        <h4>{route.label}</h4>
        <p>{route.description}</p>
        <p><b>Best for:</b> {route.bestFor}</p>
        <p><b>Tradeoff:</b> {route.tradeoff}</p>
        {route.view ? <button type="button" aria-pressed={route.view === view} onClick={(event) => {
          onChoose(route.view)
          event.currentTarget.closest('.view-body').scrollTop = 0
        }}>{route.action || `Open ${route.label === 'Circuit equations' ? 'Equations' : route.label}`}</button> : <span className="route-unavailable">Not a separate route in this experiment</span>}
      </div>)}
    </div>
    <p className="route-connection">{guide.connection}</p>
  </section>
}
