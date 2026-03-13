import { useEffect, useState } from "react";
import { getPriorityProjects } from "../../../project-page/service/project-priority-service";
import useViewMode from "../../../../../hooks/use-view-mode";
import useFilters from "../../../../../hooks/use-filters";
import ViewAdapter from "../../../component/view-adapter";
import ProjectCard from "./project-card";
import ProjectListItem from "./project-list-item";

export default function PrioritySection() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view] = useViewMode();
  const { filters } = useFilters();

  useEffect(() => {
    getPriorityProjects().then((data) => {
      setProjects(data);
      setLoading(false);
    });
  }, []);

  if (loading) return (
    <section className="priority-section">
      <h3>Priority Projects</h3>
      <p className="project-loading">Loading...</p>
    </section>
  );

  return (
    <section className="priority-section">
      <h3>Priority Projects</h3>

      {projects.length === 0 ? (
        <p className="project-empty">No projects yet</p>
      ) : (
        (() => {
          const filtered = projects.filter((p) => {
            const statusMatch = !filters.statuses || filters.statuses.length === 0 || (p.status && filters.statuses.includes(p.status));
            const categoryMatch = !filters.categories || filters.categories.length === 0 || (p.category && filters.categories.includes(p.category));
            return statusMatch && categoryMatch;
          });

          return (
            <ViewAdapter
              items={filtered}
              view={view}
              gridClass="project-grid"
              listClass="project-list"
              renderGridItem={(p) => <ProjectCard key={p.id} project={p} />}
              renderListItem={(p) => <ProjectListItem key={p.id} project={p} />}
            />
          );
        })()
      )}
    </section>
  );
}
