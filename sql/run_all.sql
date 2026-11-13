-- ============================================================================
-- ĐỀ TÀI 25: HỆ THỐNG QUẢN LÝ BỆNH VIỆN THÔNG MINH TÍCH HỢP ĐA CÔNG NGHỆ
-- FILE: run_all.sql
-- MỤC ĐÍCH: Script tổng khởi chạy schema, dữ liệu và kiểm thử
-- THỨ TỰ CHẠY (THEO PHỤ LỤC A):
--   1. 01_schema.sql                 (Tạo bảng & ràng buộc toàn vẹn)
--   2. 07_vector_search_metadata.sql (Metadata phục vụ tìm kiếm vector)
--   3. 02_seed.sql                   (Nạp dữ liệu mẫu khởi tạo)
--   4. 03_package.sql                (Package PKG_HOSPITAL_OPS)
--   5. 04_triggers.sql               (2 Trigger cập nhật & audit JSON)
--   6. 05_tests_concurrency.sql      (Kiểm thử tranh chấp C1, C2, C3)
--   7. 06_optimize_q1_execution_plan.sql (Đo đạc Execution Plan Q1)
--   8. 08_optimize_q2_execution_plan.sql (Đo đạc Execution Plan Q2)
--   9. 09_test_sql_json.sql          (Kiểm thử SQL/JSON Functions)
-- ============================================================================
SET DEFINE OFF;
SET ECHO OFF;

PROMPT ============================================================================
PROMPT 1/9. CHẠY SCRIPT 01_schema.sql...
PROMPT ============================================================================
@@01_schema.sql;

PROMPT ============================================================================
PROMPT 2/9. CHẠY SCRIPT 07_vector_search_metadata.sql...
PROMPT ============================================================================
@@07_vector_search_metadata.sql;

PROMPT ============================================================================
PROMPT 3/9. CHẠY SCRIPT 02_seed.sql...
PROMPT ============================================================================
@@02_seed.sql;

PROMPT ============================================================================
PROMPT 4/9. CHẠY SCRIPT 03_package.sql...
PROMPT ============================================================================
@@03_package.sql;

PROMPT ============================================================================
PROMPT 5/9. CHẠY SCRIPT 04_triggers.sql...
PROMPT ============================================================================
@@04_triggers.sql;

PROMPT ============================================================================
PROMPT 6/9. CHẠY SCRIPT 05_tests_concurrency.sql...
PROMPT ============================================================================
@@05_tests_concurrency.sql;

PROMPT ============================================================================
PROMPT 7/9. CHẠY SCRIPT 06_optimize_q1_execution_plan.sql...
PROMPT ============================================================================
@@06_optimize_q1_execution_plan.sql;

PROMPT ============================================================================
PROMPT 8/9. CHẠY SCRIPT 08_optimize_q2_execution_plan.sql...
PROMPT ============================================================================
@@08_optimize_q2_execution_plan.sql;

PROMPT ============================================================================
PROMPT 9/9. CHẠY SCRIPT 09_test_sql_json.sql...
PROMPT ============================================================================
@@09_test_sql_json.sql;

PROMPT ============================================================================
PROMPT HOÀN THÀNH TOÀN BỘ CÁC SCRIPT KHỞI TẠO, DỮ LIỆU, TỐI ƯU VÀ KIỂM THỬ!
PROMPT ============================================================================

