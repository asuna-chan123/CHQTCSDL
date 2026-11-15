# Tài Liệu Tích Hợp Oracle Database 23ai (Medicore Web Health)

Tài liệu này ghi lại chi tiết toàn bộ các bước thiết lập, cấu hình schema, backend API và kết nối giữa React frontend với **Oracle Database 23ai** trong dự án **CHQTCSDL (Medicore Web Health)**.

---

## 1. Thông Tin Cơ Sở Dữ Liệu Oracle 23ai

- **Môi trường chạy**: Docker Container (`oracle23ai`)
- **Image**: `container-registry.oracle.com/database/free:latest` (Oracle AI Database 26ai / 23ai Free Release)
- **Host**: `localhost`
- **Port**: `1521` (Listener) | `5500` (EM Express)
- **Pluggable Database (PDB)**: `FREEPDB1`
- **Tài khoản quản trị schema ứng dụng**:
  - **Username**: `hospital_admin`
  - **Password**: Đặt qua biến môi trường `DB_PASSWORD` trong file `.env` cục bộ.
  - **Default Tablespace**: `USERS` (ASSM - Automatic Segment Space Management, bắt buộc cho kiểu dữ liệu `JSON` và `VECTOR`)
  - **Temporary Tablespace**: `TEMP`
- **Tài khoản SYS / SYSTEM**:
  - **Username**: `system`
  - **Password**: Đặt qua `ORACLE_PWD` trong file `.env` cục bộ.

---

## 2. Cấu Trúc Bảng Dữ Liệu Đã Khởi Tạo (13 Bảng)

Bộ script SQL chuẩn hóa theo đúng Phụ lục A của đề tài được đặt tại thư mục `sql/`:
- `sql/01_schema.sql`: DDL 13 bảng & ràng buộc toàn vẹn 3NF.
- `sql/02_seed.sql`: Dữ liệu mẫu khởi tạo hệ thống.
- `sql/03_package.sql`: Package `PKG_HOSPITAL_OPS` với `SKIP LOCKED`.
- `sql/04_triggers.sql`: 2 Trigger cập nhật thời gian & audit trail JSON.
- `sql/05_tests_concurrency.sql`: Bộ test giao dịch đồng thời C1, C2, C3.
- `sql/06_optimize_q1_execution_plan.sql`: Đo Execution Plan Q1 trước/sau index.
- `sql/run_all.sql`: Script chạy toàn bộ 6 file chỉ trong 1 lệnh.
- Chi tiết báo cáo nghiệm thu của Người 1 xem tại: [`.agents/NGUOI_1_IMPLEMENTATION.md`](file:///c:/CHQTCSDL/.agents/NGUOI_1_IMPLEMENTATION.md).

| STT | Tên Bảng | Mô Tả & Ghi Chú Tính Năng 23ai |
|:---:|:---|:---|
| 1 | `HOSPITALS` | Danh mục cơ sở bệnh viện (Bạch Mai, Cầu Giấy, Chợ Rẫy...) |
| 2 | `DEPARTMENTS` | Danh mục chuyên khoa viện (Tim mạch, Hô hấp, Cấp cứu,...) |
| 3 | `DOCTORS` | Danh mục bác sĩ & số chứng chỉ hành nghề |
| 4 | `PATIENTS` | Danh mục bệnh nhân, mã số y tế `MEDICAL_CODE` |
| 5 | `ROOMS` | Phòng bệnh theo khoa (được tối ưu độ dài UTF-8 tiếng Việt `VARCHAR2(100)`) |
| 6 | `BEDS` | Giường bệnh và trạng thái sử dụng (`AVAILABLE`, `OCCUPIED`) |
| 7 | `REFERRALS` | Quản lý chuyển tuyến liên viện với ràng buộc tuyến viện |
| 8 | `ADMISSIONS` | Nhập viện, phân luồng cấp cứu/nội trú |
| 9 | `APPOINTMENTS` | Lịch hẹn khám (Sử dụng `TIMESTAMP WITH LOCAL TIME ZONE` chuẩn UTC để hỗ trợ ràng buộc duy nhất `UQ_APPT_DOC_START`) |
| 10 | `MEDICAL_RECORDS` | Hồ sơ bệnh án điện tử, tích hợp trường `RECORD_JSON JSON` native của 23ai |
| 11 | `AUDIT_LOGS` | Nhật ký kiểm toán y tế, lưu `OLD_DATA` và `NEW_DATA` dưới dạng native `JSON` |
| 12 | `MEDICAL_DOCUMENTS` | Văn bản phác đồ y tế, hỗ trợ cột vector `EMBEDDING VECTOR(*, FLOAT32)` |
| 13 | `SYMPTOM_KNOWLEDGE` | Tri thức triệu chứng bệnh, hỗ trợ tìm kiếm ngữ nghĩa vector `VECTOR(*, FLOAT32)` |

---

## 3. Kiến Trúc Kết Nối (Backend Bridge)

Do React SPA chạy trên trình duyệt không thể kết nối trực tiếp cổng socket 1521 của Oracle, một tầng Backend API Node.js/Express siêu nhẹ được thiết lập tại thư mục `server/`:

### Cấu trúc thư mục `server/`:
```
server/
├── .env                # Biến môi trường kết nối Oracle 23ai
├── db.js               # Oracle Connection Pool (node-oracledb Thin Mode)
├── index.js            # REST API Express (Cung cấp các endpoints dữ liệu y tế)
└── package.json        # Dependencies: oracledb, express, cors, dotenv
```

### Driver & Chế độ hoạt động:
- **`node-oracledb` (v6.6+)**: Chạy ở chế độ **Thin Mode** hoàn toàn bằng JavaScript/Node.js thuần.
- **Không yêu cầu**: Không cần cài đặt Oracle Instant Client hay SDK C/C++ ngoài hệ điều hành.

---

## 4. Các REST API Đã Cung Cấp

| Phương thức | Endpoint | Chức năng |
|:---:|:---|:---|
| `GET` | `/api/health` | Kiểm tra kết nối Oracle 23ai, banner phiên bản và thời gian máy chủ |
| `GET` | `/api/patients` | Lấy danh sách hồ sơ bệnh nhân từ Oracle 23ai |
| `POST` | `/api/patients` | Tạo bệnh nhân mới và tự động ghi Audit Log vào Oracle |
| `GET` | `/api/appointments` | Lấy danh sách lịch hẹn khám bệnh |
| `GET` | `/api/hospitals` | Lấy danh sách mạng lưới bệnh viện |
| `GET` | `/api/departments` | Lấy danh sách chuyên khoa |
| `GET` | `/api/doctors` | Lấy danh mục bác sĩ |
| `GET` | `/api/beds` | Lấy hiện trạng phòng và giường bệnh thời gian thực |
| `GET` | `/api/referrals` | Lấy danh sách ca chuyển viện |
| `GET` | `/api/audit-logs` | Lấy lịch sử truy vết kiểm toán |

---

## 5. Tích Hợp Frontend (React + Vite)

1. **Vite Proxy (`vite.config.ts`)**:
   - Mọi request có tiền tố `/api` từ React (cổng 3000) được tự động proxy chuyển tiếp sang `http://localhost:5000` (Backend API), khắc phục triệt để vấn đề CORS khi phát triển.

2. **State & Store (`src/context/MedicalStore.tsx`)**:
   - Tự động gọi `/api/health`, `/api/patients`, `/api/appointments` khi ứng dụng khởi chạy để đồng bộ dữ liệu thực tế từ Oracle 23ai.
   - Khi thêm bệnh nhân mới, hệ thống vừa cập nhật UI tức thời vừa gửi request `POST /api/patients` lưu trữ bền vững vào Oracle Database.
   - Tự động fallback về LocalStorage/Mock nếu database tạm thời ngắt kết nối.

3. **Giao diện nhận diện trạng thái (`src/components/layout/Header.tsx`)**:
   - Thêm badge hiển thị trạng thái kết nối **Oracle 23ai 🟢** kèm hiệu ứng pulse ngay trên thanh tiêu đề ứng dụng.

---

## 6. Hướng Dẫn Vận Hành Hàng Ngày

### Khởi động Database (Nếu container dừng lại):
```bash
docker start oracle23ai
```

### Khởi động Backend API:
```bash
# Từ thư mục gốc
npm run server
# Hoặc chế độ dev tự reload
npm run server:dev
```

### Khởi động Frontend:
```bash
npm run dev
```
Truy cập `http://localhost:3000` để trải nghiệm hệ thống liên kết cơ sở dữ liệu Oracle 23ai.

## 7. Tìm Kiếm Ngữ Nghĩa Bằng Vector

- `SYMPTOM_KNOWLEDGE` và `MEDICAL_DOCUMENTS` lưu embedding bằng `VECTOR(384, FLOAT32)`.
- Migration bổ sung metadata, khóa seed ổn định và không xóa dữ liệu: `sql/07_vector_search_metadata.sql`. Chạy migration này với schema ứng dụng trước khi sử dụng API tìm kiếm.
- Backend dùng mô hình đa ngôn ngữ `Xenova/paraphrase-multilingual-MiniLM-L12-v2` qua Transformers.js để tạo vector cục bộ. Lần đầu chạy có thể tải model weights về cache của máy; nội dung truy vấn không được gửi tới dịch vụ embedding bên ngoài.
- Endpoint `POST /api/ai-search` nhận `{ "query": "...", "type": "symptoms" | "docs" }`, trả tối đa 5 kết quả theo `VECTOR_DISTANCE(..., COSINE)`. Corpus ví dụ được upsert tự động khi tìm kiếm lần đầu.
- Khoảng cách/điểm vector chỉ dùng để xếp hạng nội dung tham khảo, không phải xác suất chẩn đoán hay lời khuyên điều trị.

