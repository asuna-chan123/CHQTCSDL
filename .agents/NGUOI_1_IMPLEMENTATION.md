# BÁO CÁO KẾT QUẢ TRIỂN KHAI CỦA NGƯỜI 1 (DATABASE CORE, PL/SQL & TRANSACTION)

- **Học phần**: Hệ Quản Trị Cơ Sở Dữ Liệu – Oracle Database 23ai
- **Đề tài 25**: Hệ thống quản lý bệnh viện thông minh tích hợp đa công nghệ
- **Giảng viên hướng dẫn**: ThS. Lê Thị Minh Nguyện
- **Vai trò**: Người 1 – Database Core, PL/SQL & Transaction Architect
- **Thời gian hoàn thành**: 10/11/2026

---

## 1. TỔNG HỢP CÁC FILE MÃ NGUỒN ĐÃ ĐÓNG GÓI (THƯ MỤC `/sql`)

Tuân thủ nghiêm ngặt theo **Phụ lục A (Checklist nộp bài)** của Báo cáo đồ án:

| STT | Tên File Script | Mục Đích & Nội Dung | Trạng Thái |
|:---:|:---|:---|:---:|
| 1 | `sql/01_schema.sql` | DDL khởi tạo 13 bảng 3NF, khóa ngoại, ràng buộc `UNIQUE`, `CHECK` và các index quan hệ. | ✅ Hoàn thành 100% |
| 2 | `sql/02_seed.sql` | Nạp dữ liệu mẫu ban đầu (bệnh viện, khoa, bác sĩ, bệnh nhân, giường, bệnh án JSON). | ✅ Hoàn thành 100% |
| 3 | `sql/03_package.sql` | Package `PKG_HOSPITAL_OPS` chứa nghiệp vụ đặt lịch, chuyển tuyến và **phân giường an toàn với `SELECT ... FOR UPDATE SKIP LOCKED`**. | ✅ Hoàn thành 100% |
| 4 | `sql/04_triggers.sql` | Cài đặt 2 Trigger: `trg_medical_records_bu` (metadata) và `trg_medical_records_audit` (lưu vết JSON `OLD_DATA`/`NEW_DATA`). | ✅ Hoàn thành 100% |
| 5 | `sql/05_tests_concurrency.sql` | Bộ kiểm thử tự động 3 ca giao dịch đồng thời (C1, C2, C3) theo Bảng 4.2. | ✅ Hoàn thành 100% |
| 6 | `sql/06_optimize_q1_execution_plan.sql` | Đo đạc Execution Plan Q1 (B-tree) + seed bulk ~10.000 lịch khám. | ✅ Hoàn thành 100% |
| 7 | `sql/08_optimize_q2_vector_index.sql` | Q2 Exact vs IVF `CREATE VECTOR INDEX` trên `MEDICAL_DOCUMENTS`. | ✅ Hoàn thành 100% |
| 8 | `sql/09_optimize_q3_medical_records_index.sql` | Q3 tùy chọn: index hồ sơ bệnh án theo patient/created_at. | ✅ Hoàn thành 100% |
| 9 | `sql/10_property_graph.sql` | Seed chuyển tuyến 2 chặng + `CREATE PROPERTY GRAPH` + `GRAPH_TABLE`. | ✅ Hoàn thành 100% |
| 10 | `sql/11_test_sql_json.sql` | Kiểm thử `JSON_VALUE` / `JSON_TABLE` / `JSON_TRANSFORM`. | ✅ Hoàn thành 100% |
| 11 | `sql/run_all.sql` | Script tổng chạy toàn bộ pipeline SQL theo Phụ lục A. | ✅ Hoàn thành 100% |

---

## 2. CHI TIẾT KẾT QUẢ TRIỂN KHAI TỪNG GIAI ĐOẠN

### Giai đoạn 1: Chuẩn hóa Schema & Ràng buộc toàn vẹn (Mục 2.7 & 3.2)
- Khởi tạo 13 bảng: `HOSPITALS`, `DEPARTMENTS`, `DOCTORS`, `PATIENTS`, `ROOMS`, `BEDS`, `APPOINTMENTS`, `ADMISSIONS`, `REFERRALS`, `MEDICAL_RECORDS`, `AUDIT_LOGS`, `SYMPTOM_KNOWLEDGE`, `MEDICAL_DOCUMENTS`.
- Bảo đảm các Business Rules cốt lõi:
  - `BR01`: `PATIENTS(medical_code)` là duy nhất (`UNIQUE`).
  - `BR02`: `APPOINTMENTS(doctor_id, scheduled_at)` là duy nhất (`UNIQUE`), ngăn chặn race condition đặt trùng giờ ở tầng CSDL.
  - `BR03`: `BEDS(status)` chỉ nhận các giá trị: `AVAILABLE`, `OCCUPIED`, `MAINTENANCE`, `INACTIVE`.
  - `BR05`: `REFERRALS` kiểm tra `from_hospital_id <> to_hospital_id`.

### Giai đoạn 2: Package Nghiệp vụ lõi `PKG_HOSPITAL_OPS` (Mục 3.3)
- **Thủ tục phân giường có kiểm soát cạnh tranh `admit_patient`**:
  ```sql
  SELECT bed_id INTO v_bed_id FROM beds
  WHERE department_id = p_department_id AND status = 'AVAILABLE'
  FETCH FIRST 1 ROW ONLY
  FOR UPDATE SKIP LOCKED;

  UPDATE beds SET status = 'OCCUPIED' WHERE bed_id = v_bed_id;
  INSERT INTO admissions (...) VALUES (...) RETURNING admission_id INTO p_admission_id;
  ```
  - Cơ chế `FOR UPDATE SKIP LOCKED` cho phép session đến sau tự động bỏ qua dòng giường đang bị session trước khóa giao dịch, lập tức lấy giường trống tiếp theo hoặc báo lỗi `-20001: NO_BED_AVAILABLE`.
  - **Không xảy ra deadlock, không có độ trễ chờ khóa (wait lock), và tuyệt đối không bao giờ cấp trùng giường**.
- **Thủ tục đặt lịch `book_appointment`**:
  - Bắt lỗi `DUP_VAL_ON_INDEX` để quăng exception `-20002 (SLOT_ALREADY_BOOKED)`.
- **Thủ tục chuyển tuyến `create_referral` & Function đếm giường trống `available_beds`**.

### Giai đoạn 3: Triggers & Audit Logging (Mục 3.4)
- **Trigger `trg_medical_records_bu`**: `BEFORE UPDATE ON medical_records FOR EACH ROW` gán `:NEW.updated_at := SYSTIMESTAMP;`.
- **Trigger `trg_medical_records_audit`**: `AFTER INSERT OR UPDATE ON medical_records FOR EACH ROW` ghi bản ghi kiểm toán vào bảng `AUDIT_LOGS`:
  - `action`: `'INSERT'` hoặc `'UPDATE'`.
  - `old_data`: Lưu `:OLD.record_json` dạng JSON bản địa Oracle 23ai.
  - `new_data`: Lưu `:NEW.record_json` dạng JSON bản địa Oracle 23ai.
  - Thiết kế an toàn, không query ngược bảng đang kích hoạt, loại trừ 100% rủi ro lỗi **Mutating Table (ORA-04091)**.

### Giai đoạn 4: Kết quả Kiểm thử Giao dịch đồng thời (Mục 4.4 & Bảng 4.2)
Đã chạy thực nghiệm trên Docker container `oracle23ai` và ghi nhận kết quả:

```
>>> TEST CASE C1: Phân giường đồng thời (FOR UPDATE SKIP LOCKED)
1. Số giường trống tại Khoa 4 trước khi tiếp nhận: 1
2. [Session 1 Thành công] Cấp giường 999 cho Bệnh nhân 1 -> Admission ID: 100
3. [Session 2 Được bảo vệ] Nhận mã lỗi -20001 (NO_BED_AVAILABLE) -> Hệ thống tự động chặn cấp trùng!
4. Số giường trống sau khi xử lý: 0 (Trạng thái nhất quán hoàn hảo)
===> KẾT LUẬN C1: ĐẠT TIÊU CHUẨN (PASS)

>>> TEST CASE C2: Chặn đặt trùng slot khám cùng bác sĩ
1. [Request 1 Thành công] Đặt lịch Bác sĩ 1 lúc 10:00 -> Appointment ID: 100
2. [Request 2 Được chặn] Bắt lỗi ORA-20002 (SLOT_ALREADY_BOOKED) do Unique Constraint bảo vệ.
===> KẾT LUẬN C2: ĐẠT TIÊU CHUẨN (PASS)

>>> TEST CASE C3: Rollback giải phóng trạng thái giường khi có lỗi
1. Trạng thái giường 1 ban đầu: AVAILABLE
2. Phát sinh sự cố -> Đã thực hiện ROLLBACK transaction.
3. Trạng thái giường 1 sau khi rollback: AVAILABLE
===> KẾT LUẬN C3: ĐẠT TIÊU CHUẨN (PASS) - Giường không bị treo trạng thái rác!
```

### Giai đoạn 5: Tối ưu Truy vấn Q1 & Đo đạc Execution Plan (Mục 4.6 & Bảng 4.3)
- **Truy vấn Q1**: Tra cứu lịch khám bác sĩ theo khoảng thời gian và lọc trạng thái (`CONFIRMED`, `CHECKED_IN`).
- **Dữ liệu thực nghiệm**: 10.000 bản ghi lịch khám, thu thập Optimizer Statistics đầy đủ.
- **Bảng so sánh hiệu năng thực tế (Điền trực tiếp vào Bảng 4.3 của Báo cáo)**:

| Chỉ Số Đánh Giá | Trước Khi Tối Ưu (Chưa có Composite Index) | Sau Khi Tối Ưu (`idx_appointments_doctor_time`) | Đánh Giá Cải Thiện |
|:---|:---|:---|:---|
| **Access Path (Kiểu quét)** | `TABLE ACCESS FULL` (Quét toàn bộ 10.000 dòng) | `INDEX RANGE SCAN` trên chỉ mục kết hợp | Loại bỏ hoàn toàn Full Table Scan |
| **Phép sắp xếp** | Có phép `SORT ORDER BY` tốn CPU | Không cần `SORT ORDER BY` vì Index đã sắp xếp sẵn | Tiết kiệm chi phí sắp xếp trong bộ nhớ |
| **Optimizer Cost** | **69** | **14** (với 10.000 dòng) / **2** (trên tập mẫu lọc) | **Cost giảm gần 80%** |
| **CPU Usage** | 2% CPU overhead | 0% CPU overhead | Tối ưu hóa tài nguyên phần cứng máy chủ |

### Giai đoạn 6: Tích hợp Toàn diện Giao diện Web (UI, React Store & Oracle Backend)
- **Tích hợp Tiếp Nhận & Phân Giường Nội Trú (`POST /api/admissions`)**:
  - Tại trang **Quản Lý Bệnh Nhân** (`PatientsPage.tsx`), đã bổ sung nút hành động **"Tiếp Nhận & Cấp Giường"** và Modal điều phối nội trú.
  - Khi xác nhận, Web UI gọi trực tiếp endpoint `POST /api/admissions` $\to$ Backend Node.js thực thi `PKG_HOSPITAL_OPS.ADMIT_PATIENT` với `SELECT ... FOR UPDATE SKIP LOCKED`.
  - Giường được cập nhật sang `OCCUPIED`, bản ghi `ADMISSIONS` được tạo, bệnh nhân chuyển trạng thái sang `Nội trú` kèm sự kiện trên dòng thời gian Timeline.
  - Nếu khoa hết giường, hệ thống bắt mã lỗi `ORA-20001 (NO_BED_AVAILABLE)` và trả về mã HTTP `409 CONFLICT`, hiển thị cảnh báo đỏ trực quan trên Web.
  - **Ràng buộc nghiệp vụ chặn phân giường trùng (`ORA-20003: PATIENT_ALREADY_ADMITTED`)**: Nếu bệnh nhân đang có lượt điều trị nội trú (`status = 'ACTIVE'`), Oracle sẽ chặn ngay lập tức, không cho phép cấp thêm giường thứ hai.
  - **Quy trình Xuất Viện & Trả Giường (`POST /api/admissions/discharge`)**: Triển khai thủ tục `PKG_HOSPITAL_OPS.DISCHARGE_PATIENT`. Khi bệnh nhân đang ở trạng thái `Nội trú`, giao diện Web sẽ tự động chuyển nút bấm thành **"Xuất Viện & Trả Giường"** màu đỏ; khi bấm xuất viện, lượt điều trị chuyển sang `DISCHARGED`, giải phóng giường bệnh về `AVAILABLE` và cập nhật trạng thái bệnh nhân thành `Đã xuất viện`.

- **Kích hoạt Triggers khi Cập Nhật Bệnh Án từ Web (`PUT /api/records/:id`)**:
  - Khi bác sĩ chỉnh sửa bệnh án trên giao diện **Hồ Sơ Bệnh Án & Clinical Editor** (`MedicalRecordPage.tsx`) và bấm **"Lưu Hồ Sơ Bệnh Án"**:
    - Web UI gửi payload chuẩn hóa JSON đến `PUT /api/records/:id`.
    - Lệnh `UPDATE MEDICAL_RECORDS SET DIAGNOSIS_SUMMARY = ..., RECORD_JSON = ...` chạy trực tiếp trên Oracle 23ai.
    - Kích hoạt **Trigger `trg_medical_records_bu`**: Tự động cập nhật `UPDATED_AT = SYSTIMESTAMP`.
    - Kích hoạt **Trigger `trg_medical_records_audit`**: Tự động chụp dữ liệu cũ `:OLD.record_json` và dữ liệu mới `:NEW.record_json` ghi vào bảng `AUDIT_LOGS`.
  - Tại trang **Quản Trị & Nhật Ký** (`AdminAuditPage.tsx` hoặc URL `/admin-audit`):
    - Đã có nút **"F5 từ Oracle 23ai"** để đồng bộ nhật ký kiểm toán mới nhất.
    - Có nút **"🔍 Xem Chi Tiết JSON Audit (Oracle Trigger)"** mở modal so sánh trực quan dữ liệu trước và sau cập nhật (`OLD_DATA` và `NEW_DATA`).

---

## 3. HƯỚNG DẪN CHẠY KIỂM CHỨNG TẠI CHỖ KHI BẢO VỆ ĐỒ ÁN

Khi giảng viên ThS. Lê Thị Minh Nguyện yêu cầu chạy lại hoặc kiểm chứng tại chỗ:

```bash
# Lệnh chạy trọn gói toàn bộ 5 giai đoạn từ terminal:
docker exec -w /tmp/sql oracle23ai bash -c 'export NLS_LANG=AMERICAN_AMERICA.AL32UTF8; sqlplus -s "hospital_admin/$ORACLE_PWD@freepdb1" @run_all.sql'
```

Hoặc trong DBeaver / SQL Developer:
- Mở file `sql/05_tests_concurrency.sql` $\to$ Bấm Run Script (F5) để xem kết quả Pass của 3 ca đồng thời.
- Mở file `sql/06_optimize_q1_execution_plan.sql` $\to$ Bấm Run Script (F5) để xem 2 bảng `EXPLAIN PLAN` của Q1.

