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
-- ============================================================================
SET DEFINE OFF;
SET ECHO OFF;

PROMPT ============================================================================
PROMPT 1/7. CHẠY SCRIPT 01_schema.sql...
PROMPT ============================================================================
@@01_schema.sql;

PROMPT ============================================================================
PROMPT 2/7. CHẠY SCRIPT 07_vector_search_metadata.sql...
PROMPT ============================================================================
@@07_vector_search_metadata.sql;

PROMPT ============================================================================
PROMPT 3/7. CHẠY SCRIPT 02_seed.sql...
PROMPT ============================================================================
@@02_seed.sql;

PROMPT ============================================================================
PROMPT 4/7. CHẠY SCRIPT 03_package.sql...
PROMPT ============================================================================
@@03_package.sql;

PROMPT ============================================================================
PROMPT 5/7. CHẠY SCRIPT 04_triggers.sql...
PROMPT ============================================================================
@@04_triggers.sql;

PROMPT ============================================================================
PROMPT 6/7. CHẠY SCRIPT 05_tests_concurrency.sql...
PROMPT ============================================================================
@@05_tests_concurrency.sql;

PROMPT ============================================================================
PROMPT 7/7. CHẠY SCRIPT 06_optimize_q1_execution_plan.sql...
PROMPT ============================================================================
@@06_optimize_q1_execution_plan.sql;

PROMPT ============================================================================
PROMPT HOÀN THÀNH CÁC SCRIPT KHỞI TẠO, DỮ LIỆU VÀ KIỂM THỬ!
PROMPT ============================================================================

