import React from "react";

export default function PackageListItem({ package: pkg }) {

  return (
    <div className="package-list-item">

      <div className="package-list-left">

        <div
          className="package-icon"
          style={{ background: pkg.color }}
        />

        <div>

          <h4 className="package-name">
            {pkg.name}
          </h4>

          <p className="package-desc">
            {pkg.description}
          </p>

        </div>

      </div>

      <div className="package-list-progress">

        <span>{pkg.progress}%</span>

        <div className="progress-bar small">
          <div
            className="progress-fill"
            style={{
              width: `${pkg.progress}%`,
              background: pkg.color
            }}
          />
        </div>

      </div>

      <div className="package-list-meta">

        <span className={`package-status ${pkg.status}`}>
          {pkg.status}
        </span>

        <span>{pkg.tasks}</span>

        <span>{pkg.deadline}</span>

      </div>

    </div>
  );
}