---
name: medical-ui-ux-design
description: Quy định tiêu chuẩn thiết kế và phát triển giao diện cho dự án Web Y Tế dựa trên triết lý shadcn/ui, Radix UI, Tailwind CSS, bảo đảm tính trợ năng (accessibility) và độ tin cậy y tế.
---

# Hướng Dẫn Thiết Kế UI/UX (Dựa trên shadcn/ui)

Tài liệu này quy định các tiêu chuẩn thiết kế và phát triển giao diện cho dự án **Web Y Tế**, sử dụng triết lý của [shadcn/ui](https://ui.shadcn.com/).

---

## 1. Triết Lý Thiết Kế (Design Philosophy)

- **Minimal & Clean**: Giữ giao diện tối giản, tập trung vào nội dung và dữ liệu (bệnh án, lịch trình, thông tin sức khỏe). Không lạm dụng màu sắc sặc sỡ và hiệu ứng thừa gây phân tán sự chú ý trong môi trường y tế.
- **Accessible (Trợ năng cao)**:
  - Dự án y tế phục vụ đa dạng người dùng, bao gồm người lớn tuổi, bệnh nhân và y bác sĩ làm việc với cường độ cao.
  - Tuân thủ nghiêm ngặt các tiêu chuẩn **WAI-ARIA**.
  - Đảm bảo độ tương phản màu sắc cao (tối thiểu chuẩn WCAG AA/AAA).
  - Hỗ trợ đầy đủ điều hướng bằng bàn phím (Tab, Enter, Escape, Arrow keys).
  - Phục vụ người lớn tuổi: Kích thước chữ body mặc định là **16px** (`text-base`).
- **Ownership**:
  - Không cài đặt component trọn gói như thư viện hộp đen thông qua npm.
  - Component được copy và quản lý trực tiếp trong source code tại thư mục `src/components/ui`, cho phép toàn quyền custom logic, validation y tế và style theo nhu cầu dự án.

---

## 2. Tech Stack UI

- **Core**: React + TypeScript
- **Styling**: Tailwind CSS + `clsx` + `tailwind-merge` (thông qua hàm tiện ích `cn()` để linh hoạt gộp class và tránh xung đột).
- **Headless UI**: Radix UI Primitives (`@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-tabs`, `@radix-ui/react-slot`...) để xử lý logic accessibility, focus trapping, keyboard navigation, popover và modal.
- **Icons**: `lucide-react` (đồng bộ hoàn hảo với hệ sinh thái mặc định của shadcn/ui).
- **Animation**: `framer-motion` (chỉ dùng cho các transition nhẹ nhàng như fade-in, slide-in, không gây giật lag hay rối mắt).

---

## 3. Hệ Thống Màu Sắc (Color Palette)

Sử dụng **CSS Variables (HSL)** kết hợp với Tailwind CSS để dễ dàng quản lý Dark Mode và Light Mode. Màu sắc chủ đạo của dự án là **Trắng Tinh Khiết (Pure White) và Xanh Biển (Ocean Blue / Medical Blue)** để tạo cảm giác tươi sáng, vệ sinh, tin cậy tuyệt đối và hiện đại chuẩn quốc tế.

Định nghĩa trong `src/index.css`:
- `--background`: `0 0% 100%` (Màu Trắng tinh khiết làm nền chủ đạo, mang lại cảm giác sạch sẽ, thoáng đãng).
- `--foreground`: `222.2 84% 4.9%` (Xám đen cho text, tạo độ tương phản cao trên nền trắng).
- `--primary`: Tone màu **Xanh biển y tế (Ocean Blue)** (HSL: `217 91% 45%` - `#0284C7` / `#1D68E5` hoặc Sky 700 `#0369A1`) dùng cho các nút bấm chính (Đặt lịch, Lưu hồ sơ bệnh án, Xác nhận), header điểm nhấn và các liên kết hành động.
- `--accent`: Xanh biển nhạt dịu (`214 95% 95%` / `#E0F2FE`) cho trạng thái hover, badge thông tin và nền thẻ tiếp nhận.
- `--muted` & `--muted-foreground`: Xám sáng trung tính cho viền phân tách, ngày tháng, nhãn phụ.
- `--destructive`: Đỏ tươi y tế (`#DC2626` / `#EF4444`) dùng cho cảnh báo quan trọng, ca cấp cứu, xung đột lịch hẹn.
- `--ring`: Màu xanh biển đồng nhất với primary để tạo viền sáng rõ nét khi focus bằng bàn phím.

---

## 4. Typography (Kiểu Chữ)

- **Font gia đình**: `Inter` hoặc hệ thống sans-serif hiện đại.
- **Kích thước**: Tuân thủ scale chuẩn của Tailwind (`text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`, `text-2xl`...).
- **Lưu ý y tế**:
  - Kích thước chữ nội dung mặc định (body text) luôn là **16px (`text-base`)** để người lớn tuổi và bệnh nhân dễ đọc mà không cần căng mắt.
  - Các tiêu đề (Heading) cần in đậm rõ ràng (`font-semibold` hoặc `font-bold`), phân cấp rõ ràng `h1`, `h2`, `h3`.
  - Các chỉ số sinh tồn (Huyết áp, Nhịp tim, SpO2) cần hiển thị dạng số to (`text-2xl` hoặc `text-3xl`), font monospace hoặc tabular numbers (`tabular-nums`) để chống nhảy giật layout.

---

## 5. Spacing & Hình Dáng (Radius)

- **Spacing**: Dùng scale chuẩn của Tailwind (`p-4`, `p-6`, `gap-3`, `gap-4`, `mt-6`). Luôn duy trì khoảng trắng (whitespace) thoáng đãng giữa các khu vực thông tin bệnh nhân để tránh quá tải thông tin thị giác.
- **Border Radius**: Chọn mức độ bo góc vừa phải để tạo sự thân thiện, gần gũi nhưng vẫn giữ tính nghiêm túc y khoa. Đồng nhất sử dụng biến `--radius: 0.5rem` (tương đương `rounded-lg` trong Tailwind).

---

## 6. Quy Chuẩn Component Cụ Thể

- **Cards (Thẻ thông tin)**:
  - Dùng cho Hồ sơ bệnh nhân, Thẻ bác sĩ, Lịch hẹn, Chỉ số sinh tồn.
  - Sử dụng viền mỏng `border border-border`, màu nền `bg-card`, text `text-card-foreground`, hiệu ứng bóng mờ cực nhẹ (`shadow-sm`).
- **Forms (Form, Input, Select, Textarea)**:
  - Style input rõ ràng: Có border rõ nét, khi focus đổi màu viền sang `--ring` kèm hiệu ứng ring outline nhẹ.
  - Luôn có `<Label>` rõ ràng gắn với từng trường nhập liệu.
  - Text thông báo lỗi (Error message) có màu đỏ (`text-destructive text-sm font-medium`).
- **Buttons (Nút bấm)**:
  - `default`: Tác vụ chính (Thêm bệnh án, Đặt lịch khám, Thanh toán viện phí).
  - `outline` / `ghost`: Tác vụ phụ (Hủy thao tác, Quay lại, Đổi bộ lọc).
  - `destructive`: Tác vụ nguy hiểm (Hủy lịch hẹn, Xóa hồ sơ).
- **Bảng biểu (Table / Data Table)**:
  - Dữ liệu y tế thường dài nên Table bắt buộc có thanh phân trang (Pagination), bộ lọc theo khoa/trạng thái và ô tìm kiếm tức thì.
  - Hàng bảng có hiệu ứng hover nhẹ `hover:bg-muted/50`.

---

## 7. Quy Trình Phát Triển (Workflow)

1. **Cần component mới?** -> Tham khảo thiết kế và API tại [ui.shadcn.com](https://ui.shadcn.com/).
2. **Khởi tạo trực tiếp vào source code**: Đặt tại `src/components/ui/[component-name].tsx`.
3. **Tùy biến nghiệp vụ y tế**:
   - Nếu cần điều chỉnh cho phù hợp với nghiệp vụ y tế (như thêm trạng thái cảnh báo sinh tồn, format số thẻ BHYT, tooltip chống chỉ định), hãy sửa trực tiếp file đó.
   - Không bao bọc (wrap) qua nhiều tầng component trung gian nếu không thực sự cần thiết.
