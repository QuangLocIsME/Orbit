import React from "react";
import useViewMode from "../../../hooks/use-view-mode";

export default function ViewSwitch({ className }) {
  const [view, setView] = useViewMode();

  return (
    <div className={className ? className + " view-switch" : "view-switch"}>
      <button
        className={`view-btn ${view === "list" ? "active" : ""}`}
        onClick={() => setView("list")}
        aria-label="List view"
      >
        ☰
      </button>

      <button
        className={`view-btn ${view === "grid" ? "active" : ""}`}
        onClick={() => setView("grid")}
        aria-label="Grid view"
      >
        ▦
      </button>
    </div>
  );
}
