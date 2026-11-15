-- ============================================================================
-- ĐỀ TÀI 25: HỆ THỐNG QUẢN LÝ BỆNH VIỆN THÔNG MINH TÍCH HỢP ĐA CÔNG NGHỆ
-- FILE: 08_optimize_q2_vector_index.sql
-- MỤC ĐÍCH: So sánh Execution Plan Q2 – Vector Search tài liệu y khoa
--           Exact search (không vector index) vs Approximate search (IVF index)
-- ĐÁP ỨNG: Mục 4.7 & Bảng 4.3 trong báo cáo (Q2 – Vector tài liệu)
-- ============================================================================
SET LINESIZE 200;
SET PAGESIZE 1000;
SET FEEDBACK OFF;
SET SERVEROUTPUT ON;
SET DEFINE OFF;

PROMPT ============================================================================
PROMPT Q2: VECTOR SEARCH – EXACT vs IVF VECTOR INDEX
PROMPT ============================================================================

CREATE OR REPLACE PACKAGE q2_vec_ctx AS
  g_qvec VECTOR(384, FLOAT32);
  FUNCTION make_vec(p_seed IN NUMBER) RETURN VECTOR;
END q2_vec_ctx;
/

CREATE OR REPLACE PACKAGE BODY q2_vec_ctx AS
  FUNCTION make_vec(p_seed IN NUMBER) RETURN VECTOR IS
    v_parts CLOB := '[';
  BEGIN
    FOR d IN 1 .. 384 LOOP
      IF d > 1 THEN
        v_parts := v_parts || ',';
      END IF;
      v_parts := v_parts || TO_CHAR(SIN(p_seed * d * 0.017) * COS(d * 0.013), 'FM0.000000009');
    END LOOP;
    v_parts := v_parts || ']';
    RETURN TO_VECTOR(v_parts, 384, FLOAT32);
  END make_vec;
END q2_vec_ctx;
/

-- --------------------------------------------------------------------------
-- 1) Sinh >= 2000 document benchmark kèm VECTOR(384)
-- --------------------------------------------------------------------------
DECLARE
  v_count NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM medical_documents
  WHERE source_key LIKE 'bench-doc-%';

  IF v_count >= 2000 THEN
    DBMS_OUTPUT.PUT_LINE('Đã có ' || v_count || ' document benchmark; bỏ qua bước sinh dữ liệu.');
  ELSE
    DELETE FROM medical_documents WHERE source_key LIKE 'bench-doc-%';
    FOR i IN 1 .. 2000 LOOP
      INSERT INTO medical_documents (
        source_key, title, category, source_name, content, embedding
      ) VALUES (
        'bench-doc-' || LPAD(TO_CHAR(i), 5, '0'),
        'Benchmark tài liệu y khoa #' || TO_CHAR(i),
        CASE MOD(i, 5)
          WHEN 0 THEN 'Tim Mạch'
          WHEN 1 THEN 'Hô Hấp'
          WHEN 2 THEN 'Nội Tiết'
          WHEN 3 THEN 'Truyền Nhiễm'
          ELSE 'Thần Kinh'
        END,
        'Seed Q2 Benchmark',
        'Đoạn văn bản giả lập phục vụ đo execution plan vector search. Chủ đề ' || TO_CHAR(MOD(i, 5)) || '.',
        q2_vec_ctx.make_vec(i)
      );
      IF MOD(i, 200) = 0 THEN
        COMMIT;
      END IF;
    END LOOP;
    COMMIT;
    DBMS_OUTPUT.PUT_LINE('Đã sinh 2000 medical_documents benchmark kèm VECTOR(384).');
  END IF;

  q2_vec_ctx.g_qvec := q2_vec_ctx.make_vec(42);
  DBMS_STATS.GATHER_TABLE_STATS(USER, 'MEDICAL_DOCUMENTS');
END;
/

-- --------------------------------------------------------------------------
-- 2) BASELINE exact (drop IVF nếu có)
-- --------------------------------------------------------------------------
BEGIN
  EXECUTE IMMEDIATE 'DROP INDEX idx_medical_docs_vec';
EXCEPTION
  WHEN OTHERS THEN NULL;
END;
/

PROMPT
PROMPT >>> 1. Top-8 EXACT search (baseline):
SELECT doc_id,
       SUBSTR(title, 1, 40) AS title,
       ROUND(VECTOR_DISTANCE(embedding, q2_vec_ctx.g_qvec, COSINE), 6) AS dist
  FROM medical_documents
 WHERE embedding IS NOT NULL
 ORDER BY dist
 FETCH EXACT FIRST 8 ROWS ONLY;

SELECT /*+ GATHER_PLAN_STATISTICS */
       doc_id,
       VECTOR_DISTANCE(embedding, q2_vec_ctx.g_qvec, COSINE) AS dist
  FROM medical_documents
 WHERE embedding IS NOT NULL
 ORDER BY dist
 FETCH EXACT FIRST 8 ROWS ONLY;

PROMPT
PROMPT >>> EXECUTION PLAN Q2 – EXACT:
SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY_CURSOR(NULL, NULL, 'TYPICAL LAST'));

-- --------------------------------------------------------------------------
-- 3) CREATE VECTOR INDEX IVF rồi approximate search
-- --------------------------------------------------------------------------
PROMPT
PROMPT >>> Đang tạo CREATE VECTOR INDEX idx_medical_docs_vec (IVF / COSINE)...

BEGIN
  EXECUTE IMMEDIATE q'[
    CREATE VECTOR INDEX idx_medical_docs_vec
      ON medical_documents (embedding)
      ORGANIZATION NEIGHBOR PARTITIONS
      DISTANCE COSINE
      WITH TARGET ACCURACY 95
  ]';
  DBMS_OUTPUT.PUT_LINE('Tạo idx_medical_docs_vec thành công.');
EXCEPTION
  WHEN OTHERS THEN
    DBMS_OUTPUT.PUT_LINE('Lưu ý tạo VECTOR INDEX: ' || SQLERRM);
END;
/

BEGIN
  DBMS_STATS.GATHER_TABLE_STATS(USER, 'MEDICAL_DOCUMENTS');
END;
/

PROMPT
PROMPT >>> 2. Top-8 APPROXIMATE search (TARGET ACCURACY 95):
SELECT doc_id,
       SUBSTR(title, 1, 40) AS title,
       ROUND(VECTOR_DISTANCE(embedding, q2_vec_ctx.g_qvec, COSINE), 6) AS dist
  FROM medical_documents
 WHERE embedding IS NOT NULL
 ORDER BY dist
 FETCH FIRST 8 ROWS ONLY WITH TARGET ACCURACY 95;

SELECT /*+ GATHER_PLAN_STATISTICS */
       doc_id,
       VECTOR_DISTANCE(embedding, q2_vec_ctx.g_qvec, COSINE) AS dist
  FROM medical_documents
 WHERE embedding IS NOT NULL
 ORDER BY dist
 FETCH FIRST 8 ROWS ONLY WITH TARGET ACCURACY 95;

PROMPT
PROMPT >>> EXECUTION PLAN Q2 – IVF / APPROXIMATE:
SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY_CURSOR(NULL, NULL, 'TYPICAL LAST'));

PROMPT ============================================================================
PROMPT BẢNG ĐỐI CHIẾU Q2 (BẢNG 4.3 BÁO CÁO):
PROMPT - Trước tối ưu : Exact search / full vector scan trên MEDICAL_DOCUMENTS
PROMPT - Sau tối ưu   : IVF vector index idx_medical_docs_vec (COSINE, accuracy 95)
PROMPT - Dữ liệu đo   : >= 2000 document chunks benchmark (bench-doc-*)
PROMPT - Ghi chú      : Corpus semantic thật (doc-*) vẫn dùng cho UI POST /api/ai-search
PROMPT ============================================================================
