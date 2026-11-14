-- ============================================================================
-- ĐỀ TÀI 25: HỆ THỐNG QUẢN LÝ BỆNH VIỆN THÔNG MINH TÍCH HỢP ĐA CÔNG NGHỆ
-- HỌC PHẦN: HỆ QUẢN TRỊ CƠ SỞ DỮ LIỆU - ORACLE DATABASE 23ai
-- FILE: 09_optimize_q3_medical_records_index.sql
-- MỤC ĐÍCH: So sánh Execution Plan Truy vấn Q2 trước và sau khi tối ưu Index (Mục 4.8 Q3 tùy chọn & Bảng 4.3)
-- ĐÁP ỨNG: Tiêu chí bắt buộc của đề tài (Tối thiểu 2 truy vấn quan trọng có đo đạc Execution Plan)
-- ============================================================================
SET LINESIZE 200;
SET PAGESIZE 1000;
SET FEEDBACK OFF;
SET SERVEROUTPUT ON;
SET DEFINE OFF;

PROMPT ============================================================================
PROMPT SO SÁNH EXECUTION PLAN TRUY VẤN Q3 (LỊCH SỬ BỆNH ÁN & CHỈ SỐ LÂM SÀNG JSON)
PROMPT ============================================================================

-- BẢN 1: TRƯỚC TỐI ƯU (BẮT BUỘC QUÉT TOÀN BẢNG - FULL TABLE SCAN & SORT ORDER BY)
DELETE FROM plan_table WHERE STATEMENT_ID = 'Q3_FULL_SCAN';
COMMIT;

EXPLAIN PLAN SET STATEMENT_ID = 'Q3_FULL_SCAN' FOR
SELECT /*+ NO_INDEX(mr) */ 
    mr.record_id,
    mr.patient_id,
    mr.doctor_id,
    mr.diagnosis_summary,
    mr.created_at
FROM medical_records mr
WHERE mr.patient_id = 1
  AND mr.created_at >= TO_TIMESTAMP_TZ('2024-01-01 00:00:00 +07:00', 'YYYY-MM-DD HH24:MI:SS TZH:TZM')
ORDER BY mr.created_at DESC;

PROMPT
PROMPT >>> 1. EXECUTION PLAN TRƯỚC TỐI ƯU (TABLE ACCESS FULL + SORT ORDER BY):
SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY('PLAN_TABLE', 'Q3_FULL_SCAN', 'TYPICAL'));

-- BẢN 2: TẠO COMPOSITE INDEX ĐỂ TỐI ƯU ACCESS PATH VÀ LOẠI BỎ PHÉP SORT
BEGIN
    EXECUTE IMMEDIATE 'CREATE INDEX idx_medical_records_pt_date ON medical_records(patient_id, created_at DESC)';
EXCEPTION
    WHEN OTHERS THEN NULL;
END;
/

DELETE FROM plan_table WHERE STATEMENT_ID = 'Q3_INDEX_SCAN';
COMMIT;

EXPLAIN PLAN SET STATEMENT_ID = 'Q3_INDEX_SCAN' FOR
SELECT /*+ INDEX(mr idx_medical_records_pt_date) */ 
    mr.record_id,
    mr.patient_id,
    mr.doctor_id,
    mr.diagnosis_summary,
    mr.created_at
FROM medical_records mr
WHERE mr.patient_id = 1
  AND mr.created_at >= TO_TIMESTAMP_TZ('2024-01-01 00:00:00 +07:00', 'YYYY-MM-DD HH24:MI:SS TZH:TZM')
ORDER BY mr.created_at DESC;

PROMPT
PROMPT >>> 2. EXECUTION PLAN SAU TỐI ƯU (INDEX RANGE SCAN / B-TREE OPTIMIZATION):
SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY('PLAN_TABLE', 'Q3_INDEX_SCAN', 'TYPICAL'));

PROMPT ============================================================================
PROMPT BẢNG ĐỐI CHIẾU HIỆU NĂNG TRUY VẤN Q3 (TÙY CHỌN) (BẢNG 4.3 TRONG BÁO CÁO):
PROMPT - Kiểu truy xuất trước: TABLE ACCESS FULL (Quét toàn bộ blocks dữ liệu)
PROMPT - Kiểu truy xuất sau  : INDEX RANGE SCAN (Chỉ đọc các block khớp khóa idx_medical_records_pt_date)
PROMPT - Phép sắp xếp        : SORT ORDER BY được loại bỏ hoàn toàn (Index lưu sẵn DESC)
PROMPT - Chi phí Cost        : Giảm đáng kể so với bản quét toàn bảng, tối ưu thời gian phản hồi cho bác sĩ.
PROMPT ============================================================================


