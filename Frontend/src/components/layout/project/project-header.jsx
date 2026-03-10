import { useState } from "react";
import CreateProjectModal from "../home/create-project-modal.jsx";
import CreateFolderModal from "./create-folder-modal.jsx";
import ViewSwitch from "../../ui/ViewSwitch";
import Filter from "../../ui/Filter";

export default function ProjectHeader() {

  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [openFolder, setOpenFolder] = useState(false);

  return (
    <header className="project-header">

      {/* LEFT */}
      <div className="header-left">

        <button className="btn primary" onClick={() => setOpen(true)}>
          + New Project
        </button>

        {open && <CreateProjectModal onClose={() => setOpen(false)} />}

        <button className="btn outline" onClick={() => setOpenFolder(true)}>
          📁 New Folder
        </button>

        {openFolder && <CreateFolderModal onClose={() => setOpenFolder(false)} />}

      </div>


      {/* SEARCH */}
      <div className="header-search">

        <span className="search-icon">🔍</span>

        <input
          type="text"
          placeholder="Search projects..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

      </div>


      {/* ACTIONS */}
      <div className="header-actions">

        <Filter />
        <ViewSwitch />

      </div>

    </header>
  );
}