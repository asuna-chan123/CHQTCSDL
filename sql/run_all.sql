-- ============================================================================
-- ĐỀ TÀI 25: HỆ THỐNG QUẢN LÝ BỆNH VIỆN THÔNG MINH TÍCH HỢP ĐA CÔNG NGHỆ
-- FILE: run_all.sql
-- MỤC ĐÍCH: Script tổng khởi chạy toàn bộ 5 giai đoạn của Người 1
-- THỨ TỰ CHẠY (THEO PHỤ LỤC A):
--   1. 01_schema.sql                 (Tạo bảng & ràng buộc toàn vẹn)
--   2. 02_seed.sql                   (Nạp dữ liệu mẫu khởi tạo)
--   3. 03_package.sql                (Package PKG_HOSPITAL_OPS)
--   4. 04_triggers.sql               (2 Trigger cập nhật & audit JSON)
--   5. 05_tests_concurrency.sql      (Kiểm thử tranh chấp C1, C2, C3)
--   6. 06_optimize_q1_execution_plan.sql (Đo đạc Execution Plan Q1)
-- ============================================================================
SET DEFINE OFF;
SET ECHO OFF;

PROMPT ============================================================================
PROMPT 1/6. CHẠY SCRIPT 01_schema.sql...
PROMPT ============================================================================
@@01_schema.sql;

PROMPT ============================================================================
PROMPT 2/6. CHẠY SCRIPT 02_seed.sql...
PROMPT ============================================================================
@@02_seed.sql;

PROMPT ============================================================================
PROMPT 2b. CHẠY SCRIPT 07_seed_symptom_knowledge.sql (tri thức cho tìm kiếm nhanh)...
PROMPT ============================================================================
@@07_seed_symptom_knowledge.sql;

PROMPT ============================================================================
PROMPT 3/6. CHẠY SCRIPT 03_package.sql...
PROMPT ============================================================================
@@03_package.sql;

PROMPT ============================================================================
PROMPT 4/6. CHẠY SCRIPT 04_triggers.sql...
PROMPT ============================================================================
@@04_triggers.sql;

PROMPT ============================================================================
PROMPT 5/6. CHẠY SCRIPT 05_tests_concurrency.sql...
PROMPT ============================================================================
@@05_tests_concurrency.sql;

PROMPT ============================================================================
PROMPT 6/6. CHẠY SCRIPT 06_optimize_q1_execution_plan.sql...
PROMPT ============================================================================
@@06_optimize_q1_execution_plan.sql;

PROMPT ============================================================================
PROMPT HOÀN THÀNH TOÀN BỘ 5 GIAI ĐOẠN CỦA NGƯỜI 1 THÀNH CÔNG RỰC RỠ!
PROMPT ============================================================================

