import { c as createComponent } from './astro-component_DX-KRSLM.mjs';
import 'piccolore';
import { Q as renderTemplate } from './sequence_COHdm9JL.mjs';
import { r as renderComponent } from './server_0X4XH_4s.mjs';
import { $ as $$DashboardLayout } from './DashboardLayout_8HD29pf8.mjs';
import { jsxs, jsx } from 'react/jsx-runtime';

function HelpSupport() {
  return /* @__PURE__ */ jsxs("div", { className: "mx-auto max-w-2xl px-4 py-8", children: [
    /* @__PURE__ */ jsx("h1", { className: "text-2xl font-semibold text-[#111827]", children: "Help & Support" }),
    /* @__PURE__ */ jsx("p", { className: "mt-2 text-[15px] leading-relaxed text-[#4B5563]", children: "Nếu bạn gặp sự cố khi dùng ORBIT, hãy mô tả rõ bước thực hiện và (nếu có) ảnh chụp màn hình, rồi gửi cho quản trị dự án hoặc email hỗ trợ của tổ chức bạn." }),
    /* @__PURE__ */ jsxs("ul", { className: "mt-6 list-disc space-y-2 pl-5 text-[14px] text-[#374151]", children: [
      /* @__PURE__ */ jsx("li", { children: "Kiểm tra kết nối mạng và thử tải lại trang." }),
      /* @__PURE__ */ jsx("li", { children: "Đăng xuất và đăng nhập lại nếu phiên làm việc hết hạn." }),
      /* @__PURE__ */ jsx("li", { children: "Upload file IFC/RVT lớn có thể mất vài phút — tránh đóng tab khi đang xử lý." })
    ] })
  ] });
}

const prerender = false;
const $$Help = createComponent(($$result, $$props, $$slots) => {
  return renderTemplate`${renderComponent($$result, "DashboardLayout", $$DashboardLayout, { "title": "Help & Support - ORBIT", "pageTitle": "Help" }, { "default": ($$result2) => renderTemplate` ${renderComponent($$result2, "HelpSupport", HelpSupport, { "client:load": true, "client:component-hydration": "load", "client:component-path": "@/components/features/HelpSupport", "client:component-export": "default" })} ` })}`;
}, "D:/DoAnTotNghiep/BIM_Project_Final/Orbit/Frontend/src/pages/help.astro", void 0);

const $$file = "D:/DoAnTotNghiep/BIM_Project_Final/Orbit/Frontend/src/pages/help.astro";
const $$url = "/help";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Help,
  file: $$file,
  prerender,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
