import { useState } from "react";
import CreateProjectModal from "../home/create-project-modal.jsx";
import CreateFolderModal from "./create-folder-modal.jsx";
export default function ProjectHeader() {

  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [openFolder, setOpenFolder] = useState(false);

  return (
    <header className="project-header">

      {/* LEFT ACTIONS */}
      <div className="header-left">

      <button className="btn primary" onClick={() => setOpen(true)}>+ New Project</button>
        {open && (
        <CreateProjectModal onClose={() => setOpen(false)} />
      )}

        <button className="btn outline" onClick={() => setOpenFolder(true)}>
          📁 New Folder
        </button>
        {openFolder && (
          <CreateFolderModal onClose={() => setOpenFolder(false)} />
        )}

      </div>

      {/* SEARCH */}
      <div className="header-search">

        <span className="search-icon">🔍</span>

        <input
          type="text"
          placeholder="Search projects..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

      </div>

      {/* RIGHT ACTIONS */}
      <div className="header-right">

        <button className="btn outline">
          ⚙ Filter
        </button>

        <div className="view-switch">

          <button className="view-btn">☰</button>
          <button className="view-btn active">▦</button>

        </div>

      </div>

    </header>
  );
}