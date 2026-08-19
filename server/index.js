import "dotenv/config";
import express   from "express";
import cors      from "cors";
import { initDB } from "./db.js";
import { runAgent } from "./agent.js";
import { getCached, setCached, getCacheStats, clearCache } from "./cache.js";

const app  = express();
const PORT = process.env.PORT || 3007;

app.use(cors());
app.use(express.json());

// ── Health ──
app.get("/health", async (req, res) => {
  const cache = await getCacheStats();
  res.json({
    status:  "ok",
    service: "AEM Knowledge Agent",
    model:   "claude-sonnet-4-6",
    tools:   ["search_knowledge_base", "get_page_owner", "get_error_guide"],
    cache,
  });
});

// ── Ask ──
app.post("/ask", async (req, res) => {
  const {
    question,
    searchConfig = {
      dataSource: "sql",
      mode:       "keyword",
      weights:    { keyword: 0.3, semantic: 0.7 },
      limit:      5,
    },
  } = req.body;

  if (!question || !question.trim()) {
    return res.status(400).json({ error: "Question is required" });
  }

  console.log(`\n📥 Question: ${question}`);
  console.log(`⚙️  Config: ${JSON.stringify(searchConfig)}`);

  try {
    // ── Check cache first ──
    const cached = await getCached(question, searchConfig);
    if (cached) {
      return res.json({
        success: true,
        result:  { ...cached, fromCache: true },
      });
    }

    // ── Run agent ──
    const result = await runAgent(question, searchConfig);

    // ── Cache the result ──
    await setCached(question, searchConfig, result);

    res.json({ success: true, result: { ...result, fromCache: false } });
  } catch (err) {
    console.error("Agent error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── Clear cache ──
app.delete("/cache", async (req, res) => {
  const result = await clearCache();
  res.json({ success: true, ...result });
});

// Init DB then start
if (process.env.NODE_ENV !== "test") {
  initDB().then(() => {
    app.listen(PORT, () => {
      console.log(`\n✅ AEM Knowledge Agent running on http://localhost:${PORT}`);
      console.log(`   POST   /ask    → ask a question`);
      console.log(`   GET    /health → check status + cache stats`);
      console.log(`   DELETE /cache  → clear cache\n`);
    });
  });
}

export default app;
