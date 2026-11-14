-- ============================================================================
-- FILE: 07_seed_symptom_knowledge.sql
-- MỤC ĐÍCH: Nạp cơ sở tri thức triệu chứng (SYMPTOM_KNOWLEDGE) cho ô tìm kiếm ngữ nghĩa
--           ở Dashboard (GET /api/search/quick). Cột EMBEDDING để NULL; xem 08_symptom_embeddings.sql
--           để sinh vector. Chạy lại nhiều lần không bị trùng (chỉ chèn dòng chưa có).
-- LƯU Ý: chạy với  export NLS_LANG=AMERICAN_AMERICA.AL32UTF8  để không hỏng tiếng Việt.
-- ============================================================================
SET DEFINE OFF;

INSERT INTO symptom_knowledge (name, description)
SELECT 'Hội chứng vành cấp / Đau thắt ngực không ổn định',
       'Đau thắt ngực vùng sau xương ức, cảm giác đè nặng bóp nghẹt, lan lên hàm dưới, vai trái hoặc mặt trong cánh tay trái. Thường khởi phát khi gắng sức hoặc xúc cảm mạnh, kèm vã mồ hôi, khó thở, buồn nôn.'
  FROM dual
 WHERE NOT EXISTS (SELECT 1 FROM symptom_knowledge WHERE name = 'Hội chứng vành cấp / Đau thắt ngực không ổn định');

INSERT INTO symptom_knowledge (name, description)
SELECT 'Đợt cấp Bệnh phổi tắc nghẽn mạn tính (COPD)',
       'Bệnh nhân có tiền sử hút thuốc lá nhiều năm, xuất hiện khó thở tăng dần, ho khạc đờm nhiều, thay đổi màu sắc đờm sang đờm mủ đục. Thở khò khè thì thở ra, co kéo hõm ức.'
  FROM dual
 WHERE NOT EXISTS (SELECT 1 FROM symptom_knowledge WHERE name = 'Đợt cấp Bệnh phổi tắc nghẽn mạn tính (COPD)');

INSERT INTO symptom_knowledge (name, description)
SELECT 'Cơn bão giáp trạng / Nhiễm độc giáp cấp',
       'Sốt cao 39-40 độ C, nhịp tim rất nhanh > 140 bpm, rối loạn nhịp tim (rung nhĩ), bồn chồn kích động, nôn mửa, tiêu chảy, vàng da nhẹ, tiền sử bệnh Basedow.'
  FROM dual
 WHERE NOT EXISTS (SELECT 1 FROM symptom_knowledge WHERE name = 'Cơn bão giáp trạng / Nhiễm độc giáp cấp');

INSERT INTO symptom_knowledge (name, description)
SELECT 'Trào ngược dạ dày thực quản (GERD)',
       'Ợ chua, ợ nóng sau xương ức, cảm giác vướng ở cổ họng hạt đờm, ho khan kéo dài về đêm khi nằm ngửa, tăng nặng sau khi ăn no hoặc dùng thức uống có ga/cà phê.'
  FROM dual
 WHERE NOT EXISTS (SELECT 1 FROM symptom_knowledge WHERE name = 'Trào ngược dạ dày thực quản (GERD)');

COMMIT;
