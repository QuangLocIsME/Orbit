import React from "react";

export default function ProjectCard({ project }) {
    return (
        <div className="project-card" key={project.id}>
            <a href={`/projects/${project.id}`} className="project-image-link">
                <div className="project-image">
                    {project.image ? (
                        <img
                            src={project.image}
                            alt={project.name}
                            style={{ width: "100%", height: "180px", objectFit: "cover" }}
                        />
                    ) : null}
                    <span className="project-category">{project.category || "General"}</span>
                    <span className="status">{project.status || "Active"}</span>
                </div>
            </a>

            <div className="project-body">
                <h4>{project.name}</h4>
                <p>{project.description || ""}</p>

                <div className="progress-row">
                    <span>Progress</span>
                    <span>{project.progress ?? 0}%</span>
                </div>

                <div className="progress-bar">
                    <div
                        className="progress"
                        style={{ width: `${project.progress ?? 0}%` }}
                    />
                </div>

                <div className="project-metrics">
                    <span className="metric">👥 {project.membersCount || 0}</span>
                    <span className="metric">🗂 {project.filesCount || 0}</span>
                    <span className="metric">⏱ {project.lastActivity || ""}</span>
                </div>
            </div>
        </div>
    );
}
