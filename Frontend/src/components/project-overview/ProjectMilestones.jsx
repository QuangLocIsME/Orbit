import React from "react";

function MilestoneRow({ m }) {
  return (
    <div className="milestone-row">
      <div className="milestone-dot" style={{ background: m.dotColor || "#d1d5dc" }} />
      <div className="milestone-body">
        <div className="milestone-title">{m.title}</div>
        <div className="milestone-date">{m.date}</div>
      </div>
      <div className={`milestone-status ${m.status || ""}`}>{m.statusLabel || m.status}</div>
    </div>
  );
}

export default function ProjectMilestones({ milestones = [] }) {
  return (
    <section className="project-section project-milestones">
      <div className="section-header">
        <h3>Project milestones</h3>
      </div>

      <div className="milestones-card">
        {milestones.length === 0 ? (
          <div className="empty">No milestones</div>
        ) : (
          milestones.map((m, i) => <MilestoneRow key={m.id || i} m={m} />)
        )}
      </div>
    </section>
  );
}
