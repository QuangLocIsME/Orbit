import React from "react";

function MetricCard({ label, value, icon }) {
  return (
    <div className="metric-card">
      <div className="metric-icon">{icon}</div>
      <div className="metric-body">
        <div className="metric-value">{value}</div>
        <div className="metric-label">{label}</div>
      </div>
    </div>
  );
}

export default function ProjectStats({ project }) {
  if (!project) return null;

  const {
    status,
    progress = 0,
    startDate,
    deadline,
    documentsCount = 0,
    versionsCount = 0,
    membersCount = 0,
    openClashes = 0,
  } = project;

  return (
    <section className="project-stats">
      <div className="stats-top">
        <div className="stat-item">
          <div className="label">STATUS</div>
          <div className={`status-pill ${status ? status.toLowerCase() : ""}`}>{status ?? "—"}</div>
        </div>

        <div className="stat-item progress-wrap">
          <div className="label">PROGRESS</div>
          <div className="progress-bar">
            <div className="progress" style={{ width: `${Math.min(100, Math.max(0, progress || 0))}%` }} />
          </div>
          <div className="progress-percent">{Math.round(progress ?? 0)}%</div>
        </div>

        <div className="stat-item">
          <div className="label">START DATE</div>
          <div className="value">{startDate ?? "—"}</div>
        </div>

        <div className="stat-item">
          <div className="label">DEADLINE</div>
          <div className="value">{deadline ?? "—"}</div>
        </div>
      </div>

      <div className="metrics-row">
        <MetricCard label="Documents" value={documentsCount} icon={<span>📄</span>} />
        <MetricCard label="Versions" value={versionsCount} icon={<span>🗂️</span>} />
        <MetricCard label="Team Members" value={membersCount} icon={<span>👥</span>} />
        <MetricCard label="Open Clashes" value={openClashes} icon={<span>⚠️</span>} />
      </div>
    </section>
  );
}
