import { a as createComponent, $ as $$BaseLayout } from './utils_DVHOA7LL.mjs';
import 'piccolore';
import { r as renderComponent, a as renderTemplate } from './prerender_BEYUTXqu.mjs';
import { A as AuthForm } from './AuthForm_xYFbtXTO.mjs';

const $$Register = createComponent(($$result, $$props, $$slots) => {
  return renderTemplate`${renderComponent($$result, "BaseLayout", $$BaseLayout, { "title": "Create Account - ORBIT", "description": "Create your ORBIT account and start collaborating" }, { "default": ($$result2) => renderTemplate` ${renderComponent($$result2, "AuthForm", AuthForm, { "mode": "register", "client:load": true, "client:component-hydration": "load", "client:component-path": "D:/OTHER/Orbit/Frontend/src/components/auth/AuthForm", "client:component-export": "default" })} ` })}`;
}, "D:/OTHER/Orbit/Frontend/src/pages/register.astro", void 0);

const $$file = "D:/OTHER/Orbit/Frontend/src/pages/register.astro";
const $$url = "/register";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Register,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
