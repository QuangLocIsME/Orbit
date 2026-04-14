import { jsxs, jsx } from 'react/jsx-runtime';
import { S as Skeleton } from './skeleton_Bm27Yo3I.mjs';

function TableSkeleton({ rows = 6, cols = 4 }) {
  return /* @__PURE__ */ jsxs("div", { className: "flex-1 overflow-y-auto p-6 space-y-4", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
      /* @__PURE__ */ jsx(Skeleton, { className: "h-7 w-32" }),
      /* @__PURE__ */ jsx(Skeleton, { className: "h-9 w-28 rounded-lg" })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "rounded-xl border bg-card overflow-hidden", children: [
      /* @__PURE__ */ jsx("div", { className: "flex items-center gap-4 px-4 py-3 border-b bg-muted/40", children: Array.from({ length: cols }).map((_, i) => /* @__PURE__ */ jsx(Skeleton, { className: "h-3.5 flex-1" }, i)) }),
      Array.from({ length: rows }).map((_, i) => /* @__PURE__ */ jsx("div", { className: "flex items-center gap-4 px-4 py-3.5 border-b last:border-0", children: Array.from({ length: cols }).map((_2, j) => /* @__PURE__ */ jsx(Skeleton, { className: `h-4 flex-1 ${j === 0 ? "max-w-[180px]" : ""}` }, j)) }, i))
    ] })
  ] });
}

export { TableSkeleton as T };
