---
name: oracle-23ai-integration
description: Tiêu chuẩn, kiến trúc và quy trình làm việc với Oracle Database 23ai trong dự án Medicore Web Health (Docker container, node-oracledb Thin Mode, REST API và React State hydration).
---

# Kỹ Năng Tích Hợp Oracle Database 23ai

Skill này cung cấp các nguyên tắc kiến trúc, quy chuẩn câu lệnh SQL và quy trình bảo trì liên kết cơ sở dữ liệu giữa ứng dụng **Medicore Web Health** và **Oracle Database 23ai**.

---

## 1. Cấu Hình Kết Nối Chuẩn

- **Host/Port**: `localhost:1521`
- **Service Name (PDB)**: `FREEPDB1`
- **Schema User**: `hospital_admin`
- **Password**: `Oracle123`
- **Default Tablespace**: `USERS` (Bắt buộc dùng ASSM cho kiểu `JSON` và `VECTOR`)

---

## 2. Quy Tắc Viết SQL & 23ai Features

1. **Ràng buộc thời gian**:
   - Không dùng `TIMESTAMP WITH TIME ZONE` trong các ràng buộc `UNIQUE` hoặc `PRIMARY KEY` (sẽ gặp lỗi `ORA-02329`).
   - Luôn sử dụng `TIMESTAMP WITH LOCAL TIME ZONE` hoặc `TIMESTAMP(6)` khi cần lập chỉ mục hoặc ràng buộc duy nhất.

2. **Dữ liệu JSON & Vector**:
   - Sử dụng native data type `JSON` thay vì `VARCHAR2` hay `CLOB` để tận dụng JSON Duality và chỉ mục JSON Search.
   - Sử dụng `VECTOR(*, FLOAT32)` cho các embedding tìm kiếm ngữ nghĩa lâm sàng.

3. **Mã hóa ký tự tiếng Việt UTF-8**:
   - Khi chạy script dòng lệnh qua sqlplus/docker, luôn thiết lập:
     `export NLS_LANG=AMERICAN_AMERICA.AL32UTF8`
   - Độ dài cột tiếng Việt có dấu cần dùng `VARCHAR2(N CHAR)` hoặc tính toán byte mở rộng (ví dụ `VARCHAR2(100)` cho loại phòng bệnh).

---

## 3. Quy Trình Đồng Bộ Giữa Backend & Frontend

1. **Backend**:
   - Sử dụng thư viện `node-oracledb` chế độ Thin Mode.
   - Đảm bảo thiết lập `oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT` để kết quả truy vấn trả về đối tượng JSON dạng key-value.
   - Luôn sử dụng Connection Pool và đóng kết nối (trả về pool) trong khối `finally`.

2. **Frontend**:
   - Proxy thông qua `vite.config.ts` để định tuyến `/api/*` tới backend port 5000.
   - Quản trị dữ liệu tập trung qua `src/context/MedicalStore.tsx`.

