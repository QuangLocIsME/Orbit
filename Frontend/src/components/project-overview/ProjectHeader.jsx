import React from "react";

export default function ProjectHeader({ project }) {
  if (!project) return null;

  const { projectName } = project;

  return (
    <div className="project-topbar">

      <div className="topbar-container">

        <div className="topbar-left">

          <div className="workspace-btn">Workspace</div>

          <span className="breadcrumb-sep">›</span>

          <span className="breadcrumb">
            {projectName}
          </span>

        </div>

        <div className="topbar-right">

          <button className="viewer-btn">
            🎥 3D Viewer
          </button>

          <div className="topbar-divider"></div>

          <button className="icon-btn">⟳</button>
          <button className="icon-btn">★</button>
          <button className="icon-btn">⤴</button>
          <button className="icon-btn">⋯</button>

        </div>

      </div>

    </div>
  );
}