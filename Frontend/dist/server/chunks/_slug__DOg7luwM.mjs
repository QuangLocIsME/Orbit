import { c as createComponent } from './astro-component_DX-KRSLM.mjs';
import 'piccolore';
import { bb as renderHead, bc as renderSlot, Q as renderTemplate } from './sequence_COHdm9JL.mjs';
import { r as renderComponent } from './server_CjntUweB.mjs';
import { P as ProjectTopBar } from './ProjectTopBar_Cn37Yx3M.mjs';
import { jsx, jsxs } from 'react/jsx-runtime';
import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { a as apiFetch } from './api-client_BrBa9f1N.mjs';
import { FolderPlus, Upload, Image, FileText } from 'lucide-react';

const $$PackageLayout = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$props, $$slots);
  Astro2.self = $$PackageLayout;
  const {
    title = "ORBIT - Package Detail",
    projectName,
    projectSlug,
    packageName
  } = Astro2.props;
  return renderTemplate`<html lang="en"> <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><link rel="icon" type="image/svg+xml" href="/favicon.svg"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"><title>${title}</title>${renderHead()}</head> <body class="min-h-screen font-sans bg-white"> <!-- Project Top Bar with tabs --> ${renderComponent($$result, "ProjectTopBar", ProjectTopBar, { "projectName": projectName, "projectSlug": projectSlug, "packageName": packageName, "client:load": true, "client:component-hydration": "load", "client:component-path": "@/components/layout/ProjectTopBar", "client:component-export": "default" })} <!-- Main Content (no sidebar, centered with margins) --> <main class="min-h-[calc(100vh-130px)]"> ${renderSlot($$result, $$slots["default"])} </main></body></html>`;
}, "D:/DoAnTotNghiep/BIM_Project_Final/Orbit/Frontend/src/layouts/PackageLayout.astro", void 0);

function PackageDetailPage({ packageId }) {
  const [loading, setLoading] = useState(true);
  const [pkg, setPkg] = useState(null);
  const [documentsTree, setDocumentsTree] = useState(null);
  const [selectedFolderType, setSelectedFolderType] = useState("files");
  const [folderName, setFolderName] = useState("");
  const [parentPath, setParentPath] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadFolderPath, setUploadFolderPath] = useState("");
  const projectId = pkg?.projectId || "";
  const loadPackage = async () => {
    const projectsRes = await apiFetch("/api/projects/me");
    if (!projectsRes.ok) throw new Error("Không thể tải projects");
    const projectPayload = await projectsRes.json();
    const projects = Array.isArray(projectPayload?.data) ? projectPayload.data : [];
    for (const project of projects) {
      const listRes = await apiFetch("/api/projects/packages/list", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ projectId: project.publicId, listType: "all" })
      });
      if (!listRes.ok) continue;
      const payload = await listRes.json();
      const items = Array.isArray(payload?.data) ? payload.data : [];
      const found = items.find((p) => p.publicId === packageId);
      if (found) {
        setPkg(found);
        return found;
      }
    }
    throw new Error("Không tìm thấy package hoặc bạn không có quyền truy cập");
  };
  const loadDocuments = async (pid) => {
    const res = await apiFetch("/api/projects/packages/documents/list", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ projectId: pid })
    });
    if (!res.ok) throw new Error("Không thể tải documents");
    const payload = await res.json();
    const root = payload?.data?.tree;
    const packageNode = root?.children?.find((node) => node.id?.includes(`/pkg/${packageId}`));
    setDocumentsTree(packageNode || null);
  };
  const refresh = async () => {
    setLoading(true);
    try {
      const found = await loadPackage();
      if (found?.projectId) {
        await loadDocuments(found.projectId);
      }
    } catch (err) {
      toast.error(err?.message || "Không thể tải package");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    refresh();
  }, [packageId]);
  const folderOptions = useMemo(() => {
    const options = [""];
    const walk = (node) => {
      if (!node || node.type !== "folder") return;
      if (node.children) {
        for (const child of node.children) {
          if (child.type === "folder") {
            options.push(child.name);
            walk(child);
          }
        }
      }
    };
    walk(documentsTree || void 0);
    return Array.from(new Set(options));
  }, [documentsTree]);
  const createFolder = async () => {
    if (!projectId) return toast.error("Missing project");
    if (!folderName.trim()) return toast.error("Tên folder bắt buộc");
    const res = await apiFetch("/api/projects/packages/documents/folders/create", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        projectId,
        packageId,
        folderType: selectedFolderType,
        folderName: folderName.trim(),
        parentPath: parentPath.trim()
      })
    });
    const payload = await res.json().catch(() => null);
    if (!res.ok || !payload?.success) {
      throw new Error(payload?.message || "Tạo folder thất bại");
    }
    setFolderName("");
    setParentPath("");
    await loadDocuments(projectId);
  };
  const uploadDocument = async () => {
    if (!projectId) return toast.error("Missing project");
    if (!uploadFile) return toast.error("Vui lòng chọn file");
    const formData = new FormData();
    formData.append("projectId", projectId);
    formData.append("packageId", packageId);
    formData.append("folderType", uploadFile.type.startsWith("image/") ? "images" : "files");
    formData.append("folderPath", uploadFolderPath.trim());
    formData.append("file", uploadFile);
    setUploading(true);
    try {
      const res = await apiFetch("/api/projects/packages/upload", {
        method: "POST",
        body: formData
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.success) {
        throw new Error(payload?.message || "Upload thất bại");
      }
      toast.success(payload?.mode === "queue" ? "File lớn đã đưa vào queue xử lý nền" : "Upload thành công");
      setUploadFile(null);
      setUploadFolderPath("");
      await loadDocuments(projectId);
    } finally {
      setUploading(false);
    }
  };
  const renderNode = (node) => {
    if (node.type === "file") {
      return /* @__PURE__ */ jsx("li", { className: "ml-6 py-1 text-sm text-gray-700", children: /* @__PURE__ */ jsxs("a", { href: node.s3Url || "#", target: "_blank", rel: "noreferrer", className: "inline-flex items-center gap-2 hover:text-blue-600", children: [
        node.category === "Image" ? /* @__PURE__ */ jsx(Image, { className: "h-4 w-4" }) : /* @__PURE__ */ jsx(FileText, { className: "h-4 w-4" }),
        node.name
      ] }) }, node.id);
    }
    return /* @__PURE__ */ jsxs("li", { className: "py-1", children: [
      /* @__PURE__ */ jsx("div", { className: "font-medium text-gray-800", children: node.name }),
      node.children && node.children.length > 0 && /* @__PURE__ */ jsx("ul", { className: "ml-4 border-l border-gray-200 pl-3", children: node.children.map((child) => renderNode(child)) })
    ] }, node.id);
  };
  if (loading) {
    return /* @__PURE__ */ jsx("div", { className: "px-6 py-8 text-sm text-gray-500", children: "Loading package..." });
  }
  if (!pkg) {
    return /* @__PURE__ */ jsx("div", { className: "px-6 py-8 text-sm text-red-600", children: "Không tìm thấy package." });
  }
  return /* @__PURE__ */ jsxs("div", { className: "space-y-6 px-6 py-6 lg:px-[80px] xl:px-[160px]", children: [
    /* @__PURE__ */ jsxs("div", { children: [
      /* @__PURE__ */ jsx("h1", { className: "text-2xl font-semibold text-gray-900", children: pkg.name }),
      /* @__PURE__ */ jsx("p", { className: "mt-1 text-sm text-gray-600", children: pkg.description || "No description" })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "grid gap-4 rounded-xl border border-gray-200 bg-white p-4 md:grid-cols-2", children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("p", { className: "mb-2 text-sm font-medium text-gray-900", children: "Create Folder" }),
        /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
          /* @__PURE__ */ jsxs(
            "select",
            {
              value: selectedFolderType,
              onChange: (e) => setSelectedFolderType(e.target.value),
              className: "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm",
              children: [
                /* @__PURE__ */ jsx("option", { value: "files", children: "Files" }),
                /* @__PURE__ */ jsx("option", { value: "images", children: "Images" })
              ]
            }
          ),
          /* @__PURE__ */ jsx(
            "input",
            {
              value: parentPath,
              onChange: (e) => setParentPath(e.target.value),
              placeholder: "Parent path (optional)",
              className: "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            }
          ),
          /* @__PURE__ */ jsx(
            "input",
            {
              value: folderName,
              onChange: (e) => setFolderName(e.target.value),
              placeholder: "Folder name",
              className: "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            }
          ),
          /* @__PURE__ */ jsxs("button", { onClick: () => createFolder().catch((e) => toast.error(e.message)), className: "inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700", children: [
            /* @__PURE__ */ jsx(FolderPlus, { className: "h-4 w-4" }),
            "Create Folder"
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("p", { className: "mb-2 text-sm font-medium text-gray-900", children: "Upload File / Image" }),
        /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
          /* @__PURE__ */ jsx(
            "select",
            {
              value: uploadFolderPath,
              onChange: (e) => setUploadFolderPath(e.target.value),
              className: "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm",
              children: folderOptions.map((opt, idx) => /* @__PURE__ */ jsx("option", { value: opt, children: opt || "(root)" }, `${opt}-${idx}`))
            }
          ),
          /* @__PURE__ */ jsx("input", { type: "file", onChange: (e) => setUploadFile(e.target.files?.[0] || null), className: "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" }),
          /* @__PURE__ */ jsxs(
            "button",
            {
              disabled: !uploadFile || uploading,
              onClick: uploadDocument,
              className: "inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50",
              children: [
                /* @__PURE__ */ jsx(Upload, { className: "h-4 w-4" }),
                uploading ? "Uploading..." : "Upload"
              ]
            }
          )
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "rounded-xl border border-gray-200 bg-white p-4", children: [
      /* @__PURE__ */ jsx("p", { className: "mb-3 text-sm font-medium text-gray-900", children: "Documents Tree" }),
      !documentsTree ? /* @__PURE__ */ jsx("p", { className: "text-sm text-gray-500", children: "Chưa có dữ liệu documents cho package này." }) : /* @__PURE__ */ jsx("ul", { children: renderNode(documentsTree) })
    ] })
  ] });
}

const prerender = false;
const $$slug = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$props, $$slots);
  Astro2.self = $$slug;
  const packageId = Astro2.params.slug || "";
  return renderTemplate`${renderComponent($$result, "PackageLayout", $$PackageLayout, { "title": "Package Detail - ORBIT", "projectName": "Project", "projectSlug": "projects", "packageName": "Package" }, { "default": ($$result2) => renderTemplate` ${renderComponent($$result2, "PackageDetailPage", PackageDetailPage, { "packageId": packageId, "client:load": true, "client:component-hydration": "load", "client:component-path": "@/components/features/PackageDetailPage", "client:component-export": "default" })} ` })}`;
}, "D:/DoAnTotNghiep/BIM_Project_Final/Orbit/Frontend/src/pages/packages/[slug].astro", void 0);

const $$file = "D:/DoAnTotNghiep/BIM_Project_Final/Orbit/Frontend/src/pages/packages/[slug].astro";
const $$url = "/packages/[slug]";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$slug,
  file: $$file,
  prerender,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
