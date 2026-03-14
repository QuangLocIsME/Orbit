export default function PackageListItem({ package: pkg }) {

  return (
    <div className="package-list-item">

      {/* NAME */}

      <div className="list-name">

        <div
          className="package-icon"
          style={{background:pkg.color}}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/>
          </svg>
        </div>

        <div>
          <h4>{pkg.name}</h4>
          <span className="list-desc">{pkg.description}</span>
        </div>

      </div>


      {/* STATUS */}

      <div>
        <span className={`status ${pkg.status}`}>
          {pkg.status}
        </span>
      </div>


      {/* PROGRESS */}

      <div className="list-progress">

        <div className="progress-bar small">
          <div
            className="progress-fill"
            style={{
              width:`${pkg.progress}%`,
              background:pkg.color
            }}
          />
        </div>

        <span>{pkg.progress}%</span>

      </div>


      {/* TASKS */}

      <div>{pkg.tasks}</div>


      {/* TEAM */}

      <div className="package-members">

        {pkg.members?.slice(0,3).map((m,i)=>(
          <div key={i} className="member-avatar" style={{background:pkg.color}}>
            {m}
          </div>
        ))}

        {pkg.members?.length > 3 && (
          <div className="member-avatar more">
            +{pkg.members.length-3}
          </div>
        )}

      </div>


      {/* DEADLINE */}

      <div>{pkg.deadline}</div>


      {/* ACTION */}

      <div className="list-actions">⋯</div>

    </div>
  );
}