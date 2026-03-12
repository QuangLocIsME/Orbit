import React from "react";

export default function PackageCard({ package: pkg }) {

  return (
    <div className="package-card">

      {/* HEADER */}
      <div className="package-header">

        <div className="package-title">

          <div
            className="package-icon"
            style={{ background: pkg.color }}
          />

          <div>
            <h4>{pkg.name}</h4>
            <span className={`package-status ${pkg.status}`}>
              {pkg.status}
            </span>
          </div>

        </div>

      </div>

      {/* DESCRIPTION */}

      <p className="package-description">
        {pkg.description}
      </p>

      {/* PROGRESS */}

      <div className="package-progress">

        <div className="progress-header">
          <span>Progress</span>
          <span>{pkg.progress}%</span>
        </div>

        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{
              width: `${pkg.progress}%`,
              background: pkg.color
            }}
          />
        </div>

      </div>

      {/* TASK + DEADLINE */}

      <div className="package-meta">
        <span>{pkg.tasks}</span>
        <span>{pkg.deadline}</span>
      </div>

      {/* FOOTER */}

      <div className="package-footer">

        <div className="package-members">

          {pkg.members.slice(0,3).map((m,i)=>(
            <div key={i} className="member-avatar">
              {m}
            </div>
          ))}

          {pkg.members.length > 3 && (
            <div className="member-avatar more">
              +{pkg.members.length - 3}
            </div>
          )}

        </div>

        <span className="package-updated">
          {pkg.updated}
        </span>

      </div>

    </div>
  );
}