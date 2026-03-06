import React from "react";
import ProjectTabs from "../project/ProjectTabs.jsx";

export default function ProjectHeader({ project }) {
    if (!project) return null;

    const {
        projectName,
        description,
        startDate,
        deadline,
        progress,
        status,
        coverImage,
        updated,
    } = project;

    return (
        <>
            <div className="project-topbar">
                <div className="topbar-left">
                    <button className="btn outline small">Workspace</button>
                    <div className="topbar-icon">
                        <img src="https://www.figma.com/api/mcp/asset/c405b613-dcee-4946-91e7-cb0ab108e0bd" alt="workspace" />
                    </div>
                    <div className="topbar-title">{project.projectName}</div>
                </div>

                <div className="topbar-right">
                    <button className="btn primary small">
                        <img src="https://www.figma.com/api/mcp/asset/13772bf6-8e88-461e-9f1b-9c034cf004e3" alt="3d" style={{width:16,height:16,marginRight:8}} />
                        3D Viewer
                    </button>
                    <div className="sep" />
                    <button className="icon-btn" aria-label="favorite">★</button>
                    <button className="icon-btn" aria-label="share">⤴</button>
                    <button className="icon-btn" aria-label="more">⋯</button>
                </div>
            </div>

            <div className="project-hero">
                {coverImage ? (
                    <img className="cover" src={coverImage} alt={`${projectName} cover`} />
                ) : (
                    <img className="cover" src="/images/sample.jpg" alt="cover placeholder" />
                )}

                <div className="overlay" />

                <div className="content">
                    <div className="meta">
                        <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            className="meta-icon"
                        >
                            <circle
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="rgba(255,255,255,0.9)"
                                strokeWidth="1.5"
                            />
                            <path
                                d="M12 7v5l3 2"
                                stroke="rgba(255,255,255,0.9)"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>

                        <span>{updated ?? "Last updated"}</span>
                    </div>

                    <h1>{projectName}</h1>

                    <p className="desc">{description}</p>
                </div>
                <div className="tabs-wrap">
                    <ProjectTabs />
                </div>
            </div>

            {/* tabs overlay: positioned at bottom center of hero */}

        </>
    );
}