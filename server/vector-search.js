import { pipeline } from '@huggingface/transformers';
import searchCorpus from './medical-search-data.json' with { type: 'json' };
import { executeQuery, oracledb } from './db.js';

const MODEL_ID = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';
const VECTOR_DIMENSIONS = 384;
let extractorPromise;
let corpusPromise;

async function getExtractor() {
  if (!extractorPromise) {
    extractorPromise = pipeline('feature-extraction', MODEL_ID);
  }
  return extractorPromise;
}

export async function embedText(text) {
  const extractor = await getExtractor();
  const output = await extractor(text, { pooling: 'mean', normalize: true });
  const vector = output.tolist()[0];

  if (vector.length !== VECTOR_DIMENSIONS || vector.some((value) => !Number.isFinite(value))) {
    throw new Error(`Embedding model returned an invalid ${vector.length}-dimension vector.`);
  }

  return new Float32Array(vector);
}

function vectorBind(vector) {
  return { type: oracledb.DB_TYPE_VECTOR, val: vector };
}

async function upsertSymptom(item) {
  const vector = await embedText(
    `${item.title}. Chuyên khoa: ${item.category}. ${item.content}`
  );
  await executeQuery(
    `MERGE INTO symptom_knowledge target
     USING (SELECT :source_key AS source_key FROM dual) source
        ON (target.source_key = source.source_key)
     WHEN MATCHED THEN UPDATE SET
       target.name = :name,
       target.category = :category,
       target.description = :description,
       target.recommended_specialty = :recommended_specialty,
       target.urgency_level = :urgency_level,
       target.citations = :citations,
       target.suggested_actions = :suggested_actions,
       target.embedding = :embedding
     WHEN NOT MATCHED THEN INSERT (
       source_key, name, category, description, recommended_specialty,
       urgency_level, citations, suggested_actions, embedding
     ) VALUES (
       :source_key, :name, :category, :description, :recommended_specialty,
       :urgency_level, :citations, :suggested_actions, :embedding
     )`,
    {
      source_key: item.source_key,
      name: item.title,
      category: item.category,
      description: item.content,
      recommended_specialty: item.recommended_specialty,
      urgency_level: item.urgency_level,
      citations: JSON.stringify(item.citations),
      suggested_actions: JSON.stringify(item.suggested_actions),
      embedding: vectorBind(vector),
    }
  );
}

async function upsertDocument(item) {
  const vector = await embedText(
    `${item.title}. ${item.category}. ${item.content}`
  );
  await executeQuery(
    `MERGE INTO medical_documents target
     USING (SELECT :source_key AS source_key FROM dual) source
        ON (target.source_key = source.source_key)
     WHEN MATCHED THEN UPDATE SET
       target.title = :title,
       target.category = :category,
       target.source_name = :source_name,
       target.content = :content,
       target.recommended_specialty = :recommended_specialty,
       target.urgency_level = :urgency_level,
       target.citations = :citations,
       target.suggested_actions = :suggested_actions,
       target.embedding = :embedding
     WHEN NOT MATCHED THEN INSERT (
       source_key, title, category, source_name, content, recommended_specialty,
       urgency_level, citations, suggested_actions, embedding
     ) VALUES (
       :source_key, :title, :category, :source_name, :content, :recommended_specialty,
       :urgency_level, :citations, :suggested_actions, :embedding
     )`,
    {
      source_key: item.source_key,
      title: item.title,
      category: item.category,
      source_name: item.source_name,
      content: item.content,
      recommended_specialty: item.recommended_specialty,
      urgency_level: item.urgency_level,
      citations: JSON.stringify(item.citations),
      suggested_actions: JSON.stringify(item.suggested_actions),
      embedding: vectorBind(vector),
    }
  );
}

async function ensureSearchCorpus() {
  if (!corpusPromise) {
    corpusPromise = (async () => {
      for (const item of searchCorpus.symptoms) await upsertSymptom(item);
      for (const item of searchCorpus.documents) await upsertDocument(item);
    })().catch((error) => {
      corpusPromise = undefined;
      throw error;
    });
  }
  await corpusPromise;
}

function mapResult(row) {
  const distance = Number(row.cosine_distance);
  return {
    id: String(row.id),
    title: row.title,
    category: row.category,
    content: row.content,
    cosine_distance: Number(distance.toFixed(4)),
    similarity_score: Number((Math.max(0, 1 - distance) * 100).toFixed(1)),
    recommended_specialty: row.recommended_specialty,
    urgency_level: row.urgency_level,
    citations: row.citations ? JSON.parse(row.citations) : [],
    suggested_actions: row.suggested_actions ? JSON.parse(row.suggested_actions) : [],
  };
}

export async function searchMedicalVectors(query, type) {
  await ensureSearchCorpus();
  const queryVector = vectorBind(await embedText(query));
  const table = type === 'symptoms' ? 'symptom_knowledge' : 'medical_documents';
  const titleColumn = type === 'symptoms' ? 'name' : 'title';
  const idColumn = type === 'symptoms' ? 'symptom_id' : 'doc_id';

  const { rows } = await executeQuery(
    `WITH ranked AS (
       SELECT
        ${idColumn} AS "id",
        ${titleColumn} AS "title",
        category AS "category",
        ${type === 'symptoms' ? 'description' : 'content'} AS "content",
        recommended_specialty AS "recommended_specialty",
        urgency_level AS "urgency_level",
        citations AS "citations",
        suggested_actions AS "suggested_actions",
        VECTOR_DISTANCE(embedding, :query_vector, COSINE) AS "cosine_distance"
       FROM ${table}
       WHERE embedding IS NOT NULL
     )
    SELECT "id", "title", "category", "content", "recommended_specialty", "urgency_level",
           "citations", "suggested_actions", "cosine_distance"
       FROM ranked
     ORDER BY "cosine_distance"
      FETCH FIRST 5 ROWS ONLY`,
    { query_vector: queryVector }
  );

  return rows.map(mapResult);
}
