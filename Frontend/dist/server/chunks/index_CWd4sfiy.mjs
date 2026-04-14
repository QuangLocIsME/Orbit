import { c as createComponent } from './astro-component_DX-KRSLM.mjs';
import 'piccolore';
import { Q as renderTemplate } from './sequence_COHdm9JL.mjs';
import { r as renderComponent } from './server_0X4XH_4s.mjs';
import { $ as $$DashboardLayout } from './DashboardLayout_8HD29pf8.mjs';
import { P as PackagesManager } from './PackagesManager_CL6wvoik.mjs';

const prerender = false;
const $$Index = createComponent(($$result, $$props, $$slots) => {
  return renderTemplate`${renderComponent($$result, "DashboardLayout", $$DashboardLayout, { "title": "Packages - ORBIT", "pageTitle": "Packages" }, { "default": ($$result2) => renderTemplate` ${renderComponent($$result2, "PackagesManager", PackagesManager, { "client:load": true, "client:component-hydration": "load", "client:component-path": "@/components/features/PackagesManager", "client:component-export": "default" })} ` })}`;
}, "D:/DoAnTotNghiep/BIM_Project_Final/Orbit/Frontend/src/pages/packages/index.astro", void 0);

const $$file = "D:/DoAnTotNghiep/BIM_Project_Final/Orbit/Frontend/src/pages/packages/index.astro";
const $$url = "/packages";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Index,
  file: $$file,
  prerender,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
