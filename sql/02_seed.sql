-- ============================================================================
-- FILE: 02_seed.sql
-- MỤC ĐÍCH: Dữ liệu mẫu chuẩn cho hệ thống quản lý bệnh viện
-- ============================================================================
SET DEFINE OFF;

-- 1. HOSPITALS
INSERT INTO hospitals (hospital_id, code, name, level_name, province, address)
VALUES (1, 'BV-BM-01', 'Bệnh Viện Bạch Mai', 'Hạng Đặc Biệt', 'Hà Nội', '78 Đường Giải Phóng, Phương Mai, Đống Đa, Hà Nội');

INSERT INTO hospitals (hospital_id, code, name, level_name, province, address)
VALUES (2, 'BV-CG-02', 'Bệnh Viện Đa Khoa Cầu Giấy', 'Hạng II', 'Hà Nội', 'Số 29 Trương Công Giai, Dịch Vọng, Cầu Giấy, Hà Nội');

INSERT INTO hospitals (hospital_id, code, name, level_name, province, address)
VALUES (3, 'BV-CR-03', 'Bệnh Viện Chợ Rẫy', 'Hạng Đặc Biệt', 'TP. Hồ Chí Minh', '201B Nguyễn Chí Thanh, Phường 12, Quận 5, TP.HCM');

INSERT INTO hospitals (hospital_id, code, name, level_name, province, address)
VALUES (4, 'BV-VD-04', 'Bệnh Viện Hữu Nghị Việt Đức', 'Hạng Đặc Biệt', 'Hà Nội', '40 Tràng Thi, Hoàn Kiếm, Hà Nội');

-- 2. DEPARTMENTS
INSERT INTO departments (department_id, hospital_id, code, name, specialty)
VALUES (1, 1, 'K-TIM-MACH', 'Khoa Tim Mạch Can Thiệp', 'Tim mạch');

INSERT INTO departments (department_id, hospital_id, code, name, specialty)
VALUES (2, 1, 'K-NOI-TIET', 'Khoa Nội Tiết & Đái Tháo Đường', 'Nội tiết');

INSERT INTO departments (department_id, hospital_id, code, name, specialty)
VALUES (3, 1, 'K-HO-HAP', 'Khoa Hô Hấp', 'Hô hấp & Phổi');

INSERT INTO departments (department_id, hospital_id, code, name, specialty)
VALUES (4, 1, 'K-CAP-CUU', 'Trung Tâm Cấp Cứu A9', 'Hồi sức cấp cứu');

-- 3. DOCTORS
INSERT INTO doctors (doctor_id, department_id, full_name, license_no, phone, status)
VALUES (1, 1, 'BS. CKII Nguyễn Văn An', 'CCHN-001293-HN', '0912000001', 'ACTIVE');

INSERT INTO doctors (doctor_id, department_id, full_name, license_no, phone, status)
VALUES (2, 2, 'BS. Lê Thị Bích Ngọc', 'CCHN-002345-HN', '0912000002', 'ACTIVE');

INSERT INTO doctors (doctor_id, department_id, full_name, license_no, phone, status)
VALUES (3, 1, 'BS. Trần Mai Anh', 'CCHN-003456-HN', '0912000003', 'ACTIVE');

INSERT INTO doctors (doctor_id, department_id, full_name, license_no, phone, status)
VALUES (4, 4, 'BS. Phạm Đức Thắng', 'CCHN-004567-HN', '0912000004', 'ACTIVE');

-- 4. PATIENTS
INSERT INTO patients (patient_id, medical_code, full_name, dob, gender, phone, address)
VALUES (1, 'BN-2024-001', 'Phạm Quang Minh', DATE '1968-05-14', 'Nam', '0912 345 678', 'Số 42 Phố Huế, Hoàn Kiếm, Hà Nội');

INSERT INTO patients (patient_id, medical_code, full_name, dob, gender, phone, address)
VALUES (2, 'BN-2024-002', 'Hoàng Thị Mai Lan', DATE '1975-11-23', 'Nữ', '0988 765 432', '28 Đường Nguyễn Trãi, Thanh Xuân, Hà Nội');

INSERT INTO patients (patient_id, medical_code, full_name, dob, gender, phone, address)
VALUES (3, 'BN-2024-003', 'Vũ Đình Cường', DATE '1952-03-08', 'Nam', '0903 112 334', 'Khu Đô Thị Ecopark, Văn Giang, Hưng Yên');

INSERT INTO patients (patient_id, medical_code, full_name, dob, gender, phone, address)
VALUES (4, 'BN-2024-004', 'Đỗ Thúy Hằng', DATE '1990-09-12', 'Nữ', '0977 889 900', '102 Hoàng Hoa Thám, Ba Đình, Hà Nội');

INSERT INTO patients (patient_id, medical_code, full_name, dob, gender, phone, address)
VALUES (5, 'BN-2024-005', 'Nguyễn Thế Hùng', DATE '1983-12-05', 'Nam', '0936 221 144', '15 Lê Trọng Tấn, Thanh Xuân, Hà Nội');

-- 5. ROOMS & BEDS
INSERT INTO rooms (room_id, department_id, room_number, room_type, floor_no, status)
VALUES (1, 1, 'P.301-TM', 'Phòng Hồi Sức Tích Cực', 3, 'ACTIVE');

INSERT INTO rooms (room_id, department_id, room_number, room_type, floor_no, status)
VALUES (2, 1, 'P.302-TM', 'Phòng Điều Trị Tiêu Chuẩn', 3, 'ACTIVE');

INSERT INTO rooms (room_id, department_id, room_number, room_type, floor_no, status)
VALUES (3, 2, 'P.405-NT', 'Phòng Nội Trú', 4, 'ACTIVE');

-- Cấp các giường ban đầu (Department 1 có giường 1, 2, 3; Department 2 có giường 4)
INSERT INTO beds (bed_id, room_id, department_id, bed_code, status)
VALUES (1, 1, 1, 'G-301-01', 'AVAILABLE');

INSERT INTO beds (bed_id, room_id, department_id, bed_code, status)
VALUES (2, 1, 1, 'G-301-02', 'AVAILABLE');

INSERT INTO beds (bed_id, room_id, department_id, bed_code, status)
VALUES (3, 2, 1, 'G-302-01', 'AVAILABLE');

INSERT INTO beds (bed_id, room_id, department_id, bed_code, status)
VALUES (4, 3, 2, 'G-405-01', 'AVAILABLE');

-- 6. APPOINTMENTS
INSERT INTO appointments (appointment_id, patient_id, doctor_id, department_id, scheduled_at, status, symptoms)
VALUES (1, 1, 1, 1, TO_TIMESTAMP_TZ('2026-11-15 08:30:00 +07:00', 'YYYY-MM-DD HH24:MI:SS TZH:TZM'), 'CONFIRMED', 'Đau thắt ngực trái lan lên cằm');

INSERT INTO appointments (appointment_id, patient_id, doctor_id, department_id, scheduled_at, status, symptoms)
VALUES (2, 2, 2, 2, TO_TIMESTAMP_TZ('2026-11-15 09:30:00 +07:00', 'YYYY-MM-DD HH24:MI:SS TZH:TZM'), 'CONFIRMED', 'Tái khám Đái tháo đường Type 2');

-- 7. MEDICAL RECORDS (với dữ liệu JSON)
INSERT INTO medical_records (record_id, patient_id, appointment_id, doctor_id, diagnosis_summary, record_json)
VALUES (
    1, 1, 1, 1,
    'Đau thắt ngực không ổn định (I20.0), Tăng huyết áp độ II',
    JSON('{
        "vitals": {"temperature": 37.2, "blood_pressure": "145/90", "heart_rate": 84, "spo2": 97},
        "symptoms": [
            {"name": "đau tức ngực trái", "severity": 7, "duration": "3 giờ"},
            {"name": "vã mồ hôi, hồi hộp", "severity": 6}
        ],
        "diagnoses": [{"code": "I20.0", "name": "Đau thắt ngực không ổn định"}],
        "lab_results": [{"test": "Troponin T hs", "value": 14.5, "unit": "ng/L"}],
        "medications": [{"name": "Aspirin", "dose": "81mg", "frequency": "1 viên/ngày"}],
        "notes": "Chỉ định theo dõi liên tục tại phòng tim mạch can thiệp."
    }')
);

COMMIT;

