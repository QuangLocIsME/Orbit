import { useEffect, useState } from "react";
import { getFolderProjects } from "../service/folder-project-service";
import useViewMode from "../../../../hooks/use-view-mode";
import ViewAdapter from "../../component/view-adapter";
import ProjectListItem from "../../project-detail/project-overview/component/project-list-item";

const STATUS_COLORS = {
  active: "#00BC7D",
  review: "#FE9A00",
  planning: "#6A7282",
};

const CATEGORY_STYLES = {
  software: { bg: "#DBEAFE", color: "#155DFC" },
  design: { bg: "#F3E8FF", color: "#9810FA" },
  construction: { bg: "#D1FAE5", color: "#059669" },
};

export default function FolderProjectGrid({ folderId }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view] = useViewMode();

  useEffect(() => {
    if (!folderId) return;
    getFolderProjects(folderId).then((data) => {
      setProjects(data);
      setLoading(false);
    });
  }, [folderId]);

  if (loading) return <p className="folder-grid-loading">Loading...</p>;
  if (projects.length === 0) return <p className="folder-grid-empty">No projects in this folder</p>;

  const renderGridItem = (p) => {
    const statusColor = STATUS_COLORS[p.status] || STATUS_COLORS.planning;
    const catStyle = CATEGORY_STYLES[p.category] || CATEGORY_STYLES.software;
    return (
      <a href={`/projects/${p.id}`} className="folder-project-card" key={p.id}>
        <div className="folder-card-image">
          {p.image ? (
            <img src={p.image} alt={p.name} />
          ) : (
            <div
              className="folder-card-img-placeholder"
              style={{ background: "#F3F4F6" }}
            />
          )}

          <div className="folder-card-overlay" />

          <span
            className="folder-card-status"
            style={{ background: statusColor }}
          >
            {p.status}
          </span>

          <span
            className="folder-card-category"
            style={{
              background: catStyle.bg,
              color: catStyle.color,
              borderColor: "rgba(255,255,255,0.3)",
            }}
          >
            {p.category}
          </span>
        </div>
        <div className="folder-card-body">
          <h4>{p.name}</h4>
          <p>{p.description}</p>
          <div className="folder-card-progress">
            <div className="progress-row">
              <span>Progress</span>
              <span>{p.progress}%</span>
            </div>
            <div className="progress-bar">
              <div
                className="progress"
                style={{ width: `${p.progress}%` }}
              />
            </div>
          </div>
          <div className="folder-card-metrics">
            <span>👥 {p.members}</span>
            <span>⚠ {p.issues}</span>
            <span>🕐 {p.updatedAt}</span>
          </div>
        </div>
      </a>
    );
  };

  return (
    <ViewAdapter
      items={projects}
      view={view}
      gridClass="folder-project-grid"
      listClass="folder-project-list"
      renderGridItem={renderGridItem}
      renderListItem={(p) => <ProjectListItem key={p.id} project={p} />}
    />
  );
}
