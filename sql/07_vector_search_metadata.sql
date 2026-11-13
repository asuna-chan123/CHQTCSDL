-- Add metadata and stable seed keys for the local semantic-search corpus.
-- This migration is safe to rerun and does not delete existing records.
DECLARE
  PROCEDURE add_column_if_missing(
    p_table_name  IN VARCHAR2,
    p_column_name IN VARCHAR2,
    p_definition  IN VARCHAR2
  ) IS
    v_count NUMBER;
  BEGIN
    SELECT COUNT(*)
      INTO v_count
      FROM user_tab_columns
     WHERE table_name = UPPER(p_table_name)
       AND column_name = UPPER(p_column_name);

    IF v_count = 0 THEN
      EXECUTE IMMEDIATE 'ALTER TABLE ' || p_table_name ||
        ' ADD (' || p_column_name || ' ' || p_definition || ')';
    END IF;
  END;

  PROCEDURE create_index_if_missing(
    p_index_name IN VARCHAR2,
    p_table_name IN VARCHAR2,
    p_column_name IN VARCHAR2
  ) IS
    v_count NUMBER;
  BEGIN
    SELECT COUNT(*)
      INTO v_count
      FROM user_indexes
     WHERE index_name = UPPER(p_index_name);

    IF v_count = 0 THEN
      EXECUTE IMMEDIATE 'CREATE UNIQUE INDEX ' || p_index_name ||
        ' ON ' || p_table_name || ' (' || p_column_name || ')';
    END IF;
  END;
BEGIN
  add_column_if_missing('SYMPTOM_KNOWLEDGE', 'SOURCE_KEY', 'VARCHAR2(100)');
  add_column_if_missing('SYMPTOM_KNOWLEDGE', 'CATEGORY', 'VARCHAR2(100)');
  add_column_if_missing('SYMPTOM_KNOWLEDGE', 'RECOMMENDED_SPECIALTY', 'VARCHAR2(200)');
  add_column_if_missing('SYMPTOM_KNOWLEDGE', 'URGENCY_LEVEL', 'VARCHAR2(30)');
  add_column_if_missing('SYMPTOM_KNOWLEDGE', 'CITATIONS', 'CLOB');
  add_column_if_missing('SYMPTOM_KNOWLEDGE', 'SUGGESTED_ACTIONS', 'CLOB');

  add_column_if_missing('MEDICAL_DOCUMENTS', 'SOURCE_KEY', 'VARCHAR2(100)');
  add_column_if_missing('MEDICAL_DOCUMENTS', 'RECOMMENDED_SPECIALTY', 'VARCHAR2(200)');
  add_column_if_missing('MEDICAL_DOCUMENTS', 'URGENCY_LEVEL', 'VARCHAR2(30)');
  add_column_if_missing('MEDICAL_DOCUMENTS', 'CITATIONS', 'CLOB');
  add_column_if_missing('MEDICAL_DOCUMENTS', 'SUGGESTED_ACTIONS', 'CLOB');
  create_index_if_missing(
    'UQ_SYMPTOM_SOURCE_KEY', 'SYMPTOM_KNOWLEDGE', 'SOURCE_KEY'
  );
  create_index_if_missing(
    'UQ_MEDICAL_DOC_SOURCE_KEY', 'MEDICAL_DOCUMENTS', 'SOURCE_KEY'
  );
END;
/

COMMIT;
