-- ============================================================================
-- ĐỀ TÀI 25: HỆ THỐNG QUẢN LÝ BỆNH VIỆN THÔNG MINH TÍCH HỢP ĐA CÔNG NGHỆ
-- FILE: 04_triggers.sql
-- MỤC ĐÍCH: Cài đặt 2 Trigger tự động cập nhật metadata và ghi nhật ký kiểm toán JSON
-- NGƯỜI THỰC HIỆN: Người 1 (Database Core, PL/SQL & Transaction Architect)
-- ============================================================================
SET DEFINE OFF;

-- 1. TRIGGER TỰ ĐỘNG CẬP NHẬT UPDATED_AT KHI SỬA HỒ SƠ BỆNH ÁN
CREATE OR REPLACE TRIGGER trg_medical_records_bu
BEFORE UPDATE ON medical_records
FOR EACH ROW
BEGIN
    :NEW.updated_at := SYSTIMESTAMP;
END;
/

-- 2. TRIGGER GHI NHẬT KÝ KIỂM TOÁN (AUDIT TRAIL) LƯU JSON CŨ VÀ MỚI
CREATE OR REPLACE TRIGGER trg_medical_records_audit
AFTER INSERT OR UPDATE ON medical_records
FOR EACH ROW
DECLARE
    v_action   VARCHAR2(20);
    v_old_data JSON;
BEGIN
    IF INSERTING THEN
        v_action := 'INSERT';
        v_old_data := NULL;
    ELSE
        v_action := 'UPDATE';
        v_old_data := :OLD.record_json;
    END IF;

    INSERT INTO audit_logs (
        entity_name,
        action,
        entity_id,
        actor_identifier,
        old_data,
        new_data,
        created_at
    ) VALUES (
        'MEDICAL_RECORDS',
        v_action,
        :NEW.record_id,
        'HỆ THỐNG / BÁC SĨ',
        v_old_data,
        :NEW.record_json,
        SYSTIMESTAMP
    );
END;
/
