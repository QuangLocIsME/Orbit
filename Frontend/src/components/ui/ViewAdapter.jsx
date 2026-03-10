import React from "react";

export default function ViewAdapter({ items, view, renderGridItem, renderListItem, gridClass = "", listClass = "" }) {
  if (!Array.isArray(items)) return null;

  return view === "list" ? (
    <div className={listClass}>
      {items.map((it) => renderListItem(it))}
    </div>
  ) : (
    <div className={gridClass}>
      {items.map((it) => renderGridItem(it))}
    </div>
  );
}
