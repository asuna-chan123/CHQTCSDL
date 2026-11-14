-- ============================================================================
-- ĐỀ TÀI 25: HỆ THỐNG QUẢN LÝ BỆNH VIỆN THÔNG MINH TÍCH HỢP ĐA CÔNG NGHỆ
-- HỌC PHẦN: HỆ QUẢN TRỊ CƠ SỞ DỮ LIỆU - ORACLE DATABASE 23ai
-- FILE: 09_test_sql_json.sql
-- MỤC ĐÍCH: Kiểm thử và minh chứng 3 hàm SQL/JSON cốt lõi theo Mục 3.5 & Mã 3.7
--   1. JSON_VALUE      : Trích xuất trường vô hướng (scalar)
--   2. JSON_TABLE      : Bung mảng JSON lồng nhau thành các dòng/cột quan hệ
--   3. JSON_TRANSFORM  : Cập nhật cục bộ một trường mà không ghi đè toàn bộ document
-- ============================================================================
SET LINESIZE 200;
SET PAGESIZE 1000;
SET SERVEROUTPUT ON;
SET DEFINE OFF;

PROMPT ============================================================================
PROMPT 1. KIỂM THỬ TRUY VẤN JSON_VALUE (Trích xuất nhiệt độ và SpO2 từ RECORD_JSON)
PROMPT ============================================================================

SELECT 
    mr.record_id,
    p.medical_code,
    p.full_name,
    JSON_VALUE(mr.record_json, '$.vitals.temperature' RETURNING NUMBER) AS temperature_c,
    JSON_VALUE(mr.record_json, '$.vitals.spo2' RETURNING NUMBER) AS spo2_pct,
    JSON_VALUE(mr.record_json, '$.vitals.heart_rate' RETURNING NUMBER) AS heart_rate_bpm,
    JSON_VALUE(mr.record_json, '$.vitals.blood_pressure') AS blood_pressure
FROM medical_records mr
JOIN patients p ON mr.patient_id = p.patient_id;

PROMPT
PROMPT ============================================================================
PROMPT 2. KIỂM THỬ TRUY VẤN JSON_TABLE (Bung mảng symptoms[*] thành bảng quan hệ)
PROMPT ============================================================================

SELECT 
    mr.record_id,
    p.full_name AS patient_name,
    jt.symptom_name,
    jt.severity,
    jt.duration
FROM medical_records mr
JOIN patients p ON mr.patient_id = p.patient_id,
JSON_TABLE(mr.record_json, '$.symptoms[*]'
    COLUMNS (
        symptom_name VARCHAR2(200) PATH '$.name',
        severity     NUMBER        PATH '$.severity',
        duration     VARCHAR2(100) PATH '$.duration'
    )
) jt
ORDER BY mr.record_id, jt.severity DESC;

PROMPT
PROMPT ============================================================================
PROMPT 3. KIỂM THỬ CẬP NHẬT CỤC BỘ BẰNG JSON_TRANSFORM
PROMPT (Cập nhật SpO2 = 99 và nhiệt độ = 36.8 mà không thay đổi các trường khác)
PROMPT ============================================================================

-- Giá trị SpO2 trước khi cập nhật:
SELECT 
    record_id,
    JSON_VALUE(record_json, '$.vitals.spo2') AS spo2_before,
    updated_at AS updated_at_before
FROM medical_records
WHERE record_id = 1;

-- Thực hiện JSON_TRANSFORM:
UPDATE medical_records
SET record_json = JSON_TRANSFORM(
    record_json,
    SET '$.vitals.spo2' = 99,
    SET '$.vitals.temperature' = 36.8
)
WHERE record_id = 1;

COMMIT;

-- Giá trị sau khi cập nhật (Trigger BU đã cập nhật updated_at và Audit Trigger ghi log):
SELECT 
    record_id,
    JSON_VALUE(record_json, '$.vitals.spo2') AS spo2_after,
    JSON_VALUE(record_json, '$.vitals.temperature') AS temp_after,
    updated_at AS updated_at_after
FROM medical_records
WHERE record_id = 1;

PROMPT
PROMPT ============================================================================
PROMPT 4. KIỂM TRA NHẬT KÝ KIỂM TOÁN TỰ ĐỘNG SINH RA TỪ TRIGGER (AUDIT_LOGS)
PROMPT ============================================================================

SELECT 
    log_id,
    entity_name,
    action,
    entity_id,
    actor_identifier,
    TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS') AS log_time
FROM audit_logs
WHERE entity_name = 'MEDICAL_RECORDS'
ORDER BY log_id DESC
FETCH FIRST 3 ROWS ONLY;

PROMPT ============================================================================
PROMPT HOÀN TẤT KIỂM THỬ SQL/JSON ORACLE 23ai (PASS)
PROMPT ============================================================================

