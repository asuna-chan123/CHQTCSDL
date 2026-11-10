-- =====================================================================
-- NGƯỜI 1 - MẠNG LƯỚI CHUYỂN TUYẾN BỆNH NHÂN DẠNG ĐỒ THỊ
-- Oracle Database 23ai | schema: hospital_admin | PDB: FREEPDB1
--
--   Nút  (vertex): HOSPITALS -> mỗi bệnh viện là một nút
--   Cạnh (edge)  : REFERRALS -> mỗi ca chuyển viện là một cạnh có hướng
--                  FROM_HOSPITAL_ID  --->  TO_HOSPITAL_ID
--
-- Thứ tự chạy:
--   [0] Cấp quyền (nếu cần)
--   [1] Dữ liệu demo (tuỳ chọn, để thấy được đường đi 2 chặng)
--   [2] CREATE PROPERTY GRAPH
--   [3] Truy vấn GRAPH_TABLE
--
-- Chạy bằng sqlplus/docker thì đặt trước:
--   export NLS_LANG=AMERICAN_AMERICA.AL32UTF8
-- =====================================================================
SET DEFINE OFF;


-- =====================================================================
-- [0] QUYỀN
-- Nếu bước [2] báo ORA-01031 (insufficient privileges), đăng nhập SYSTEM
-- và chạy dòng dưới (bỏ dấu comment):
-- =====================================================================
-- GRANT CREATE PROPERTY GRAPH TO hospital_admin;


-- =====================================================================
-- [1] DỮ LIỆU DEMO (TUỲ CHỌN)
-- seed_oracle_data.sql chỉ có 3 bệnh viện và 1 ca chuyển viện nên chưa đủ
-- để có đường đi 2 chặng. Phần này thêm 3 bệnh viện + 6 ca chuyển viện.
-- Dùng ID từ 101 trở lên để không đụng dữ liệu của các bạn trong nhóm.
-- Chạy lại nhiều lần được (xoá đúng dải ID demo trước khi chèn).
-- =====================================================================
DELETE FROM REFERRALS WHERE REFERRAL_ID BETWEEN 101 AND 106;
DELETE FROM HOSPITALS WHERE HOSPITAL_ID BETWEEN 101 AND 103;

INSERT INTO HOSPITALS (HOSPITAL_ID, CODE, NAME, LEVEL_NAME, PROVINCE, ADDRESS)
VALUES (101, 'BV-GL-101', 'Bệnh Viện Đa Khoa Huyện Gia Lâm', 'Hạng III', 'Hà Nội', 'Huyện Gia Lâm, Hà Nội');

INSERT INTO HOSPITALS (HOSPITAL_ID, CODE, NAME, LEVEL_NAME, PROVINCE, ADDRESS)
VALUES (102, 'BV-HD-102', 'Bệnh Viện Đa Khoa Tỉnh Hải Dương', 'Hạng I', 'Hải Dương', 'TP. Hải Dương, tỉnh Hải Dương');

INSERT INTO HOSPITALS (HOSPITAL_ID, CODE, NAME, LEVEL_NAME, PROVINCE, ADDRESS)
VALUES (103, 'BV-VD-103', 'Bệnh Viện Hữu Nghị Việt Đức', 'Hạng Đặc Biệt', 'Hà Nội', '40 Tràng Thi, Hoàn Kiếm, Hà Nội');

-- Mã bệnh viện: 1 = Bạch Mai | 2 = Cầu Giấy | 3 = Chợ Rẫy
--               101 = Gia Lâm | 102 = Hải Dương | 103 = Việt Đức
-- (ca chuyển viện số 1 có sẵn trong seed: Cầu Giấy -> Bạch Mai, ACCEPTED)

-- 101: Gia Lâm -> Hải Dương (BN 2, đã hoàn tất)
INSERT INTO REFERRALS (REFERRAL_ID, PATIENT_ID, FROM_HOSPITAL_ID, TO_HOSPITAL_ID, REFERRED_BY_DOCTOR_ID,
                       REASON, DIAGNOSIS_SUMMARY, URGENCY, STATUS, REFERRAL_TIME, COMPLETED_AT)
VALUES (101, 2, 101, 102, NULL,
        'Vượt khả năng điều trị tuyến huyện', 'Biến chứng đái tháo đường type 2',
        'NORMAL', 'COMPLETED', SYSTIMESTAMP - INTERVAL '5' DAY, SYSTIMESTAMP - INTERVAL '4' DAY);

-- 102: Hải Dương -> Bạch Mai (cùng BN 2, chuyển tiếp lên tuyến trung ương)
INSERT INTO REFERRALS (REFERRAL_ID, PATIENT_ID, FROM_HOSPITAL_ID, TO_HOSPITAL_ID, REFERRED_BY_DOCTOR_ID,
                       REASON, DIAGNOSIS_SUMMARY, URGENCY, STATUS, REFERRAL_TIME)
VALUES (102, 2, 102, 1, NULL,
        'Cần can thiệp chuyên sâu nội tiết', 'Đái tháo đường kèm biến chứng thận',
        'URGENT', 'ACCEPTED', SYSTIMESTAMP - INTERVAL '3' DAY);

-- 103: Bạch Mai -> Chợ Rẫy (BN 3)
INSERT INTO REFERRALS (REFERRAL_ID, PATIENT_ID, FROM_HOSPITAL_ID, TO_HOSPITAL_ID, REFERRED_BY_DOCTOR_ID,
                       REASON, DIAGNOSIS_SUMMARY, URGENCY, STATUS, REFERRAL_TIME)
VALUES (103, 3, 1, 3, 1,
        'Hội chẩn đa chuyên khoa, cần điều trị chuyên sâu hô hấp', 'Bệnh phổi tắc nghẽn mạn tính',
        'NORMAL', 'ACCEPTED', SYSTIMESTAMP - INTERVAL '1' DAY);

-- 104: Hải Dương -> Việt Đức (BN 4, đang chờ tiếp nhận)
INSERT INTO REFERRALS (REFERRAL_ID, PATIENT_ID, FROM_HOSPITAL_ID, TO_HOSPITAL_ID, REFERRED_BY_DOCTOR_ID,
                       REASON, DIAGNOSIS_SUMMARY, URGENCY, STATUS, REFERRAL_TIME)
VALUES (104, 4, 102, 103, NULL,
        'Chấn thương cần phẫu thuật chuyên sâu', 'Nghi vỡ lách sau tai nạn',
        'EMERGENCY', 'PENDING', SYSTIMESTAMP - INTERVAL '6' HOUR);

-- 105: Cầu Giấy -> Chợ Rẫy (BN 5, BỊ TỪ CHỐI -> để thấy "trực tiếp" không đi được)
INSERT INTO REFERRALS (REFERRAL_ID, PATIENT_ID, FROM_HOSPITAL_ID, TO_HOSPITAL_ID, REFERRED_BY_DOCTOR_ID,
                       REASON, DIAGNOSIS_SUMMARY, URGENCY, STATUS, REFERRAL_TIME)
VALUES (105, 5, 2, 3, NULL,
        'Đề nghị chuyển vào phía Nam', 'Theo dõi sau mổ',
        'NORMAL', 'REJECTED', SYSTIMESTAMP - INTERVAL '2' DAY);

-- 106: Bạch Mai -> Cầu Giấy (BN 1, chuyển ngược về tuyến dưới -> tạo chu trình 2->1->2)
INSERT INTO REFERRALS (REFERRAL_ID, PATIENT_ID, FROM_HOSPITAL_ID, TO_HOSPITAL_ID, REFERRED_BY_DOCTOR_ID,
                       REASON, DIAGNOSIS_SUMMARY, URGENCY, STATUS)
VALUES (106, 1, 1, 2, 3,
        'Ổn định sau can thiệp, chuyển về tuyến dưới theo dõi', 'Hội chứng vành cấp sau can thiệp',
        'NORMAL', 'ACCEPTED');

COMMIT;


-- =====================================================================
-- [2] TẠO PROPERTY GRAPH
-- Bệnh viện = nút, ca chuyển viện = cạnh có hướng (nơi chuyển đi -> nơi tiếp nhận).
-- - Không đưa REASON / DIAGNOSIS_SUMMARY (CLOB) vào thuộc tính: đồ thị chỉ cần
--   các thuộc tính ngắn để lọc, còn nội dung chi tiết vẫn tra bằng JOIN bảng gốc.
-- - Không lọc STATUS ở đây; lọc trong truy vấn để linh hoạt (xem [3]).
-- - Bảng REFERRALS đã có index IX_REF_FROM / IX_REF_TO nên duyệt đồ thị khá nhanh.
-- =====================================================================
-- Nếu đã tạo trước đó và muốn tạo lại:
-- DROP PROPERTY GRAPH hospital_referral_graph;

CREATE PROPERTY GRAPH hospital_referral_graph
  VERTEX TABLES (
    HOSPITALS
      KEY (HOSPITAL_ID)
      LABEL hospital
        PROPERTIES (HOSPITAL_ID, CODE, NAME, LEVEL_NAME, PROVINCE, ADDRESS)
  )
  EDGE TABLES (
    REFERRALS
      KEY (REFERRAL_ID)
      SOURCE      KEY (FROM_HOSPITAL_ID) REFERENCES HOSPITALS (HOSPITAL_ID)
      DESTINATION KEY (TO_HOSPITAL_ID)   REFERENCES HOSPITALS (HOSPITAL_ID)
      LABEL referred_to
        PROPERTIES (REFERRAL_ID, PATIENT_ID, REFERRED_BY_DOCTOR_ID,
                    URGENCY, STATUS, REFERRAL_TIME, ACCEPTED_AT, COMPLETED_AT)
  );


-- =====================================================================
-- [3] TRUY VẤN GRAPH_TABLE
-- Quy ước: chỉ tính ca chuyển viện đã được duyệt (ACCEPTED, COMPLETED).
-- Muốn tính cả ca đang chờ thì thêm 'PENDING' vào danh sách IN (...).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 3.0 Kiểm tra nhanh: số nút / số cạnh trong đồ thị
-- ---------------------------------------------------------------------
SELECT (SELECT COUNT(*)
          FROM GRAPH_TABLE (hospital_referral_graph
                 MATCH (v IS hospital)
                 COLUMNS (v.hospital_id AS id))) AS so_nut,
       (SELECT COUNT(*)
          FROM GRAPH_TABLE (hospital_referral_graph
                 MATCH (a IS hospital) -[e IS referred_to]-> (b IS hospital)
                 COLUMNS (e.referral_id AS id))) AS so_canh
FROM dual;


-- ---------------------------------------------------------------------
-- 3.1 CHUYỂN TRỰC TIẾP (1 chặng): A -> B
-- Kết quả mong đợi với dữ liệu demo: 5 dòng (ca 1, 101, 102, 103, 106).
-- Ca 104 (PENDING) và 105 (REJECTED) bị loại.
-- ---------------------------------------------------------------------
SELECT *
FROM GRAPH_TABLE (
  hospital_referral_graph
  MATCH (src IS hospital) -[r IS referred_to]-> (dst IS hospital)
  WHERE r.status IN ('ACCEPTED', 'COMPLETED')
  COLUMNS (
    src.code          AS from_code,
    src.name          AS from_hospital,
    dst.code          AS to_code,
    dst.name          AS to_hospital,
    r.referral_id     AS referral_id,
    r.urgency         AS urgency,
    r.status          AS status,
    r.referral_time   AS referral_time
  )
)
ORDER BY from_hospital, to_hospital;


-- ---------------------------------------------------------------------
-- 3.2 CHUYỂN QUA 2 CHẶNG: A -> B -> C  (B là bệnh viện trung gian)
-- a.hospital_id <> c.hospital_id để loại chu trình quay về chỗ cũ (A -> B -> A).
-- Kết quả mong đợi: 4 dòng
--   Cầu Giấy -> Bạch Mai -> Chợ Rẫy
--   Gia Lâm  -> Hải Dương -> Bạch Mai
--   Hải Dương -> Bạch Mai -> Chợ Rẫy
--   Hải Dương -> Bạch Mai -> Cầu Giấy
-- ---------------------------------------------------------------------
SELECT *
FROM GRAPH_TABLE (
  hospital_referral_graph
  MATCH (a IS hospital) -[r1 IS referred_to]-> (b IS hospital)
                        -[r2 IS referred_to]-> (c IS hospital)
  WHERE r1.status IN ('ACCEPTED', 'COMPLETED')
    AND r2.status IN ('ACCEPTED', 'COMPLETED')
    AND a.hospital_id <> c.hospital_id
  COLUMNS (
    a.name            AS tu_benh_vien,
    b.name            AS qua_benh_vien,
    c.name            AS den_benh_vien,
    r1.referral_id    AS ca_chang_1,
    r2.referral_id    AS ca_chang_2,
    r1.urgency        AS khan_cap_chang_1,
    r2.urgency        AS khan_cap_chang_2
  )
)
ORDER BY tu_benh_vien, den_benh_vien;


-- ---------------------------------------------------------------------
-- 3.3 TRỰC TIẾP HOẶC QUA 2 CHẶNG - GỘP TRONG 1 CÂU (dùng quantifier {1,2})
-- Tìm mọi đường chuyển viện từ bệnh viện nguồn đến bệnh viện đích.
-- Ví dụ: Cầu Giấy (BV-CG-02) -> Chợ Rẫy (BV-CR-03)
--   * đường trực tiếp (ca 105) bị REJECTED nên không tính
--   * còn đường qua Bạch Mai (2 chặng) -> kết quả: 1 dòng, hops = 2
-- Đổi mã bệnh viện ở 2 dòng WHERE để tìm cặp khác.
-- Muốn mở rộng tới 3 chặng: đổi {1,2} thành {1,3}.
-- ---------------------------------------------------------------------
SELECT *
FROM GRAPH_TABLE (
  hospital_referral_graph
  MATCH (src IS hospital)
        -[r IS referred_to WHERE r.status IN ('ACCEPTED', 'COMPLETED')]->{1,2}
        (dst IS hospital)
  WHERE src.code = 'BV-CG-02'
    AND dst.code = 'BV-CR-03'
  COLUMNS (
    src.name                       AS from_hospital,
    dst.name                       AS to_hospital,
    COUNT(r.referral_id)           AS hops,
    LISTAGG(r.urgency, ' > ')      AS urgency_path
  )
)
ORDER BY hops;


-- ---------------------------------------------------------------------
-- 3.4 (BỔ SUNG) HÀNH TRÌNH CỦA CÙNG MỘT BỆNH NHÂN QUA 2 CHẶNG
-- Khác 3.2: 3.2 là đường đi của MẠNG LƯỚI (bệnh nhân khác nhau cũng được),
-- 3.4 là một bệnh nhân thực sự bị chuyển liên tiếp, chặng sau xảy ra sau chặng trước.
-- Kết quả mong đợi: 1 dòng - BN 2: Gia Lâm -> Hải Dương -> Bạch Mai.
-- ---------------------------------------------------------------------
SELECT p.medical_code,
       p.full_name,
       g.tu_benh_vien,
       g.qua_benh_vien,
       g.den_benh_vien,
       g.thoi_gian_chang_1,
       g.thoi_gian_chang_2
FROM GRAPH_TABLE (
       hospital_referral_graph
       MATCH (a IS hospital) -[r1 IS referred_to]-> (b IS hospital)
                             -[r2 IS referred_to]-> (c IS hospital)
       WHERE r1.patient_id = r2.patient_id
         AND r1.referral_time <= r2.referral_time
         AND r1.status IN ('ACCEPTED', 'COMPLETED')
         AND r2.status IN ('ACCEPTED', 'COMPLETED')
         AND a.hospital_id <> c.hospital_id
       COLUMNS (
         r1.patient_id     AS patient_id,
         a.name            AS tu_benh_vien,
         b.name            AS qua_benh_vien,
         c.name            AS den_benh_vien,
         r1.referral_time  AS thoi_gian_chang_1,
         r2.referral_time  AS thoi_gian_chang_2
       )
     ) g
JOIN PATIENTS p ON p.patient_id = g.patient_id
ORDER BY p.medical_code;


-- =====================================================================
-- DỌN DẸP DỮ LIỆU DEMO (nếu muốn xoá, bỏ dấu comment)
-- =====================================================================
-- DELETE FROM REFERRALS WHERE REFERRAL_ID BETWEEN 101 AND 106;
-- DELETE FROM HOSPITALS WHERE HOSPITAL_ID BETWEEN 101 AND 103;
-- COMMIT;
