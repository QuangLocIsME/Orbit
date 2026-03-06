import React, { useState } from "react";

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
  initial = "Overview",
  onChange,
}) {
  const [active, setActive] = useState(initial);

  function handle(tab) {
    setActive(tab);
    if (onChange) onChange(tab);
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
