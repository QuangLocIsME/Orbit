/**
 * Trang Help & Support (React island cho help.astro).
 */
export default function HelpSupport() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-semibold text-[#111827]">Help &amp; Support</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-[#4B5563]">
        Nếu bạn gặp sự cố khi dùng ORBIT, hãy mô tả rõ bước thực hiện và (nếu có) ảnh chụp màn hình, rồi gửi cho quản trị dự án hoặc email hỗ trợ của tổ chức bạn.
      </p>
      <ul className="mt-6 list-disc space-y-2 pl-5 text-[14px] text-[#374151]">
        <li>Kiểm tra kết nối mạng và thử tải lại trang.</li>
        <li>Đăng xuất và đăng nhập lại nếu phiên làm việc hết hạn.</li>
        <li>Upload file IFC/RVT lớn có thể mất vài phút — tránh đóng tab khi đang xử lý.</li>
      </ul>
    </div>
  );
}
