import React from "react";
import "../../../../styles/project-overview/project-overview.css";

export default function ProjectFigure({ project }) {
    if (!project) return null;

    const { projectName, description, coverImage, updated } = project;

    return (
        <div className="project-hero" style={{ backgroundImage: coverImage ? `url(${coverImage})` : 'none' }}>
            <div className="hero-overlay">
                <div className="hero-content">
                    <span className="last-updated">{updated}</span>
                    <h1>{projectName}</h1>
                    <p>{description}</p>
                </div>
            </div>
            <div className="hero-tabs-container">
            </div>
        </div>
    );  
}