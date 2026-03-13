import { useEffect, useState } from "react";
import { getProjectPackages } from "../../../../services/project-package-service";
import useViewMode from "../../../../hooks/use-view-mode";
import ViewAdapter from "../../../ui/view-adapter";
import PackageCard from "./package-card";
import PackageListItem from "./package-list-item";

export default function PackagesSection() {

  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);

  const [view] = useViewMode(); // FIX

  useEffect(() => {
    getProjectPackages().then((data) => {
      setPackages(data || []);
      setLoading(false);
    });
  }, []);

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
          view={view}   // FIX
          gridClass="packages-grid"
          listClass="packages-list"

          renderGridItem={(pkg) => (
            <PackageCard key={pkg.id} package={pkg} />   // FIX
          )}

          renderListItem={(pkg) => (
            <PackageListItem key={pkg.id} package={pkg} />
          )}
        />
      )}
    </section>
  );
}