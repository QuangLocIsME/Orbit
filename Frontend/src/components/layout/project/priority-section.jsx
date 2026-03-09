import { useEffect, useState } from "react";
import { getPriorityProjects } from "../../../services/project-service";

export default function PrioritySection() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPriorityProjects().then((data) => {
      setProjects(data);
      setLoading(false);
    });
  }, []);

  return (
    <section className="priority-section">
      <h3>Priority Projects</h3>

      <div className="project-grid">
        {loading ? (
          <p className="project-loading">Loading...</p>
        ) : projects.length === 0 ? (
          <p className="project-empty">No projects yet</p>
        ) : (
          projects.map((project) => (
            <div className="project-card" key={project.id}>
              <a href={`/projects/${project.id}`} className="project-image-link">
                <div className="project-image">
                  {project.image ? (
                    <img src={project.image} alt={project.name} />
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
          ))
        )}
      </div>
    </section>
  );
}
