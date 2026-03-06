import { useEffect, useState } from "react";
import { getFolders } from "../../../services/folder-service";

export default function FoldersSection() {
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getFolders().then((data) => {
      setFolders(data);
      setLoading(false);
    });
  }, []);

  return (
    <section className="folders-section">
      <h3>Folders</h3>

      <div className="folder-grid">
        {loading ? (
          <p className="folder-loading">Loading...</p>
        ) : folders.length === 0 ? (
          <p className="folder-empty">No folders yet</p>
        ) : (
          folders.map((folder) => (
            <a
              href={`/projects/folders/${folder.id}`}
              className="folder-card"
              key={folder.id}
            >
              <div className="folder-icon"></div>
              <div className="folder-info">
                <p className="folder-title">{folder.name}</p>
                <span className="folder-count">
                  {folder.projectCount ?? 0} projects
                </span>
              </div>
            </a>
          ))
        )}
      </div>
    </section>
  );
}
