import { c as createComponent } from './astro-component_DX-KRSLM.mjs';
import 'piccolore';
import { Q as renderTemplate } from './sequence_COHdm9JL.mjs';
import { r as renderComponent } from './server_0X4XH_4s.mjs';
import { $ as $$DashboardLayout } from './DashboardLayout_8HD29pf8.mjs';
import { jsx, jsxs, Fragment } from 'react/jsx-runtime';
import { useState, useEffect, useMemo } from 'react';
import { c as cn } from './utils_B05Dmz_H.mjs';
import { T as TableSkeleton } from './TableSkeleton_Btc5tDDV.mjs';
import { a as apiFetch } from './api-client_BrBa9f1N.mjs';

const SearchIcon = () => /* @__PURE__ */ jsx("svg", { className: "h-5 w-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" }) });
const RestoreIcon = () => /* @__PURE__ */ jsx("svg", { className: "h-4 w-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" }) });
const DeleteIcon = () => /* @__PURE__ */ jsx("svg", { className: "h-4 w-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M6 18L18 6M6 6l12 12" }) });
const MoreIcon = () => /* @__PURE__ */ jsx("svg", { className: "h-4 w-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" }) });
const ClockIcon = () => /* @__PURE__ */ jsx("svg", { className: "h-4 w-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" }) });
const FolderIcon = () => /* @__PURE__ */ jsx("svg", { className: "h-4 w-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" }) });
const AlertIcon = () => /* @__PURE__ */ jsx("svg", { className: "h-5 w-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" }) });
const TrashEmptyIcon = () => /* @__PURE__ */ jsx("svg", { className: "h-16 w-16 text-muted-foreground/30", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 1.5, d: "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" }) });
function formatTimeAgo(dateString) {
  const date = new Date(dateString);
  const now = /* @__PURE__ */ new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInDays = Math.floor(diffInMs / (1e3 * 60 * 60 * 24));
  if (diffInDays === 0) return "Today";
  if (diffInDays === 1) return "1 day ago";
  if (diffInDays < 7) return `${diffInDays} days ago`;
  if (diffInDays < 14) return "1 week ago";
  return `${Math.floor(diffInDays / 7)} weeks ago`;
}
function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText,
  confirmVariant = "danger"
}) {
  if (!isOpen) return null;
  return /* @__PURE__ */ jsxs("div", { className: "fixed inset-0 z-50 flex items-center justify-center", children: [
    /* @__PURE__ */ jsx("div", { className: "fixed inset-0 bg-black/50 backdrop-blur-sm", onClick: onClose }),
    /* @__PURE__ */ jsxs("div", { className: "relative z-10 w-full max-w-md rounded-xl bg-white p-6 shadow-xl", children: [
      /* @__PURE__ */ jsx("h3", { className: "text-lg font-semibold text-foreground", children: title }),
      /* @__PURE__ */ jsx("p", { className: "mt-2 text-sm text-muted-foreground", children: message }),
      /* @__PURE__ */ jsxs("div", { className: "mt-6 flex justify-end gap-3", children: [
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: onClose,
            className: "rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-gray-100 transition-colors",
            children: "Cancel"
          }
        ),
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: () => {
              onConfirm();
              onClose();
            },
            className: cn(
              "rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors",
              confirmVariant === "danger" ? "bg-red-500 hover:bg-red-600" : "bg-indigo-600 hover:bg-indigo-700"
            ),
            children: confirmText
          }
        )
      ] })
    ] })
  ] });
}
function Toast({ message, type, onClose }) {
  return /* @__PURE__ */ jsxs("div", { className: cn(
    "fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-lg px-4 py-3 shadow-lg transition-all",
    type === "success" ? "bg-green-600 text-white" : "bg-gray-800 text-white"
  ), children: [
    type === "success" && /* @__PURE__ */ jsx("svg", { className: "h-5 w-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M5 13l4 4L19 7" }) }),
    /* @__PURE__ */ jsx("span", { className: "text-sm font-medium", children: message }),
    /* @__PURE__ */ jsx("button", { onClick: onClose, className: "ml-2 hover:opacity-80", children: /* @__PURE__ */ jsx(DeleteIcon, {}) })
  ] });
}
function TrashManager({ initialItems }) {
  const [isHydrated, setIsHydrated] = useState(false);
  const [items, setItems] = useState(initialItems || []);
  const [loading, setLoading] = useState(!initialItems);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItems, setSelectedItems] = useState(/* @__PURE__ */ new Set());
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [toast, setToast] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(null);
  useEffect(() => {
    if (initialItems) {
      setItems(initialItems);
      setLoading(false);
      return;
    }
    const fetchData = async () => {
      try {
        const res = await apiFetch("/api/trash/list");
        if (res.ok) {
          const data = await res.json();
          const mappedItems = (data.data || []).map((item) => ({
            id: item._id,
            name: item.name,
            type: item.type,
            thumbnail: item.thumbnail || "/images/projects/office-complex.jpg",
            deletedAt: item.deletedAt,
            deletedBy: item.deletedBy?.fullName || "Unknown",
            parentFolder: item.parentFolder?.name || null,
            daysUntilPermanentDeletion: item.daysUntilPermanentDeletion
          }));
          setItems(mappedItems);
        }
      } catch (error) {
        console.error("Failed to fetch trash items:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    setIsHydrated(true);
  }, [initialItems]);
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const query = searchQuery.toLowerCase();
    return items.filter(
      (item) => item.name.toLowerCase().includes(query) || item.deletedBy.toLowerCase().includes(query) || item.parentFolder?.toLowerCase().includes(query)
    );
  }, [items, searchQuery]);
  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3e3);
  };
  const toggleSelection = (id) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedItems(newSelected);
  };
  const selectAll = () => {
    if (selectedItems.size === filteredItems.length) {
      setSelectedItems(/* @__PURE__ */ new Set());
    } else {
      setSelectedItems(new Set(filteredItems.map((item) => item.id)));
    }
  };
  const restoreItem = (id) => {
    const item = items.find((i) => i.id === id);
    setItems((prev) => prev.filter((i) => i.id !== id));
    setSelectedItems((prev) => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
    showToast(`"${item?.name}" has been restored`);
  };
  const restoreSelected = () => {
    const count = selectedItems.size;
    setItems((prev) => prev.filter((item) => !selectedItems.has(item.id)));
    setSelectedItems(/* @__PURE__ */ new Set());
    showToast(`${count} item${count > 1 ? "s" : ""} restored`);
  };
  const deleteItemPermanently = (id) => {
    const item = items.find((i) => i.id === id);
    setConfirmDialog({
      isOpen: true,
      title: "Delete permanently?",
      message: `"${item?.name}" will be permanently deleted. This action cannot be undone.`,
      confirmText: "Delete permanently",
      variant: "danger",
      onConfirm: () => {
        setItems((prev) => prev.filter((i) => i.id !== id));
        setSelectedItems((prev) => {
          const newSet = new Set(prev);
          newSet.delete(id);
          return newSet;
        });
        showToast(`"${item?.name}" permanently deleted`);
      }
    });
  };
  const deleteSelectedPermanently = () => {
    const count = selectedItems.size;
    setConfirmDialog({
      isOpen: true,
      title: `Delete ${count} item${count > 1 ? "s" : ""} permanently?`,
      message: `These items will be permanently deleted. This action cannot be undone.`,
      confirmText: "Delete permanently",
      variant: "danger",
      onConfirm: () => {
        setItems((prev) => prev.filter((item) => !selectedItems.has(item.id)));
        setSelectedItems(/* @__PURE__ */ new Set());
        showToast(`${count} item${count > 1 ? "s" : ""} permanently deleted`);
      }
    });
  };
  const emptyTrash = () => {
    if (items.length === 0) return;
    setConfirmDialog({
      isOpen: true,
      title: "Empty trash?",
      message: `All ${items.length} items in trash will be permanently deleted. This action cannot be undone.`,
      confirmText: "Empty trash",
      variant: "danger",
      onConfirm: () => {
        setItems([]);
        setSelectedItems(/* @__PURE__ */ new Set());
        showToast("Trash emptied");
      }
    });
  };
  useEffect(() => {
    setIsHydrated(true);
  }, []);
  if (!isHydrated || loading) return /* @__PURE__ */ jsx(TableSkeleton, { rows: 8, cols: 5 });
  return /* @__PURE__ */ jsxs("div", { className: "space-y-6 py-6 px-6 lg:px-[80px] xl:px-[160px]", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-4", children: [
      /* @__PURE__ */ jsx(
        "button",
        {
          onClick: emptyTrash,
          disabled: items.length === 0,
          className: "rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-medium text-red-500 transition-all hover:bg-red-50 hover:border-red-300 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]",
          children: "Empty Trash"
        }
      ),
      /* @__PURE__ */ jsxs("div", { className: "relative flex-1 max-w-md", children: [
        /* @__PURE__ */ jsx("div", { className: "pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground", children: /* @__PURE__ */ jsx(SearchIcon, {}) }),
        /* @__PURE__ */ jsx(
          "input",
          {
            type: "text",
            placeholder: "Search deleted items...",
            value: searchQuery,
            onChange: (e) => setSearchQuery(e.target.value),
            className: "h-11 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-4 text-sm transition-all placeholder:text-muted-foreground focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          }
        )
      ] }),
      selectedItems.size > 0 && /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 ml-auto", children: [
        /* @__PURE__ */ jsxs("span", { className: "text-sm text-muted-foreground", children: [
          selectedItems.size,
          " selected"
        ] }),
        /* @__PURE__ */ jsxs(
          "button",
          {
            onClick: restoreSelected,
            className: "flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors",
            children: [
              /* @__PURE__ */ jsx(RestoreIcon, {}),
              "Restore"
            ]
          }
        ),
        /* @__PURE__ */ jsxs(
          "button",
          {
            onClick: deleteSelectedPermanently,
            className: "flex items-center gap-2 rounded-lg bg-red-500 px-3 py-2 text-sm font-medium text-white hover:bg-red-600 transition-colors",
            children: [
              /* @__PURE__ */ jsx(DeleteIcon, {}),
              "Delete"
            ]
          }
        )
      ] })
    ] }),
    filteredItems.length > 0 ? /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 px-4 py-2", children: [
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: selectAll,
            className: cn(
              "h-5 w-5 rounded border-2 transition-colors flex items-center justify-center",
              selectedItems.size === filteredItems.length && filteredItems.length > 0 ? "border-indigo-600 bg-indigo-600" : "border-gray-300 hover:border-gray-400"
            ),
            children: selectedItems.size === filteredItems.length && filteredItems.length > 0 && /* @__PURE__ */ jsx("svg", { className: "h-3 w-3 text-white", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 3, d: "M5 13l4 4L19 7" }) })
          }
        ),
        /* @__PURE__ */ jsxs("span", { className: "text-sm text-muted-foreground", children: [
          filteredItems.length,
          " item",
          filteredItems.length !== 1 ? "s" : "",
          " in trash"
        ] })
      ] }),
      filteredItems.map((item) => /* @__PURE__ */ jsxs(
        "div",
        {
          className: cn(
            "flex items-center gap-4 rounded-xl border bg-white px-4 py-3 transition-all",
            selectedItems.has(item.id) ? "border-indigo-200 bg-indigo-50/50" : "border-gray-100 hover:border-gray-200 hover:shadow-sm"
          ),
          children: [
            /* @__PURE__ */ jsx(
              "button",
              {
                onClick: () => toggleSelection(item.id),
                className: cn(
                  "h-5 w-5 shrink-0 rounded border-2 transition-colors flex items-center justify-center",
                  selectedItems.has(item.id) ? "border-indigo-600 bg-indigo-600" : "border-gray-300 hover:border-gray-400"
                ),
                children: selectedItems.has(item.id) && /* @__PURE__ */ jsx("svg", { className: "h-3 w-3 text-white", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 3, d: "M5 13l4 4L19 7" }) })
              }
            ),
            /* @__PURE__ */ jsx("div", { className: "h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-muted", children: /* @__PURE__ */ jsx(
              "img",
              {
                src: item.thumbnail,
                alt: item.name,
                className: "h-full w-full object-cover"
              }
            ) }),
            /* @__PURE__ */ jsxs("div", { className: "flex-1 min-w-0", children: [
              /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
                /* @__PURE__ */ jsx("h3", { className: "font-medium text-foreground truncate", children: item.name }),
                /* @__PURE__ */ jsx("span", { className: cn(
                  "shrink-0 rounded px-2 py-0.5 text-xs font-medium",
                  item.type === "folder" ? "bg-gray-100 text-gray-600" : "bg-blue-50 text-blue-600"
                ), children: item.type === "folder" ? "Folder" : "Project" })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground", children: [
                /* @__PURE__ */ jsxs("span", { className: "flex items-center gap-1.5", children: [
                  /* @__PURE__ */ jsx(ClockIcon, {}),
                  "Deleted ",
                  formatTimeAgo(item.deletedAt)
                ] }),
                /* @__PURE__ */ jsxs("span", { children: [
                  "by ",
                  item.deletedBy
                ] }),
                item.parentFolder && /* @__PURE__ */ jsxs("span", { className: "flex items-center gap-1.5", children: [
                  /* @__PURE__ */ jsx(FolderIcon, {}),
                  item.parentFolder
                ] })
              ] })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-1", children: [
              /* @__PURE__ */ jsx(
                "button",
                {
                  onClick: () => restoreItem(item.id),
                  className: "rounded-lg p-2 text-muted-foreground hover:bg-gray-100 hover:text-foreground transition-colors",
                  title: "Restore",
                  children: /* @__PURE__ */ jsx(RestoreIcon, {})
                }
              ),
              /* @__PURE__ */ jsx(
                "button",
                {
                  onClick: () => deleteItemPermanently(item.id),
                  className: "rounded-lg p-2 text-muted-foreground hover:bg-red-50 hover:text-red-500 transition-colors",
                  title: "Delete permanently",
                  children: /* @__PURE__ */ jsx(DeleteIcon, {})
                }
              ),
              /* @__PURE__ */ jsxs("div", { className: "relative", children: [
                /* @__PURE__ */ jsx(
                  "button",
                  {
                    onClick: () => setDropdownOpen(dropdownOpen === item.id ? null : item.id),
                    className: "rounded-lg p-2 text-muted-foreground hover:bg-gray-100 hover:text-foreground transition-colors",
                    children: /* @__PURE__ */ jsx(MoreIcon, {})
                  }
                ),
                dropdownOpen === item.id && /* @__PURE__ */ jsxs(Fragment, { children: [
                  /* @__PURE__ */ jsx(
                    "div",
                    {
                      className: "fixed inset-0 z-10",
                      onClick: () => setDropdownOpen(null)
                    }
                  ),
                  /* @__PURE__ */ jsxs("div", { className: "absolute right-0 top-full z-20 mt-1 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg", children: [
                    /* @__PURE__ */ jsxs(
                      "button",
                      {
                        onClick: () => {
                          restoreItem(item.id);
                          setDropdownOpen(null);
                        },
                        className: "flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-gray-50",
                        children: [
                          /* @__PURE__ */ jsx(RestoreIcon, {}),
                          "Restore item"
                        ]
                      }
                    ),
                    /* @__PURE__ */ jsxs(
                      "button",
                      {
                        onClick: () => {
                          deleteItemPermanently(item.id);
                          setDropdownOpen(null);
                        },
                        className: "flex w-full items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50",
                        children: [
                          /* @__PURE__ */ jsx(DeleteIcon, {}),
                          "Delete permanently"
                        ]
                      }
                    )
                  ] })
                ] })
              ] })
            ] })
          ]
        },
        item.id
      ))
    ] }) : items.length === 0 ? (
      /* Empty state - no items in trash */
      /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-center justify-center py-20", children: [
        /* @__PURE__ */ jsx(TrashEmptyIcon, {}),
        /* @__PURE__ */ jsx("h3", { className: "mt-4 text-lg font-medium text-foreground", children: "Trash is empty" }),
        /* @__PURE__ */ jsx("p", { className: "mt-1 text-sm text-muted-foreground", children: "Items you delete will appear here for 30 days before being permanently removed." })
      ] })
    ) : (
      /* No search results */
      /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-center justify-center py-20", children: [
        /* @__PURE__ */ jsx(SearchIcon, {}),
        /* @__PURE__ */ jsx("h3", { className: "mt-4 text-lg font-medium text-foreground", children: "No items found" }),
        /* @__PURE__ */ jsx("p", { className: "mt-1 text-sm text-muted-foreground", children: "Try adjusting your search query" })
      ] })
    ),
    items.length > 0 && /* @__PURE__ */ jsx("div", { className: "rounded-xl border border-amber-200 bg-amber-50 p-4", children: /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-3", children: [
      /* @__PURE__ */ jsx("div", { className: "shrink-0 text-amber-600", children: /* @__PURE__ */ jsx(AlertIcon, {}) }),
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("h4", { className: "font-medium text-amber-800", children: "Auto-deletion in 30 days" }),
        /* @__PURE__ */ jsx("p", { className: "mt-1 text-sm text-amber-700", children: "Items in trash will be permanently deleted after 30 days. Restore them before they're gone forever." })
      ] })
    ] }) }),
    confirmDialog && /* @__PURE__ */ jsx(
      ConfirmDialog,
      {
        isOpen: confirmDialog.isOpen,
        onClose: () => setConfirmDialog(null),
        onConfirm: confirmDialog.onConfirm,
        title: confirmDialog.title,
        message: confirmDialog.message,
        confirmText: confirmDialog.confirmText,
        confirmVariant: confirmDialog.variant
      }
    ),
    toast && /* @__PURE__ */ jsx(
      Toast,
      {
        message: toast.message,
        type: toast.type,
        onClose: () => setToast(null)
      }
    )
  ] });
}

const prerender = false;
const $$Trash = createComponent(($$result, $$props, $$slots) => {
  return renderTemplate`${renderComponent($$result, "DashboardLayout", $$DashboardLayout, { "title": "Trash - ORBIT", "pageTitle": "Trash" }, { "default": ($$result2) => renderTemplate` ${renderComponent($$result2, "TrashManager", TrashManager, { "client:load": true, "client:component-hydration": "load", "client:component-path": "@/components/features/TrashManager", "client:component-export": "default" })} ` })}`;
}, "D:/DoAnTotNghiep/BIM_Project_Final/Orbit/Frontend/src/pages/trash.astro", void 0);

const $$file = "D:/DoAnTotNghiep/BIM_Project_Final/Orbit/Frontend/src/pages/trash.astro";
const $$url = "/trash";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Trash,
  file: $$file,
  prerender,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
