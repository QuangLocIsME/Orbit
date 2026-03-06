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
              <div className="project-image">
                <span className="status">{project.status || "Active"}</span>
              </div>

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
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
