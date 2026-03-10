import React from "react";

export default function ProjectListItem({ project }) {
  return (
    <div key={project.id} className="project-card" style={{ display: 'flex', gap: 12, padding: 12, alignItems: 'center' }}>
      <a href={`/projects/${project.id}`} className="project-image-link" style={{ display: 'block', width: 120 }}>
        <div className="project-image" style={{ height: 80 }}>
          {project.image ? (
            <img src={project.image} alt={project.name} />
          ) : null}
        </div>
      </a>
      <div style={{ flex: 1 }}>
        <h4 style={{ margin: 0 }}>{project.name}</h4>
        <p style={{ margin: '6px 0' }}>{project.description || ""}</p>
        <div style={{ display: 'flex', gap: 12, fontSize: 13, color: 'var(--color-muted-foreground)' }}>
          <span>👥 {project.membersCount || 0}</span>
          <span>🗂 {project.filesCount || 0}</span>
          <span>⏱ {project.lastActivity || ""}</span>
        </div>
      </div>

      <div style={{ width: 160 }}>
        <div className="progress-row">
          <span>Progress</span>
          <span>{project.progress ?? 0}%</span>
        </div>
        <div className="progress-bar">
          <div className="progress" style={{ width: `${project.progress ?? 0}%` }} />
        </div>
      </div>
    </div>
  );
}
