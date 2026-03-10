import React from "react";

export default function FolderListItem({ folder }) {
    return (
        <li key={folder.id} className="folder-card" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <a href={`/projects/folders/${folder.id}`} style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', color: 'inherit' }}>
                <div class="folder-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
                    </svg>
                </div>
                <div className="folder-info">
                    <p className="folder-title">{folder.name}</p>
                    <span className="folder-count">{folder.projectCount ?? 0} projects</span>
                </div>
            </a>
        </li>
    );
}
