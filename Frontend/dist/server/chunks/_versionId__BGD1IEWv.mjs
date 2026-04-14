import { c as createComponent } from './astro-component_DX-KRSLM.mjs';
import 'piccolore';
import { Q as renderTemplate } from './sequence_COHdm9JL.mjs';
import { r as renderComponent } from './server_0X4XH_4s.mjs';
import { $ as $$BaseLayout } from './BaseLayout_CN87elus.mjs';

const prerender = false;
const $$versionId = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$props, $$slots);
  Astro2.self = $$versionId;
  const projectId = Astro2.params.projectId;
  const fileId = Astro2.params.fileId;
  const versionId = Astro2.params.versionId;
  if (!projectId || !fileId || !versionId) {
    return Astro2.redirect("/projects");
  }
  return renderTemplate`${renderComponent($$result, "BaseLayout", $$BaseLayout, { "title": "IFC Viewer — ORBIT" }, { "default": ($$result2) => renderTemplate` ${renderComponent($$result2, "IfcViewerPage", null, { "projectId": projectId, "fileId": fileId, "versionId": versionId, "client:only": "react", "client:component-hydration": "only", "client:component-path": "@/components/features/IfcViewerPage", "client:component-export": "default" })} ` })}`;
}, "D:/DoAnTotNghiep/BIM_Project_Final/Orbit/Frontend/src/pages/project/[projectId]/[fileId]/[versionId].astro", void 0);

const $$file = "D:/DoAnTotNghiep/BIM_Project_Final/Orbit/Frontend/src/pages/project/[projectId]/[fileId]/[versionId].astro";
const $$url = "/project/[projectId]/[fileId]/[versionId]";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$versionId,
  file: $$file,
  prerender,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
