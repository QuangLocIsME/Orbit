import React, { useState, useEffect } from "react";

export default function ProjectTabs({
  tabs = [
    "Overview",
    "Packages",
    "Documents",
    "Versions",
    "Changes",
    "Tasks",
    "Clashes",
    "Teams",
    "Extensions",
    "Settings",
  ],
  onChange,
}) {
  const [active, setActive] = useState("Overview");

  // detect active tab from URL
  useEffect(() => {
    const path = window.location.pathname.toLowerCase();

    if (path.includes("packages")) setActive("Packages");
    else if (path.includes("documents")) setActive("Documents");
    else if (path.includes("versions")) setActive("Versions");
    else if (path.includes("changes")) setActive("Changes");
    else if (path.includes("tasks")) setActive("Tasks");
    else if (path.includes("clashes")) setActive("Clashes");
    else if (path.includes("teams")) setActive("Teams");
    else if (path.includes("extensions")) setActive("Extensions");
    else if (path.includes("settings")) setActive("Settings");
    else setActive("Overview");
  }, []);

 function handle(tab) {
  const parts = window.location.pathname.split("/");
  const projectId = parts[2];

  let url = `/projects/${projectId}`;

  if (tab === "Packages") {
    url = `/projects/${projectId}/packages`;
  }

  window.location.href = url;
}

  return (
    <nav className="project-topnav" aria-label="Project navigation">
      <ul className="project-tabs">
        {tabs.map((t) => (
          <li
            key={t}
            className={`project-tab ${t === active ? "active" : ""}`}
            onClick={() => handle(t)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && handle(t)}
          >
            {t}
          </li>
        ))}
      </ul>
    </nav>
  );
}