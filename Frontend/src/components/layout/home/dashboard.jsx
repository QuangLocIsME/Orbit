import { useEffect, useState } from "react";
import { getRecentProjects } from "../../../services/dashboard-service";
import { getUpcomingEvents } from "../../../services/event-service";
import { getUserTasks } from "../../../services/task-service";
import CreateProjectModal from "./create-project-modal.jsx";

export default function Dashboard() {

  const [projects, setProjects] = useState([]);
  const [events, setEvents] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    async function load() {
      setProjects(await getRecentProjects());
      setEvents(await getUpcomingEvents());
      setTasks(await getUserTasks());
    }
    load();
  }, []);

  return (
    <main className="dashboard">
  
      {/* HEADER */}
      <header className="dashboard-header">
        <h1>Welcome back</h1>
        <button className="primary-btn" onClick={() => setOpen(true)}>+ New Project</button>
        {open && (
        <CreateProjectModal onClose={() => setOpen(false)} />
      )}
      </header>
  
      {/* SEARCH */}
      <div className="search-bar">
        <input
          type="text"
          placeholder="Search projects, files, tasks, or people..."
        />
      </div>
  
      {/* RECENT PROJECTS */}
      <section className="card recent">
        <div className="card-header">
          <h2>Recently visited</h2>
        </div>
  
        <div className="recent-list">
          {projects.map(p => (
            <article className="project-card" key={p.id}>
              <img src="/images/sample.jpg" alt={p.name} />
  
              <div className="project-info">
                <h4>{p.name}</h4>
                <span>{p.updatedAt}</span>
              </div>
            </article>
          ))}
        </div>
      </section>
  
      {/* BOTTOM GRID */}
      <div className="bottom-grid">
  
        {/* UPCOMING EVENTS */}
        <section className="card events">
          <div className="card-header">
            <span className="icon">📅</span>
            <h2>Upcoming events</h2>
          </div>
  
          <div className="card-body">
            {events.map(e => (
              <article className="event-item" key={e.id}>
                <div className="event-left">
                  <div className="event-icon" aria-hidden>📅</div>
                  <div className="event-content">
                    <h4>{e.title}</h4>
                    <span className="event-meta">
                      {e.project} • {e.participants}
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
  
        {/* TASKS */}
        <section className="card tasks">
          <div className="card-header">
            <span className="icon">📋</span>
            <h2>Your tasks</h2>
          </div>
  
          <div className="card-body">
            {tasks.map(t => (
              <article className="task-item" key={t.id}>
                <div className="task-item-inner">
                  <div className="task-content-wrap">
                    <div className="task-content">
                      <h4>{t.title}</h4>
                      <span className="task-meta">
                        {t.project} • {t.due}
                      </span>
                    </div>
                  </div>
                  <div className={`priority ${(t.priority || "").toLowerCase()}`}>
                    {t.priority}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
  
      </div>
  
    </main>
  );
}