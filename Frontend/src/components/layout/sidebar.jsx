export default function Sidebar({
  user,
  favorites = [],
  shared = [],
  privateProjects = [],
  currentPath = ""
}) {
  const path = currentPath || (typeof window !== "undefined" ? window.location.pathname : "");
  return (
    <aside className="sidebar">

      {/* USER */}
      <div className="sidebar-user">
        <div className="avatar">
          {user?.name?.charAt(0)}
        </div>
        <span>{user?.name}</span>
      </div>

      {/* MAIN MENU */}
      <nav className="menu">

        <a
          href="/home"
          className={`menu-item ${path === "/" || path === "/home" ? "active" : ""}`}
        >
          Home
        </a>

        <a
          href="/project"
          className={`menu-item ${path.startsWith("/project") ? "active" : ""}`}
        >
          Projects
        </a>

      </nav>

      {/* FAVORITES */}
      <div className="menu-group">
        <h4>Favorites</h4>
        {favorites.map(p => (
          <a
            className="menu-item"
            href={`/project/${p.id}`}
            key={p.id}
          >
            {p.name}
          </a>
        ))}
      </div>

      {/* SHARED */}
      <div className="menu-group">
        <h4>Shared</h4>
        {shared.map(p => (
          <a
            className="menu-item"
            href={`/project/${p.id}`}
            key={p.id}
          >
            {p.name}
          </a>
        ))}
      </div>

      {/* PRIVATE */}
      <div className="menu-group">
        <h4>Private</h4>
        {privateProjects.map(p => (
          <a
            className="menu-item"
            href={`/project/${p.id}`}
            key={p.id}
          >
            {p.name}
          </a>
        ))}
      </div>

    </aside>
  );
}