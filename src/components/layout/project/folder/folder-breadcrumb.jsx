export default function FolderBreadcrumb({ folderName }) {
  return (
    <nav className="folder-breadcrumb">
      <a href="/project" className="breadcrumb-item">
        <span className="breadcrumb-arrow">←</span>
        <span>Projects</span>
      </a>
      <span className="breadcrumb-sep">›</span>
      <span className="breadcrumb-current">{folderName}</span>
    </nav>
  );
}
