-- ============================================================================
-- ĐỀ TÀI 25: HỆ THỐNG QUẢN LÝ BỆNH VIỆN THÔNG MINH TÍCH HỢP ĐA CÔNG NGHỆ
-- FILE: 10_property_graph.sql
-- MỤC ĐÍCH: Seed chuyển tuyến 2 chặng + CREATE PROPERTY GRAPH + truy vấn GRAPH_TABLE
-- ĐÁP ỨNG: Mục 2.9, 3.6 và checklist minh chứng SQL Property Graph
-- ============================================================================
SET DEFINE OFF;
SET SERVEROUTPUT ON;

PROMPT ============================================================================
PROMPT 10. SQL PROPERTY GRAPH – hospital_referral_graph
PROMPT ============================================================================

-- --------------------------------------------------------------------------
-- [1] Dữ liệu demo đủ để có đường đi 2 chặng (an toàn khi chạy lại)
-- --------------------------------------------------------------------------
DELETE FROM referrals WHERE referral_id BETWEEN 101 AND 106;
DELETE FROM hospitals WHERE hospital_id BETWEEN 101 AND 103;

INSERT INTO hospitals (hospital_id, code, name, level_name, province, address)
VALUES (101, 'BV-GL-101', 'Bệnh Viện Đa Khoa Huyện Gia Lâm', 'Hạng III', 'Hà Nội', 'Huyện Gia Lâm, Hà Nội');

INSERT INTO hospitals (hospital_id, code, name, level_name, province, address)
VALUES (102, 'BV-HD-102', 'Bệnh Viện Đa Khoa Tỉnh Hải Dương', 'Hạng I', 'Hải Dương', 'TP. Hải Dương, tỉnh Hải Dương');

INSERT INTO hospitals (hospital_id, code, name, level_name, province, address)
VALUES (103, 'BV-VD-103', 'Bệnh Viện Hữu Nghị Việt Đức (Graph Demo)', 'Hạng Đặc Biệt', 'Hà Nội', '40 Tràng Thi, Hoàn Kiếm, Hà Nội');

-- Gia Lâm -> Hải Dương (BN 2)
INSERT INTO referrals (
  referral_id, patient_id, from_hospital_id, to_hospital_id, referred_by_doctor_id,
  reason, urgency, status, referral_time, completed_at
) VALUES (
  101, 2, 101, 102, NULL,
  'Vượt khả năng điều trị tuyến huyện', 'NORMAL', 'COMPLETED',
  SYSTIMESTAMP - INTERVAL '5' DAY, SYSTIMESTAMP - INTERVAL '4' DAY
);

-- Hải Dương -> Bạch Mai (BN 2) → tạo chuỗi 2 chặng
INSERT INTO referrals (
  referral_id, patient_id, from_hospital_id, to_hospital_id, referred_by_doctor_id,
  reason, urgency, status, referral_time
) VALUES (
  102, 2, 102, 1, NULL,
  'Cần can thiệp chuyên sâu nội tiết', 'URGENT', 'ACCEPTED',
  SYSTIMESTAMP - INTERVAL '3' DAY
);

-- Bạch Mai -> Chợ Rẫy (BN 3)
INSERT INTO referrals (
  referral_id, patient_id, from_hospital_id, to_hospital_id, referred_by_doctor_id,
  reason, urgency, status, referral_time
) VALUES (
  103, 3, 1, 3, 1,
  'Hội chẩn đa chuyên khoa hô hấp', 'NORMAL', 'ACCEPTED',
  SYSTIMESTAMP - INTERVAL '1' DAY
);

-- Hải Dương -> Việt Đức demo (BN 4, PENDING)
INSERT INTO referrals (
  referral_id, patient_id, from_hospital_id, to_hospital_id, referred_by_doctor_id,
  reason, urgency, status, referral_time
) VALUES (
  104, 4, 102, 103, NULL,
  'Chấn thương cần phẫu thuật chuyên sâu', 'EMERGENCY', 'PENDING',
  SYSTIMESTAMP - INTERVAL '6' HOUR
);

-- Cầu Giấy -> Chợ Rẫy (BN 5, REJECTED) – không tính trong path ACCEPTED/COMPLETED
INSERT INTO referrals (
  referral_id, patient_id, from_hospital_id, to_hospital_id, referred_by_doctor_id,
  reason, urgency, status, referral_time
) VALUES (
  105, 5, 2, 3, NULL,
  'Yêu cầu chuyển tuyến bị từ chối do thiếu hồ sơ', 'NORMAL', 'REJECTED',
  SYSTIMESTAMP - INTERVAL '2' DAY
);

-- Cầu Giấy -> Bạch Mai (BN 1, ACCEPTED)
INSERT INTO referrals (
  referral_id, patient_id, from_hospital_id, to_hospital_id, referred_by_doctor_id,
  reason, urgency, status, referral_time, accepted_at
) VALUES (
  106, 1, 2, 1, 1,
  'Đau ngực cần can thiệp tim mạch tuyến trung ương', 'URGENT', 'ACCEPTED',
  SYSTIMESTAMP - INTERVAL '12' HOUR, SYSTIMESTAMP - INTERVAL '10' HOUR
);

COMMIT;

-- --------------------------------------------------------------------------
-- [2] CREATE PROPERTY GRAPH
-- --------------------------------------------------------------------------
BEGIN
  EXECUTE IMMEDIATE 'DROP PROPERTY GRAPH hospital_referral_graph';
EXCEPTION
  WHEN OTHERS THEN NULL;
END;
/

CREATE PROPERTY GRAPH hospital_referral_graph
  VERTEX TABLES (
    hospitals
      KEY (hospital_id)
      LABEL hospital
        PROPERTIES (hospital_id, code, name, level_name, province, address)
  )
  EDGE TABLES (
    referrals
      KEY (referral_id)
      SOURCE      KEY (from_hospital_id) REFERENCES hospitals (hospital_id)
      DESTINATION KEY (to_hospital_id)   REFERENCES hospitals (hospital_id)
      LABEL referred_to
        PROPERTIES (
          referral_id, patient_id, referred_by_doctor_id,
          urgency, status, referral_time, accepted_at, completed_at
        )
  );

PROMPT Đã tạo PROPERTY GRAPH hospital_referral_graph (LABEL cạnh: referred_to).

-- --------------------------------------------------------------------------
-- [3] Truy vấn GRAPH_TABLE minh họa
-- --------------------------------------------------------------------------
PROMPT
PROMPT >>> Số nút / số cạnh:
SELECT (SELECT COUNT(*)
          FROM GRAPH_TABLE (hospital_referral_graph
                 MATCH (v IS hospital)
                 COLUMNS (v.hospital_id AS id))) AS so_nut,
       (SELECT COUNT(*)
          FROM GRAPH_TABLE (hospital_referral_graph
                 MATCH (a IS hospital) -[e IS referred_to]-> (b IS hospital)
                 COLUMNS (e.referral_id AS id))) AS so_canh
FROM dual;

PROMPT
PROMPT >>> Chuyển tuyến 1 chặng (ACCEPTED/COMPLETED):
SELECT *
FROM GRAPH_TABLE (
  hospital_referral_graph
  MATCH (src IS hospital) -[r IS referred_to]-> (dst IS hospital)
  WHERE r.status IN ('ACCEPTED', 'COMPLETED')
  COLUMNS (
    src.code AS from_code,
    src.name AS from_hospital,
    dst.code AS to_code,
    dst.name AS to_hospital,
    r.referral_id AS referral_id,
    r.urgency AS urgency,
    r.status AS status
  )
)
ORDER BY from_hospital, to_hospital;

PROMPT
PROMPT >>> Chuỗi chuyển tuyến 2 chặng A -> B -> C:
SELECT *
FROM GRAPH_TABLE (
  hospital_referral_graph
  MATCH (a IS hospital) -[r1 IS referred_to]-> (b IS hospital)
                        -[r2 IS referred_to]-> (c IS hospital)
  WHERE r1.status IN ('ACCEPTED', 'COMPLETED')
    AND r2.status IN ('ACCEPTED', 'COMPLETED')
    AND a.hospital_id <> c.hospital_id
  COLUMNS (
    a.name AS hop1,
    b.name AS hop2,
    c.name AS hop3,
    r1.referral_id AS ca_chang_1,
    r2.referral_id AS ca_chang_2
  )
)
ORDER BY hop1, hop3;

PROMPT ============================================================================
PROMPT HOÀN TẤT SCRIPT PROPERTY GRAPH
PROMPT ============================================================================
