export default function PackageCard({ package: pkg }) {

  return (
    <a href={`/projects/packages/${pkg.id}`} className="package-card">

      {/* HEADER */}

      <div className="package-header">

        <div
          className="package-icon"
          style={{ background: pkg.color || "#6366f1" }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/>
          </svg>
        </div>

        <div className="package-title">
          <h4>{pkg.name}</h4>

          <span className={`status ${pkg.status}`}>
            {pkg.status}
          </span>
        </div>

      </div>

      {/* DESCRIPTION */}

      <p className="package-desc">
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
              width:`${pkg.progress}%`,
              background:pkg.color
            }}
          />
        </div>

      </div>

      {/* META */}

      <div className="package-meta">

        <span>✓ {pkg.tasks}</span>

        <span>📅 {pkg.deadline}</span>

      </div>

      {/* FOOTER */}

      <div className="package-footer">

        <div className="package-members">

          {pkg.members?.slice(0,3).map((m,i)=>(
            <div
              key={i}
              className="member-avatar"
              style={{background:pkg.color}}
            >
              {m}
            </div>
          ))}

          {pkg.members?.length > 3 && (
            <div className="member-avatar more">
              +{pkg.members.length-3}
            </div>
          )}

        </div>

        <span className="package-updated">
          {pkg.updated}
        </span>

      </div>

    </a>
  );
}