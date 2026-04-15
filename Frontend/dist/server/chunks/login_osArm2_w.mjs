import { c as createComponent } from './astro-component_DX-KRSLM.mjs';
import 'piccolore';
import { Q as renderTemplate } from './sequence_COHdm9JL.mjs';
import { r as renderComponent } from './server_CjntUweB.mjs';
import { $ as $$BaseLayout } from './BaseLayout_De_rBkrk.mjs';
import { A as AuthForm } from './AuthForm_DwR6p91T.mjs';
import { r as redirectIfAuthenticated } from './auth-page-guard_BAXlpOAZ.mjs';

const prerender = false;
const $$Login = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$props, $$slots);
  Astro2.self = $$Login;
  const backendUrl = "http://localhost:3000";
  const accessToken = Astro2.cookies.get("accessToken")?.value;
  const redirected = await redirectIfAuthenticated({
    accessToken,
    backendUrl,
    redirect: (path) => Astro2.redirect(path),
    to: "/home"
  });
  if (redirected) return redirected;
  return renderTemplate`${renderComponent($$result, "BaseLayout", $$BaseLayout, { "title": "Log in - ORBIT", "description": "Sign in to your ORBIT account" }, { "default": async ($$result2) => renderTemplate` ${renderComponent($$result2, "AuthForm", AuthForm, { "mode": "login", "client:load": true, "client:component-hydration": "load", "client:component-path": "D:/DoAnTotNghiep/BIM_Project_Final/Orbit/Frontend/src/components/auth/AuthForm", "client:component-export": "default" })} ` })}`;
}, "D:/DoAnTotNghiep/BIM_Project_Final/Orbit/Frontend/src/pages/login.astro", void 0);
const $$file = "D:/DoAnTotNghiep/BIM_Project_Final/Orbit/Frontend/src/pages/login.astro";
const $$url = "/login";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Login,
  file: $$file,
  prerender,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
