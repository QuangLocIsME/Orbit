import { useEffect, useState } from "react";

const DEFAULT = { statuses: [], categories: [] };

const getInitial = () => {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const raw = localStorage.getItem("filters");
    if (!raw) return DEFAULT;
    const parsed = JSON.parse(raw);
    return {
      statuses: Array.isArray(parsed.statuses) ? parsed.statuses : [],
      categories: Array.isArray(parsed.categories) ? parsed.categories : [],
    };
  } catch (e) {
    return DEFAULT;
  }
};

export default function useFilters() {
  const [filters, setFiltersState] = useState(getInitial);

  useEffect(() => {
    try {
      localStorage.setItem("filters", JSON.stringify(filters));
    } catch (e) {}
    try {
      window.dispatchEvent(new CustomEvent("filterchange", { detail: filters }));
    } catch (e) {}
  }, [filters]);

  useEffect(() => {
    const onStorage = (e) => {
      if (!e) return;
      if (e.key === "filters") {
        try {
          const nv = JSON.parse(e.newValue || "{}");
          setFiltersState({
            statuses: Array.isArray(nv.statuses) ? nv.statuses : [],
            categories: Array.isArray(nv.categories) ? nv.categories : [],
          });
        } catch (err) {}
      }
    };
    const onCustom = (e) => {
      if (e && e.detail) setFiltersState(e.detail);
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("filterchange", onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("filterchange", onCustom);
    };
  }, []);

  const setFilters = (next) => setFiltersState(next);

  const toggleStatus = (s) => {
    setFiltersState((cur) => {
      const has = cur.statuses.includes(s);
      return {
        ...cur,
        statuses: has ? cur.statuses.filter((x) => x !== s) : [...cur.statuses, s],
      };
    });
  };

  const toggleCategory = (c) => {
    setFiltersState((cur) => {
      const has = cur.categories.includes(c);
      return {
        ...cur,
        categories: has ? cur.categories.filter((x) => x !== c) : [...cur.categories, c],
      };
    });
  };

  const clearFilters = () => setFiltersState(DEFAULT);

  return { filters, setFilters, toggleStatus, toggleCategory, clearFilters };
}
