import { useEffect, useState } from "react";

const getInitial = () => {
  if (typeof window === "undefined") return "grid";
  try {
    const stored = localStorage.getItem("view");
    if (stored === "list" || stored === "grid") return stored;
  } catch (e) {
    /* ignore */
  }
  return "grid";
};

export default function useViewMode() {
  const [view, setViewState] = useState(getInitial);

  useEffect(() => {
    try {
      localStorage.setItem("view", view);
    } catch (e) {
      /* ignore */
    }
    try {
      window.dispatchEvent(new CustomEvent("viewchange", { detail: view }));
    } catch (e) {
      /* ignore */
    }
  }, [view]);

  useEffect(() => {
    const onStorage = (e) => {
      if (!e) return;
      if (e.key === "view") {
        setViewState(e.newValue === "list" ? "list" : "grid");
      }
    };
    const onCustom = (e) => {
      if (e && e.detail) setViewState(e.detail === "list" ? "list" : "grid");
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("viewchange", onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("viewchange", onCustom);
    };
  }, []);

  const setView = (v) => setViewState(v === "list" ? "list" : "grid");
  return [view, setView];
}
