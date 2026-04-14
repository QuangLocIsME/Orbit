import { c as createComponent } from './astro-component_DX-KRSLM.mjs';
import 'piccolore';
import { Q as renderTemplate } from './sequence_COHdm9JL.mjs';
import { r as renderComponent } from './server_0X4XH_4s.mjs';
import { $ as $$ProjectLayout, T as TaskDetailPage } from './TaskDetailPage_CXno7v2w.mjs';

const prerender = false;
const $$taskId = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$props, $$slots);
  Astro2.self = $$taskId;
  const backendUrl = "http://localhost:3000";
  const accessToken = Astro2.cookies.get("accessToken")?.value;
  const publicId = Astro2.params.publicId;
  const taskId = Astro2.params.taskId;
  if (!publicId || !taskId) {
    return Astro2.redirect("/projects");
  }
  let project = null;
  try {
    const res = await fetch(`${backendUrl}/api/projects/me`, {
      headers: {
        Cookie: `accessToken=${accessToken}`,
        Accept: "application/json"
      },
      credentials: "include"
    });
    if (res.ok) {
      const payload = await res.json();
      const projects = Array.isArray(payload?.data) ? payload.data : [];
      project = projects.find((p) => String(p.publicId) === publicId);
    }
  } catch {
  }
  if (!project) {
    return Astro2.redirect("/projects");
  }
  return renderTemplate`${renderComponent($$result, "ProjectLayout", $$ProjectLayout, { "title": `Task ${taskId} - ${String(project.name)} - ORBIT`, "projectName": String(project.name), "projectSlug": String(project.publicId) }, { "default": async ($$result2) => renderTemplate` ${renderComponent($$result2, "TaskDetailPage", TaskDetailPage, { "projectPublicId": publicId, "taskId": taskId, "client:load": true, "client:component-hydration": "load", "client:component-path": "@/components/features/TaskDetailPage", "client:component-export": "default" })} ` })}`;
}, "D:/DoAnTotNghiep/BIM_Project_Final/Orbit/Frontend/src/pages/projects/[publicId]/tasks/[taskId].astro", void 0);
const $$file = "D:/DoAnTotNghiep/BIM_Project_Final/Orbit/Frontend/src/pages/projects/[publicId]/tasks/[taskId].astro";
const $$url = "/projects/[publicId]/tasks/[taskId]";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$taskId,
  file: $$file,
  prerender,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
