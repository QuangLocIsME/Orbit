import { useEffect, useState } from "react";
import { getProjectPackages } from "../../../../services/project-package-service";
import useViewMode from "../../../../hooks/use-view-mode";
import ViewAdapter from "../../../ui/view-adapter";

import PackageCard from "./package-card";
import PackageListItem from "./package-list-item";

export default function PackagesSection({ projectId }) {

  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);

  const [view] = useViewMode();
  console.log("view mode:", view);

  useEffect(() => {
  const load = async () => {
    try {
      const data = await getProjectPackages(projectId);
      setPackages(data);
    } catch (err) {
      console.error("Failed to load packages", err);
    } finally {
      setLoading(false);
    }
  };

  load();
}, [projectId]);

  if (loading) {
    return (
      <section className="packages-section">
        <p className="package-loading">Loading packages...</p>
      </section>
    );
  }

  return (
    <section className="packages-section">

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