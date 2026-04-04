import { a as createComponent, $ as $$BaseLayout } from './utils_DVHOA7LL.mjs';
import 'piccolore';
import { r as renderComponent, a as renderTemplate } from './prerender_BEYUTXqu.mjs';
import { L as LandingPage } from './LandingPage_DEp-0SZv.mjs';

const $$Index = createComponent(($$result, $$props, $$slots) => {
  return renderTemplate`${renderComponent($$result, "BaseLayout", $$BaseLayout, { "title": "ORBIT - Modern BIM Collaboration Platform" }, { "default": ($$result2) => renderTemplate` ${renderComponent($$result2, "LandingPage", LandingPage, { "client:load": true, "client:component-hydration": "load", "client:component-path": "@/components/landing/LandingPage", "client:component-export": "default" })} ` })}`;
}, "D:/OTHER/Orbit/Frontend/src/pages/index.astro", void 0);

const $$file = "D:/OTHER/Orbit/Frontend/src/pages/index.astro";
const $$url = "";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Index,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
