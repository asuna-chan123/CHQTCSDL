-- ============================================================================
-- ĐỀ TÀI 25: HỆ THỐNG QUẢN LÝ BỆNH VIỆN THÔNG MINH TÍCH HỢP ĐA CÔNG NGHỆ
-- FILE: run_all.sql
-- MỤC ĐÍCH: Script tổng khởi chạy schema, dữ liệu, graph, tối ưu và kiểm thử
-- THỨ TỰ CHẠY (KHỚP PHỤ LỤC A BÁO CÁO):
--   1. 01_schema.sql
--   2. 07_vector_search_metadata.sql
--   3. 02_seed.sql
--   4. 03_package.sql
--   5. 04_triggers.sql
--   6. 05_tests_concurrency.sql
--   7. 06_optimize_q1_execution_plan.sql   (Q1 B-tree appointments)
--   8. 08_optimize_q2_vector_index.sql     (Q2 IVF vector index)
--   9. 09_optimize_q3_medical_records_index.sql (Q3 tùy chọn)
--  10. 10_property_graph.sql
--  11. 11_test_sql_json.sql
-- ============================================================================
SET DEFINE OFF;
SET ECHO OFF;
SET SERVEROUTPUT ON;

PROMPT ============================================================================
PROMPT 1/11. CHẠY SCRIPT 01_schema.sql...
PROMPT ============================================================================
@@01_schema.sql;

PROMPT ============================================================================
PROMPT 2/11. CHẠY SCRIPT 07_vector_search_metadata.sql...
PROMPT ============================================================================
@@07_vector_search_metadata.sql;

PROMPT ============================================================================
PROMPT 3/11. CHẠY SCRIPT 02_seed.sql...
PROMPT ============================================================================
@@02_seed.sql;

PROMPT ============================================================================
PROMPT 4/11. CHẠY SCRIPT 03_package.sql...
PROMPT ============================================================================
@@03_package.sql;

PROMPT ============================================================================
PROMPT 5/11. CHẠY SCRIPT 04_triggers.sql...
PROMPT ============================================================================
@@04_triggers.sql;

PROMPT ============================================================================
PROMPT 6/11. CHẠY SCRIPT 05_tests_concurrency.sql...
PROMPT ============================================================================
@@05_tests_concurrency.sql;

PROMPT ============================================================================
PROMPT 7/11. CHẠY SCRIPT 06_optimize_q1_execution_plan.sql...
PROMPT ============================================================================
@@06_optimize_q1_execution_plan.sql;

PROMPT ============================================================================
PROMPT 8/11. CHẠY SCRIPT 08_optimize_q2_vector_index.sql...
PROMPT ============================================================================
@@08_optimize_q2_vector_index.sql;

PROMPT ============================================================================
PROMPT 9/11. CHẠY SCRIPT 09_optimize_q3_medical_records_index.sql...
PROMPT ============================================================================
@@09_optimize_q3_medical_records_index.sql;

PROMPT ============================================================================
PROMPT 10/11. CHẠY SCRIPT 10_property_graph.sql...
PROMPT ============================================================================
@@10_property_graph.sql;

PROMPT ============================================================================
PROMPT 11/11. CHẠY SCRIPT 11_test_sql_json.sql...
PROMPT ============================================================================
@@11_test_sql_json.sql;

PROMPT ============================================================================
PROMPT HOÀN THÀNH TOÀN BỘ SCRIPT KHỞI TẠO, GRAPH, VECTOR INDEX, TỐI ƯU VÀ KIỂM THỬ!
PROMPT ============================================================================
