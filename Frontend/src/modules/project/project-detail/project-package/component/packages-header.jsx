import { useEffect, useState } from "react";
import { getPackageStats } from "../service/project-package-service";
import useViewMode from "../../../../../hooks/use-view-mode";
import ViewSwitch from "../../../component/view-switch";

export default function PackagesHeader({ projectId }) {

  const [stats, setStats] = useState(null);
  const [view, setView] = useViewMode();

  useEffect(() => {
    const loadData = async () => {
      const data = await getPackageStats(projectId);
      setStats(data);
    };

    loadData();
  }, [projectId]);

  if (!stats) return <div className="packages-loading">Loading...</div>;

  const cards = [
    { label: "Total", value: stats.total, className: "total" },
    { label: "Active", value: stats.active, className: "active" },
    { label: "Completed", value: stats.completed, className: "completed" },
    { label: "On Hold", value: stats.onHold, className: "hold" }
  ];

  return (
    <div className="packages-container">

      <div className="packages-header">
        <div>
          <h2>Packages</h2>
          <p>Manage and organize project components</p>
        </div>

        <button className="new-package-btn">
          + New Package
        </button>
      </div>

      <div className="packages-stats">
        {cards.map((card) => (
          <div key={card.label} className={`stat-card ${card.className}`}>
            <span className="stat-number">{card.value}</span>
            <span className="stat-label">{card.label}</span>
          </div>
        ))}
      </div>

      <div className="packages-toolbar">

        <input
          className="package-search"
          placeholder="Search packages..."
        />

        <ViewSwitch view={view} setView={setView} />

      </div>

    </div>
  );
}