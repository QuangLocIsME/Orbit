import { A as AstroError, I as InvalidComponentArgs, c as createRenderInstruction, b as addAttribute, a as renderTemplate, e as renderSlot, f as renderTransition, g as renderHead, r as renderComponent } from './prerender_BEYUTXqu.mjs';
import 'piccolore';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function validateArgs(args) {
  if (args.length !== 3) return false;
  if (!args[0] || typeof args[0] !== "object") return false;
  return true;
}
function baseCreateComponent(cb, moduleId, propagation) {
  const name = moduleId?.split("/").pop()?.replace(".astro", "") ?? "";
  const fn = (...args) => {
    if (!validateArgs(args)) {
      throw new AstroError({
        ...InvalidComponentArgs,
        message: InvalidComponentArgs.message(name)
      });
    }
    return cb(...args);
  };
  Object.defineProperty(fn, "name", { value: name, writable: false });
  fn.isAstroComponentFactory = true;
  fn.moduleId = moduleId;
  fn.propagation = propagation;
  return fn;
}
function createComponentWithOptions(opts) {
  const cb = baseCreateComponent(opts.factory, opts.moduleId, opts.propagation);
  return cb;
}
function createComponent(arg1, moduleId, propagation) {
  if (typeof arg1 === "function") {
    return baseCreateComponent(arg1, moduleId, propagation);
  } else {
    return createComponentWithOptions(arg1);
  }
}

async function renderScript(result, id) {
  const inlined = result.inlinedScripts.get(id);
  let content = "";
  if (inlined != null) {
    if (inlined) {
      content = `<script type="module">${inlined}</script>`;
    }
  } else {
    const resolved = await result.resolve(id);
    content = `<script type="module" src="${result.userAssetsBase ? (result.base === "/" ? "" : result.base) + result.userAssetsBase : ""}${resolved}"></script>`;
  }
  return createRenderInstruction({ type: "script", id, content });
}

const $$ClientRouter = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$props, $$slots);
  Astro2.self = $$ClientRouter;
  const { fallback = "animate" } = Astro2.props;
  return renderTemplate`<meta name="astro-view-transitions-enabled" content="true"><meta name="astro-view-transitions-fallback"${addAttribute(fallback, "content")}>${renderScript($$result, "D:/OTHER/Orbit/Frontend/node_modules/astro/components/ClientRouter.astro?astro&type=script&index=0&lang.ts")}`;
}, "D:/OTHER/Orbit/Frontend/node_modules/astro/components/ClientRouter.astro", void 0);

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
}, "D:/OTHER/Orbit/Frontend/src/layouts/BaseLayout.astro", "self");

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export { $$BaseLayout as $, createComponent as a, cn as c };
