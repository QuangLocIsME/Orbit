import React from "react";

function TaskPill({ count, label, bg }) {
  return (
    <div className="task-pill">
      <div className="task-icon" style={{ background: bg || "#f3f4f6" }} />
      <div className="task-info">
        <div className="task-count">{count}</div>
        <div className="task-label">{label}</div>
      </div>
    </div>
  );
}

export default function TasksOverview({ tasksOverview = {} }) {
  const { todo = 0, inProgress = 0, review = 0, done = 0 } = tasksOverview;

  return (
    <section className="project-section tasks-overview">
      <div className="section-header">
        <h3>Tasks Overview</h3>
        <div className="view-all">View all tasks →</div>
      </div>

      <div className="tasks-card">
        <TaskPill count={todo} label="To Do" bg="#f3f4f6" />
        <TaskPill count={inProgress} label="In Progress" bg="#dbeafe" />
        <TaskPill count={review} label="Review" bg="#fef9c2" />
        <TaskPill count={done} label="Done" bg="#dcfce7" />
      </div>
    </section>
  );
}
