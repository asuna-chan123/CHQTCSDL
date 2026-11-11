-- ============================================================================
-- ĐỀ TÀI 25: HỆ THỐNG QUẢN LÝ BỆNH VIỆN THÔNG MINH TÍCH HỢP ĐA CÔNG NGHỆ
-- FILE: 03_package.sql
-- MỤC ĐÍCH: Đóng gói Package nghiệp vụ PKG_HOSPITAL_OPS
-- ĐẶC BIỆT: Phân giường an toàn với SELECT ... FOR UPDATE SKIP LOCKED
-- NGƯỜI THỰC HIỆN: Người 1 (Database Core, PL/SQL & Transaction Architect)
-- ============================================================================
SET DEFINE OFF;

CREATE OR REPLACE PACKAGE pkg_hospital_ops AS
  -- Các Exception nghiệp vụ định danh
  e_no_bed_available EXCEPTION;
  e_invalid_state    EXCEPTION;
  PRAGMA EXCEPTION_INIT(e_no_bed_available, -20001);

  -- 1. Đặt lịch khám (kiểm soát trùng lịch bằng Unique constraint)
  PROCEDURE book_appointment(
      p_patient_id     IN NUMBER,
      p_doctor_id      IN NUMBER,
      p_department_id  IN NUMBER,
      p_scheduled_at   IN TIMESTAMP,
      p_symptoms       IN VARCHAR2,
      p_appointment_id OUT NUMBER
  );

  -- 2. Phân giường bệnh nhân có kiểm soát cạnh tranh đồng thời (SKIP LOCKED)
  PROCEDURE admit_patient(
      p_patient_id    IN NUMBER,
      p_department_id IN NUMBER,
      p_admission_id  OUT NUMBER
  );

  -- 3. Tạo phiếu chuyển tuyến liên viện
  PROCEDURE create_referral(
      p_patient_id      IN NUMBER,
      p_from_hospital   IN NUMBER,
      p_to_hospital     IN NUMBER,
      p_reason          IN VARCHAR2,
      p_urgency         IN VARCHAR2,
      p_referral_id     OUT NUMBER
  );

  -- 4. Function thống kê số giường còn trống theo khoa
  FUNCTION available_beds(p_department_id IN NUMBER) RETURN NUMBER;

END pkg_hospital_ops;
/

CREATE OR REPLACE PACKAGE BODY pkg_hospital_ops AS

  -- --------------------------------------------------------------------------
  -- 1. ĐẶT LỊCH KHÁM BỆNH
  -- --------------------------------------------------------------------------
  PROCEDURE book_appointment(
      p_patient_id     IN NUMBER,
      p_doctor_id      IN NUMBER,
      p_department_id  IN NUMBER,
      p_scheduled_at   IN TIMESTAMP,
      p_symptoms       IN VARCHAR2,
      p_appointment_id OUT NUMBER
  ) IS
  BEGIN
      INSERT INTO appointments (
          patient_id,
          doctor_id,
          department_id,
          scheduled_at,
          symptoms,
          status,
          created_at
      ) VALUES (
          p_patient_id,
          p_doctor_id,
          p_department_id,
          p_scheduled_at,
          p_symptoms,
          'CONFIRMED',
          SYSTIMESTAMP
      ) RETURNING appointment_id INTO p_appointment_id;

  EXCEPTION
      WHEN DUP_VAL_ON_INDEX THEN
          -- Bắt lỗi khi vi phạm Unique Constraint (doctor_id, scheduled_at)
          RAISE_APPLICATION_ERROR(-20002, 'SLOT_ALREADY_BOOKED: Bác sĩ đã có lịch hẹn tại thời điểm này.');
      WHEN OTHERS THEN
          RAISE;
  END book_appointment;

  -- --------------------------------------------------------------------------
  -- 2. TIẾP NHẬN & PHÂN GIƯỜNG AN TOÀN (SELECT ... FOR UPDATE SKIP LOCKED)
  -- --------------------------------------------------------------------------
  PROCEDURE admit_patient(
      p_patient_id    IN NUMBER,
      p_department_id IN NUMBER,
      p_admission_id  OUT NUMBER
  ) IS
      v_bed_id beds.bed_id%TYPE;
  BEGIN
      -- Khóa 1 hàng giường trống, bỏ qua các giường đang bị session khác khóa
      SELECT bed_id
        INTO v_bed_id
        FROM beds
       WHERE department_id = p_department_id
         AND status = 'AVAILABLE'
       FETCH FIRST 1 ROW ONLY
       FOR UPDATE SKIP LOCKED;

      -- Đổi trạng thái giường sang OCCUPIED trong cùng transaction
      UPDATE beds
         SET status = 'OCCUPIED'
       WHERE bed_id = v_bed_id;

      -- Tạo bản ghi tiếp nhận điều trị nội trú
      INSERT INTO admissions (
          patient_id,
          bed_id,
          admitted_at,
          status,
          created_at
      ) VALUES (
          p_patient_id,
          v_bed_id,
          SYSTIMESTAMP,
          'ACTIVE',
          SYSTIMESTAMP
      ) RETURNING admission_id INTO p_admission_id;

  EXCEPTION
      WHEN NO_DATA_FOUND THEN
          -- Không còn giường AVAILABLE nào (hoặc tất cả đều đang bị lock)
          RAISE_APPLICATION_ERROR(-20001, 'NO_BED_AVAILABLE');
      WHEN OTHERS THEN
          RAISE;
  END admit_patient;

  -- --------------------------------------------------------------------------
  -- 3. TẠO PHIẾU CHUYỂN TUYẾN
  -- --------------------------------------------------------------------------
  PROCEDURE create_referral(
      p_patient_id      IN NUMBER,
      p_from_hospital   IN NUMBER,
      p_to_hospital     IN NUMBER,
      p_reason          IN VARCHAR2,
      p_urgency         IN VARCHAR2,
      p_referral_id     OUT NUMBER
  ) IS
  BEGIN
      IF p_from_hospital = p_to_hospital THEN
          RAISE_APPLICATION_ERROR(-20003, 'INVALID_REFERRAL: Bệnh viện chuyển và bệnh viện nhận không được trùng nhau.');
      END IF;

      INSERT INTO referrals (
          patient_id,
          from_hospital_id,
          to_hospital_id,
          reason,
          urgency,
          status,
          referral_time
      ) VALUES (
          p_patient_id,
          p_from_hospital,
          p_to_hospital,
          p_reason,
          NVL(p_urgency, 'NORMAL'),
          'PENDING',
          SYSTIMESTAMP
      ) RETURNING referral_id INTO p_referral_id;

  EXCEPTION
      WHEN OTHERS THEN
          RAISE;
  END create_referral;

  -- --------------------------------------------------------------------------
  -- 4. FUNCTION ĐẾM SỐ GIƯỜNG CÒN TRỐNG
  -- --------------------------------------------------------------------------
  FUNCTION available_beds(p_department_id IN NUMBER) RETURN NUMBER IS
      v_count NUMBER;
  BEGIN
      SELECT COUNT(*)
        INTO v_count
        FROM beds
       WHERE department_id = p_department_id
         AND status = 'AVAILABLE';
      RETURN v_count;
  END available_beds;

END pkg_hospital_ops;
/
