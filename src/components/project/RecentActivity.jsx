import React from "react";

function ActivityItem({ a }) {
  return (
    <div className="activity-item">
      <div className="activity-icon" style={{ background: a.bg || "#f3f4f6" }}>
        {a.icon ? <img src={a.icon} alt="icon" /> : null}
      </div>
      <div className="activity-body">
        <div className="activity-title">{a.title}</div>
        <div className="activity-meta">{a.meta}</div>
      </div>
    </div>
  );
}

export default function RecentActivity({ activities = [] }) {
  return (
    <section className="project-section recent-activity">
      <div className="section-header">
        <h3>Recent activity</h3>
      </div>

      <div className="activity-card">
        {activities.length === 0 ? (
          <div className="empty">No recent activity</div>
        ) : (
          activities.map((a, i) => <ActivityItem key={a.id || i} a={a} />)
        )}
      </div>
    </section>
  );
}
