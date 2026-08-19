import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

// ══════════════════════════════════════════
// INIT DB — Create tables + pgvector
// ══════════════════════════════════════════
export async function initDB() {
  await sql`CREATE EXTENSION IF NOT EXISTS vector`;

  // AEM Guides — how-to articles
  await sql`
    CREATE TABLE IF NOT EXISTS aem_guides (
      id          SERIAL PRIMARY KEY,
      title       TEXT NOT NULL,
      category    TEXT NOT NULL,
      content     TEXT NOT NULL,
      tags        TEXT[],
      embedding   VECTOR(512),
      created_at  TIMESTAMP DEFAULT NOW()
    )
  `;

  // Page Ownership
  await sql`
    CREATE TABLE IF NOT EXISTS page_owners (
      id          SERIAL PRIMARY KEY,
      page_path   TEXT NOT NULL UNIQUE,
      owner_name  TEXT NOT NULL,
      owner_email TEXT NOT NULL,
      team        TEXT,
      last_updated TIMESTAMP DEFAULT NOW()
    )
  `;

  // Workflows
  await sql`
    CREATE TABLE IF NOT EXISTS workflows (
      id          SERIAL PRIMARY KEY,
      name        TEXT NOT NULL,
      category    TEXT NOT NULL,
      steps       TEXT NOT NULL,
      notes       TEXT,
      embedding   VECTOR(512),
      created_at  TIMESTAMP DEFAULT NOW()
    )
  `;

  // Error troubleshooting
  await sql`
    CREATE TABLE IF NOT EXISTS error_guides (
      id          SERIAL PRIMARY KEY,
      error_code  TEXT,
      title       TEXT NOT NULL,
      category    TEXT NOT NULL,
      symptoms    TEXT NOT NULL,
      solution    TEXT NOT NULL,
      embedding   VECTOR(512),
      created_at  TIMESTAMP DEFAULT NOW()
    )
  `;

  console.log("✅ DB initialized");
}

// ══════════════════════════════════════════
// SEARCH — Keyword (ILIKE)
// ══════════════════════════════════════════
export async function keywordSearch(query, category, limit = 5) {
  const term = `%${query}%`;

  const guides = category
    ? await sql`
        SELECT id, title, category, content, tags, 'guide' as type
        FROM aem_guides
        WHERE (title ILIKE ${term} OR content ILIKE ${term})
        AND category = ${category}
        LIMIT ${limit}
      `
    : await sql`
        SELECT id, title, category, content, tags, 'guide' as type
        FROM aem_guides
        WHERE title ILIKE ${term} OR content ILIKE ${term}
        LIMIT ${limit}
      `;

  const workflows = await sql`
    SELECT id, name as title, category, steps as content, 'workflow' as type
    FROM workflows
    WHERE name ILIKE ${term} OR steps ILIKE ${term}
    LIMIT ${Math.ceil(limit / 2)}
  `;

  const errors = await sql`
    SELECT id, title, category,
           symptoms || ' ' || solution as content,
           error_code, 'error' as type
    FROM error_guides
    WHERE title ILIKE ${term}
    OR symptoms ILIKE ${term}
    OR error_code ILIKE ${term}
    LIMIT ${Math.ceil(limit / 2)}
  `;

  return [...guides, ...workflows, ...errors]
    .slice(0, limit)
    .map(r => ({ ...r, score: 0.7, search_type: "keyword" }));
}

// ══════════════════════════════════════════
// SEARCH — Semantic (pgvector)
// ══════════════════════════════════════════
export async function semanticSearch(embedding, category, limit = 5) {
  const embStr = JSON.stringify(embedding);

  const guides = category
    ? await sql`
        SELECT id, title, category, content, tags, 'guide' as type,
               1 - (embedding <=> ${embStr}::vector) AS score
        FROM aem_guides
        WHERE embedding IS NOT NULL
        AND category = ${category}
        ORDER BY embedding <=> ${embStr}::vector
        LIMIT ${limit}
      `
    : await sql`
        SELECT id, title, category, content, tags, 'guide' as type,
               1 - (embedding <=> ${embStr}::vector) AS score
        FROM aem_guides
        WHERE embedding IS NOT NULL
        ORDER BY embedding <=> ${embStr}::vector
        LIMIT ${limit}
      `;

  const workflows = await sql`
    SELECT id, name as title, category, steps as content,
           'workflow' as type,
           1 - (embedding <=> ${embStr}::vector) AS score
    FROM workflows
    WHERE embedding IS NOT NULL
    ORDER BY embedding <=> ${embStr}::vector
    LIMIT ${Math.ceil(limit / 2)}
  `;

  const errors = await sql`
    SELECT id, title, category,
           symptoms || ' ' || solution as content,
           error_code, 'error' as type,
           1 - (embedding <=> ${embStr}::vector) AS score
    FROM error_guides
    WHERE embedding IS NOT NULL
    ORDER BY embedding <=> ${embStr}::vector
    LIMIT ${Math.ceil(limit / 2)}
  `;

  return [...guides, ...workflows, ...errors]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(r => ({ ...r, search_type: "semantic" }));
}

// ══════════════════════════════════════════
// SEARCH — Hybrid (keyword + semantic)
// ══════════════════════════════════════════
export async function hybridSearch(
  query,
  embedding,
  category,
  limit = 5,
  weights = { keyword: 0.3, semantic: 0.7 }
) {
  const [keywordResults, semanticResults] = await Promise.all([
    keywordSearch(query, category, limit),
    semanticSearch(embedding, category, limit),
  ]);

  // Combine + deduplicate by ID + type
  const seen = new Map();

  for (const r of keywordResults) {
    const key = `${r.type}-${r.id}`;
    seen.set(key, {
      ...r,
      keyword_score:  r.score,
      semantic_score: 0,
      final_score:    r.score * weights.keyword,
      search_type:    "hybrid",
    });
  }

  for (const r of semanticResults) {
    const key = `${r.type}-${r.id}`;
    if (seen.has(key)) {
      const existing = seen.get(key);
      existing.semantic_score = r.score;
      existing.final_score +=  r.score * weights.semantic;
    } else {
      seen.set(key, {
        ...r,
        keyword_score:  0,
        semantic_score: r.score,
        final_score:    r.score * weights.semantic,
        search_type:    "hybrid",
      });
    }
  }

  return [...seen.values()]
    .sort((a, b) => b.final_score - a.final_score)
    .slice(0, limit);
}

// ══════════════════════════════════════════
// PAGE OWNER LOOKUP
// ══════════════════════════════════════════
export async function getPageOwner(pagePath) {
  const rows = await sql`
    SELECT * FROM page_owners
    WHERE page_path = ${pagePath}
    OR page_path = ${pagePath.replace(/\/$/, "")}
    LIMIT 1
  `;
  return rows[0] || null;
}

// ══════════════════════════════════════════
// ERROR GUIDE LOOKUP
// ══════════════════════════════════════════
export async function getErrorGuide(errorCode) {
  const rows = await sql`
    SELECT * FROM error_guides
    WHERE error_code = ${errorCode}
    LIMIT 1
  `;
  return rows[0] || null;
}

// ══════════════════════════════════════════
// SAVE EMBEDDING
// ══════════════════════════════════════════
export async function saveEmbedding(table, id, embedding) {
  const embStr = JSON.stringify(embedding);
  if (table === "aem_guides") {
    await sql`UPDATE aem_guides SET embedding = ${embStr}::vector WHERE id = ${id}`;
  } else if (table === "workflows") {
    await sql`UPDATE workflows SET embedding = ${embStr}::vector WHERE id = ${id}`;
  } else if (table === "error_guides") {
    await sql`UPDATE error_guides SET embedding = ${embStr}::vector WHERE id = ${id}`;
  }
}

export { sql };
