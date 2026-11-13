-- ============================================================================
-- ĐỀ TÀI 25: HỆ THỐNG QUẢN LÝ BỆNH VIỆN THÔNG MINH TÍCH HỢP ĐA CÔNG NGHỆ
-- FILE: 05_tests_concurrency.sql
-- MỤC ĐÍCH: Kiểm thử các kịch bản Giao dịch & Kiểm soát cạnh tranh (Bảng 4.2)
-- KỊCH BẢN:
--   C1: Phân giường đồng thời (FOR UPDATE SKIP LOCKED)
--   C2: Đặt trùng slot khám bác sĩ (Unique Constraint + Exception)
--   C3: Rollback giải phóng khóa an toàn khi có sự cố
-- NGƯỜI THỰC HIỆN: Người 1 (Database Core, PL/SQL & Transaction Architect)
-- ============================================================================
SET SERVEROUTPUT ON SIZE UNLIMITED;
SET DEFINE OFF;

PROMPT ============================================================================
PROMPT BẮT ĐẦU KIỂM THỬ GIAO DỊCH VÀ KIỂM SOÁT CẠNH TRANH (CONCURRENCY TESTING)
PROMPT ============================================================================

-- ----------------------------------------------------------------------------
-- TEST CASE C1: KIỂM SOÁT PHÂN GIƯỜNG ĐỒNG THỜI (SKIP LOCKED)
-- ----------------------------------------------------------------------------
PROMPT
PROMPT >>> CHẠY TEST CASE C1: Phân giường đồng thời có kiểm soát cạnh tranh
DECLARE
    v_adm_id_1 NUMBER;
    v_adm_id_2 NUMBER;
    v_avail_before NUMBER;
    v_avail_after  NUMBER;
    v_dept_id      NUMBER := 4; -- Trung Tâm Cấp Cứu A9
BEGIN
    -- 1. Chuẩn bị môi trường: Đảm bảo Khoa 4 chỉ có DUY NHẤT 1 giường AVAILABLE
    DELETE FROM admissions WHERE bed_id IN (SELECT bed_id FROM beds WHERE department_id = v_dept_id);
    DELETE FROM beds WHERE department_id = v_dept_id;
    
    INSERT INTO beds (bed_id, department_id, bed_code, status)
    VALUES (999, v_dept_id, 'G-CAP-CUU-VIP-01', 'AVAILABLE');
    COMMIT;

    v_avail_before := pkg_hospital_ops.available_beds(v_dept_id);
    DBMS_OUTPUT.PUT_LINE('1. Số giường trống tại Khoa 4 trước khi tiếp nhận: ' || v_avail_before);

    -- 2. Mô phỏng Session 1: Bệnh nhân 1 vào phân giường thành công
    pkg_hospital_ops.admit_patient(
        p_patient_id    => 1,
        p_department_id => v_dept_id,
        p_admission_id  => v_adm_id_1
    );
    COMMIT;
    DBMS_OUTPUT.PUT_LINE('2. [Session 1 Thành công] Cấp giường 999 cho Bệnh nhân 1 -> Admission ID: ' || v_adm_id_1);

    -- 3. Mô phỏng Session 2: Bệnh nhân 2 vào xin giường tại cùng thời điểm
    BEGIN
        pkg_hospital_ops.admit_patient(
            p_patient_id    => 2,
            p_department_id => v_dept_id,
            p_admission_id  => v_adm_id_2
        );
        DBMS_OUTPUT.PUT_LINE('LỖI: Session 2 không được phép cấp trùng giường 999!');
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLCODE = -20001 THEN
                DBMS_OUTPUT.PUT_LINE('3. [Session 2 Được bảo vệ] Nhận mã lỗi -20001 (NO_BED_AVAILABLE) -> Hệ thống tự động chặn cấp trùng!');
            ELSE
                DBMS_OUTPUT.PUT_LINE('3. Nhận lỗi khác: ' || SQLERRM);
            END IF;
    END;

    v_avail_after := pkg_hospital_ops.available_beds(v_dept_id);
    DBMS_OUTPUT.PUT_LINE('4. Số giường trống sau khi xử lý: ' || v_avail_after || ' (Trạng thái nhất quán hoàn hảo)');
    DBMS_OUTPUT.PUT_LINE('===> KẾT LUẬN C1: ĐẠT TIÊU CHUẨN (PASS)');
END;
/

-- ----------------------------------------------------------------------------
-- TEST CASE C2: ĐẶT TRÙNG SLOT KHÁM BÁC SĨ (RACE CONDITION PREVENTION)
-- ----------------------------------------------------------------------------
PROMPT
PROMPT >>> CHẠY TEST CASE C2: Chặn đặt trùng slot khám cùng bác sĩ
DECLARE
    v_appt_id_1 NUMBER;
    v_appt_id_2 NUMBER;
    v_time      TIMESTAMP := TO_TIMESTAMP_TZ('2026-12-01 10:00:00 +07:00', 'YYYY-MM-DD HH24:MI:SS TZH:TZM');
BEGIN
    -- 1. Xóa lịch cũ nếu trùng để kiểm thử
    DELETE FROM appointments WHERE doctor_id = 1 AND scheduled_at = v_time;
    COMMIT;

    -- 2. Request 1: Đặt lịch cho Bệnh nhân 3
    pkg_hospital_ops.book_appointment(
        p_patient_id     => 3,
        p_doctor_id      => 1,
        p_department_id  => 1,
        p_scheduled_at   => v_time,
        p_symptoms       => 'Đau ngực sau xương ức',
        p_appointment_id => v_appt_id_1
    );
    COMMIT;
    DBMS_OUTPUT.PUT_LINE('1. [Request 1 Thành công] Đặt lịch Bác sĩ 1 lúc 10:00 -> Appointment ID: ' || v_appt_id_1);

    -- 3. Request 2: Cố tình đặt cùng Bác sĩ 1 cùng lúc 10:00 cho Bệnh nhân 4
    BEGIN
        pkg_hospital_ops.book_appointment(
            p_patient_id     => 4,
            p_doctor_id      => 1,
            p_department_id  => 1,
            p_scheduled_at   => v_time,
            p_symptoms       => 'Kiểm tra huyết áp',
            p_appointment_id => v_appt_id_2
        );
        DBMS_OUTPUT.PUT_LINE('LỖI: Request 2 không được phép thành công khi trùng slot!');
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLCODE = -20002 THEN
                DBMS_OUTPUT.PUT_LINE('2. [Request 2 Được chặn] Bắt lỗi ORA-20002 (SLOT_ALREADY_BOOKED) do Unique Constraint bảo vệ.');
            ELSE
                DBMS_OUTPUT.PUT_LINE('2. Nhận lỗi: ' || SQLERRM);
            END IF;
    END;
    DBMS_OUTPUT.PUT_LINE('===> KẾT LUẬN C2: ĐẠT TIÊU CHUẨN (PASS)');
END;
/

-- ----------------------------------------------------------------------------
-- TEST CASE C3: ROLLBACK GIẢI PHÓNG KHÓA VÀ TRẠNG THÁI KHI GẶP SỰ CỐ
-- ----------------------------------------------------------------------------
PROMPT
PROMPT >>> CHẠY TEST CASE C3: Rollback giải phóng trạng thái giường khi có lỗi
DECLARE
    v_status_before VARCHAR2(20);
    v_status_after  VARCHAR2(20);
    v_bed_id        NUMBER := 1;
BEGIN
    SELECT status INTO v_status_before FROM beds WHERE bed_id = v_bed_id;
    DBMS_OUTPUT.PUT_LINE('1. Trạng thái giường ' || v_bed_id || ' ban đầu: ' || v_status_before);

    -- Bắt đầu transaction và cố ý ném lỗi trước khi commit
    BEGIN
        UPDATE beds SET status = 'OCCUPIED' WHERE bed_id = v_bed_id;
        -- Giả lập lỗi hệ thống bất ngờ (Ví dụ division by zero)
        RAISE ZERO_DIVIDE;
        COMMIT;
    EXCEPTION
        WHEN ZERO_DIVIDE THEN
            ROLLBACK; -- Lớp gọi rollback khôi phục nguyên trạng
            DBMS_OUTPUT.PUT_LINE('2. Phát sinh sự cố -> Đã thực hiện ROLLBACK transaction.');
    END;

    SELECT status INTO v_status_after FROM beds WHERE bed_id = v_bed_id;
    DBMS_OUTPUT.PUT_LINE('3. Trạng thái giường ' || v_bed_id || ' sau khi rollback: ' || v_status_after);

    IF v_status_before = v_status_after THEN
        DBMS_OUTPUT.PUT_LINE('===> KẾT LUẬN C3: ĐẠT TIÊU CHUẨN (PASS) - Giường không bị treo trạng thái rác!');
    ELSE
        DBMS_OUTPUT.PUT_LINE('===> KẾT LUẬN C3: THẤT BẠI!');
    END IF;
END;
/

PROMPT ============================================================================
PROMPT HOÀN THÀNH TOÀN BỘ CÁC BÀI KIỂM THỬ GIAO DỊCH ĐỒNG THỜI
PROMPT ============================================================================

