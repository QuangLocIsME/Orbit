import { useEffect, useState } from "react";
import { getFolders } from "../service/folder-service";
import useViewMode from "../../../../hooks/use-view-mode";
import ViewAdapter from "../../component/view-adapter";
import FolderCard from "./folder-card";
import FolderListItem from "./folder-list-item";

export default function FoldersSection() {
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view] = useViewMode();

  useEffect(() => {
    getFolders().then((data) => {
      setFolders(data);
      setLoading(false);
    });
  }, []);

  if (loading) return (
    <section className="folders-section">
      <h3>Folders</h3>
      <p className="folder-loading">Loading...</p>
    </section>
  );

  return (
    <section className="folders-section">
      <h3>Folders</h3>

      {folders.length === 0 ? (
        <p className="folder-empty">No folders yet</p>
      ) : (
        <ViewAdapter
          items={folders}
          view={view}
          gridClass="folder-grid"
          listClass="folder-list"
          renderGridItem={(f) => <FolderCard key={f.id} folder={f} />}
          renderListItem={(f) => <FolderListItem key={f.id} folder={f} />}
        />
      )}
    </section>
  );
}
