import { useEffect, useState } from "react";
import { getProjectPackages } from "../service/project-package-service";
import useViewMode from "../../../../../hooks/use-view-mode";
import ViewAdapter from "../../../component/view-adapter";
import PackageCard from "./package-card";
import PackageListItem from "./package-list-item";

export default function PackagesSection({ projectId }) {

  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);

  const [view] = useViewMode();

  useEffect(() => {
    if (projectId) {
      getProjectPackages(projectId).then((data) => {
        setPackages(data || []);
        setLoading(false);
      });
    }
  }, [projectId]);

  if (loading) {
    return (
      <section className="package-section">
        <h3>Packages</h3>
        <p className="package-loading">Loading...</p>
      </section>
    );
  }

  return (
    <section className="package-section">
      <h3>Packages</h3>

      {packages.length === 0 ? (
        <p className="package-empty">No packages yet</p>
      ) : (
        <ViewAdapter
          items={packages}
          view={view}
          gridClass="packages-grid"
          listClass="packages-list"

          renderGridItem={(pkg) => (
            <PackageCard key={pkg.id} package={pkg} />
          )}

          renderListItem={(pkg) => (
            <PackageListItem key={pkg.id} package={pkg} />
          )}
        />
      )}
    </section>
  );
}