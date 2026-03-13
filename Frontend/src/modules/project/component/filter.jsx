import React from "react";
import DropdownMenu, { DropdownMenuTrigger, DropdownMenuContent } from "./dropdown-menu";
import useFilters from "../../../hooks/use-filters";

const STATUSES = ["Active", "Review", "Completed", "Archived"];
const CATEGORIES = ["Construction", "Design", "Research", "Other"];

export default function Filter({ className }) {
  const { filters, toggleStatus, toggleCategory, clearFilters } = useFilters();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className={className ? className + " btn outline" : "btn outline"} aria-label="Filters">
          ⚙ Filter
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        <div style={{ padding: 8, minWidth: 220 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Status</div>
          {STATUSES.map((s) => (
            <label key={s} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <input
                type="checkbox"
                checked={filters.statuses.includes(s)}
                onChange={() => toggleStatus(s)}
              />
              <span>{s}</span>
            </label>
          ))}

          <div style={{ height: 8 }} />
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Category</div>
          {CATEGORIES.map((c) => (
            <label key={c} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <input
                type="checkbox"
                checked={filters.categories.includes(c)}
                onChange={() => toggleCategory(c)}
              />
              <span>{c}</span>
            </label>
          ))}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
            <button onClick={clearFilters} style={{ padding: "6px 8px" }}>Clear</button>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
