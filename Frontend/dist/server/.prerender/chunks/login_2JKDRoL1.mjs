import { a as createComponent, $ as $$BaseLayout } from './utils_DVHOA7LL.mjs';
import 'piccolore';
import { r as renderComponent, a as renderTemplate } from './prerender_BEYUTXqu.mjs';
import { A as AuthForm } from './AuthForm_xYFbtXTO.mjs';

const $$Login = createComponent(($$result, $$props, $$slots) => {
  return renderTemplate`${renderComponent($$result, "BaseLayout", $$BaseLayout, { "title": "Log in - ORBIT", "description": "Sign in to your ORBIT account" }, { "default": ($$result2) => renderTemplate` ${renderComponent($$result2, "AuthForm", AuthForm, { "mode": "login", "client:load": true, "client:component-hydration": "load", "client:component-path": "D:/OTHER/Orbit/Frontend/src/components/auth/AuthForm", "client:component-export": "default" })} ` })}`;
}, "D:/OTHER/Orbit/Frontend/src/pages/login.astro", void 0);

const $$file = "D:/OTHER/Orbit/Frontend/src/pages/login.astro";
const $$url = "/login";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Login,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
