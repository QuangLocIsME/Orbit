import React from "react";

export default function ProjectMembers({ members = [] }) {
  return (
    <section className="project-section project-members">
      <div className="section-header">
        <h3>Team members</h3>
      </div>

      <div className="members-card">
        {members.length === 0 ? (
          <div className="empty">No members</div>
        ) : (
          members.map((m) => (
            <div key={m.id || m.name} className="member-row">
              <div className="avatar" style={{ background: m.color || "#ccc" }}>
                {m.initials || (m.name || "").split(" ").map(s => s[0]).slice(0,2).join("")}
                {m.online && <span className="presence" />}
              </div>

              <div className="member-info">
                <div className="member-name">{m.name}</div>
                <div className="member-role">{m.role}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
