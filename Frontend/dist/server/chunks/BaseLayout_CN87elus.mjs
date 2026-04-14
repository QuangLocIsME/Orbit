import { c as createComponent } from './astro-component_DX-KRSLM.mjs';
import 'piccolore';
import { a3 as addAttribute, Q as renderTemplate, bc as renderSlot, bd as renderTransition, bb as renderHead } from './sequence_COHdm9JL.mjs';
import { r as renderComponent } from './server_0X4XH_4s.mjs';
import 'clsx';
import { r as renderScript } from './script_Vun3Ou6Q.mjs';

const $$ClientRouter = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$props, $$slots);
  Astro2.self = $$ClientRouter;
  const { fallback = "animate" } = Astro2.props;
  return renderTemplate`<meta name="astro-view-transitions-enabled" content="true"><meta name="astro-view-transitions-fallback"${addAttribute(fallback, "content")}>${renderScript($$result, "D:/DoAnTotNghiep/BIM_Project_Final/Orbit/Frontend/node_modules/astro/components/ClientRouter.astro?astro&type=script&index=0&lang.ts")}`;
}, "D:/DoAnTotNghiep/BIM_Project_Final/Orbit/Frontend/node_modules/astro/components/ClientRouter.astro", void 0);

var __freeze = Object.freeze;
var __defProp = Object.defineProperty;
var __template = (cooked, raw) => __freeze(__defProp(cooked, "raw", { value: __freeze(cooked.slice()) }));
var _a;
const $$BaseLayout = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$props, $$slots);
  Astro2.self = $$BaseLayout;
  const {
    title = "ORBIT - Project Management",
    description = "A high-performance project management dashboard built with Astro.js"
  } = Astro2.props;
  return renderTemplate(_a || (_a = __template(['<html lang="en"> <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="description"', '><link rel="icon" type="image/svg+xml" href="/favicon.svg"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"><title>', "</title>", "<!-- Dark mode: apply class before first paint to prevent flash --><script>\n      (function () {\n        try {\n          var saved = localStorage.getItem('orbit-theme');\n          if (saved === 'dark') {\n            document.documentElement.classList.add('dark');\n          } else if (saved === 'light') {\n            document.documentElement.classList.remove('dark');\n          } else {\n            // system\n            if (window.matchMedia('(prefers-color-scheme: dark)').matches) {\n              document.documentElement.classList.add('dark');\n            }\n          }\n        } catch (_) {}\n      })();\n    <\/script>", '</head> <body class="min-h-screen font-sans"', "> ", "</body></html>"])), addAttribute(description, "content"), title, renderComponent($$result, "ClientRouter", $$ClientRouter, {}), renderHead(), addAttribute(renderTransition($$result, "hrd3ipvg"), "data-astro-transition-scope"), renderSlot($$result, $$slots["default"]));
}, "D:/DoAnTotNghiep/BIM_Project_Final/Orbit/Frontend/src/layouts/BaseLayout.astro", "self");

export { $$BaseLayout as $ };
