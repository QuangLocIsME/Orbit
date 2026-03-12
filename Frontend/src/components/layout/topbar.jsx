import { ModeToggle } from "../ui/mode-toggle";

function getTitle(path) {
  if (!path) return "Home";

  const segments = path.split("/").filter(Boolean);
  if (segments.length === 0) return "Home";

  const first = segments[0];
  return first.charAt(0).toUpperCase() + first.slice(1);
}

export default function Topbar({ currentPath }) {
  const title = getTitle(currentPath);

  return (
    <header className="topbar">
      <div className="topbar-left">
        <h3>{title}</h3>
      </div>

      <div className="topbar-right">
        <ModeToggle />
        <button className="icon-btn">🔔</button>
        <button className="icon-btn">⚙</button>
      </div>
    </header>
  );
}