# ⚙️ AEM Knowledge Agent — Project 7

Internal knowledge base agent for AEM (Adobe Experience Manager).
Answers natural language questions using hybrid search over a structured knowledge base.

**New concept vs Projects 1-6:**
- SQL Agent pattern — LLM queries structured DB via tools
- Hybrid search — keyword (ILIKE) + semantic (pgvector) combined
- Configurable search mode + weights from UI
- Real enterprise use case (internal KB)

---

## Quick Start

```bash
# Terminal 1 — Server
cd aem-knowledge-agent/server
npm install
cp .env.example .env   # add keys
npm run seed           # seed DB + generate embeddings
npm run dev            # port 3007

# Terminal 2 — Client
cd aem-knowledge-agent/client
npm install
npm run dev            # port 5179
```

---

## What It Does

```
User asks: "How do I create a page in AEM?"
        ↓
Agent calls: search_knowledge_base({ query: "create page AEM" })
        ↓
Hybrid search:
  Keyword: ILIKE '%create%page%'    → 2 results
  Semantic: pgvector cosine search  → 3 results
  Combined + scored                 → top 5
        ↓
LLM answers from retrieved docs ✅

User asks: "Who owns /content/site/en/home?"
        ↓
Agent calls: get_page_owner({ page_path: "/content/site/en/home" })
        ↓
SQL: SELECT * FROM page_owners WHERE page_path = $1
        ↓
"Sarah Johnson (sarah@company.com) — Marketing team"

User asks: "I'm getting a 404 error"
        ↓
Agent calls: get_error_guide({ error_code: "404" })
        ↓
SQL: SELECT * FROM error_guides WHERE error_code = $1
        ↓
Step-by-step fix guide ✅
```

---

## Search Modes

| Mode | How | Best For |
|---|---|---|
| Keyword | ILIKE '%query%' | Exact terms, error codes |
| Semantic | pgvector cosine similarity | Meaning, synonyms |
| Hybrid | Both combined with weights | Best results (default) |

### Configurable Weights
```
Hybrid default: 30% keyword + 70% semantic

Adjust via UI slider:
  More keyword → exact term matching
  More semantic → broader meaning search
```

---

## DB Schema

```sql
aem_guides      -- how-to articles + embeddings
workflows       -- workflow steps + embeddings
page_owners     -- page path → owner lookup (no embedding)
error_guides    -- error code → fix guide + embeddings
```

---

## Tools

```
search_knowledge_base  → hybrid/keyword/semantic search
get_page_owner         → SQL lookup by page path
get_error_guide        → SQL lookup by error code
```

---

## What's New vs Projects 1-6

| | Previous Projects | P7 AEM Agent |
|---|---|---|
| Data source | External APIs / mock | Internal DB ✅ |
| Search | Pure semantic (P3) | Hybrid configurable ✅ |
| Tools | Action tools | Knowledge retrieval tools ✅ |
| Use case | Generic | Enterprise internal KB ✅ |

---

## Cost Optimization Strategies

### What Costs Money
```
Embedding (Voyage AI):  ~$0.000001 per query  ← almost FREE
LLM (Anthropic):        ~$0.001 per question  ← main cost
pgvector search:        FREE
SQL queries:            FREE
```

### Strategy 1 — Redis Cache (Biggest Impact)
```
Cache LLM answers for repeated questions.
Same question asked 100x → LLM called once.

80% cache hit rate = 80% cost reduction.

Cache key:  hash(question + searchMode)
TTL:        1 hour (KB content changes slowly)
```

### Strategy 2 — SQL First for Structured Lookups
```
Page owner lookup → direct SQL → FREE
Error code lookup → direct SQL → FREE
No LLM needed for exact lookups.
```

### Strategy 3 — Limit Search Results
```
limit: 3  → 600 input tokens  ← cheap ✅
limit: 10 → 2000 input tokens ← expensive ❌

Quality barely changes with fewer results.
```

### Strategy 4 — Haiku for Simple Questions
```
Simple (page owner, error code):
  → claude-haiku  (10x cheaper)

Complex (workflow explanation, how-to):
  → claude-sonnet (better quality)
```

### Strategy 5 — Concise System Prompt
```
System prompt sent every turn.
Every extra word = extra cost.
Keep it under 100 tokens.
```

### Cost Comparison
```
Naive (no optimization):
  1000 questions/day × $0.001 = $1.00/day

Optimized (cache + SQL + Haiku):
  200 LLM calls (80% cached)
  100 Haiku (simple questions)
  100 Sonnet (complex questions)
  = ~$0.12/day → 88% reduction ✅
```

---

## Production Enhancements

### What Would Make This Production Ready
```
✅ Redis caching          → cost + speed
✅ Auth (JWT/Cognito)     → secure access
✅ Rate limiting          → prevent abuse
✅ Audit logging          → track usage
✅ Analytics dashboard    → popular questions
✅ Feedback mechanism     → thumbs up/down
✅ Auto-reindex           → when KB updated
✅ Multi-language         → i18n support
```

### How to Extend / Integrate
```
REST API (already built):
  Any system can call POST /ask
  Returns structured JSON response

Slack Bot:
  → Slack sends webhook to POST /ask
  → Response posted back to channel
  → Not AI — just a webhook integration
  → Employees ask @aem-bot in Slack

Microsoft Teams:
  → Same pattern as Slack
  → Teams webhook → POST /ask → reply

ServiceNow:
  → Auto-answer tickets via POST /ask
  → Reduces L1 support load

Chrome Extension:
  → Right-click in AEM → "Ask KB"
  → Calls POST /ask with selected text

Email:
  → Forward email to bot address
  → Auto-reply with KB answer
```

### Why Slack/Teams is NOT an AI Feature
```
Slack integration = webhook call
  → Any app can do this
  → No AI involved in the integration
  → The AI is in POST /ask endpoint

The impressive part is:
  ✅ Hybrid search logic
  ✅ Agentic loop
  ✅ SQL + vector decision
  ✅ Cost optimization
  ✅ Configurable search modes

Slack is just a delivery channel.
The AI lives in the agent. ✅
```

---

---

## How It Works — Step by Step

### Your Question to Final Answer

```
You: "please help me to create a page in AEM"
        ↓
POST /ask → index.js
        ↓
Check Redis cache first
  HIT  → return instantly ⚡
  MISS → run agent
        ↓
Turn 1: Send to LLM
  messages: [
    { role: "user", content: "please help me..." }
  ]
        ↓
LLM responds:
  stop_reason: "tool_use"
  content: [{
    type:  "tool_use",
    name:  "search_knowledge_base",
    input: { query: "create page AEM" }
  }]
        ↓
YOUR CODE runs SQL:
  SELECT * FROM aem_guides
  WHERE content ILIKE '%create page AEM%'
  → Returns matching doc ✅
        ↓
Turn 2: Send results BACK to LLM
  messages: [
    { role: "user",      content: "please help me..." },
    { role: "assistant", content: [tool_use block]    },
    { role: "user",      content: [{
        type:        "tool_result",
        tool_use_id: "tool_001",
        content:     JSON.stringify({
          found: true,
          results: [{
            title:   "How to Create a Page in AEM",
            content: "To create a page... step 1... step 2..."
          }]
        })
    }]}
  ]
        ↓
LLM reads DB results
  stop_reason: "end_turn"
        ↓
LLM answers in own words:
  "Here's how to create a page in AEM! 🎉
   1. Navigate to AEM Sites console...
   2. Click Create..."
        ↓
Save answer to Redis cache
        ↓
Return answer to UI ✅
```

---

### Simple Visual

```
You → LLM → "I need to search DB"
              ↓
          YOUR CODE → SQL → DB
                         ↓
                      results
                         ↓
You ← LLM ← results sent back
              ↓
          "Here's the answer!"
```

---

### What LLM Sees in Turn 2

```
LLM receives full context in Turn 2:

  System prompt       (instructions)
  + Turn 1 user msg   (your question)
  + Turn 1 assistant  (tool_use call)
  + Turn 2 user msg   (SQL results) ← NEW

LLM reads ALL of this together
then generates final answer
based on real DB data ✅
```

---

### Exact SQL That Runs

```sql
-- When you ask: "please help me to create a page in AEM"
-- LLM extracts query: "create page AEM"
-- term = '%create page AEM%'

-- Query 1: aem_guides
SELECT id, title, category, content, tags, 'guide' as type
FROM aem_guides
WHERE title   ILIKE '%create page AEM%'
OR    content ILIKE '%create page AEM%'
LIMIT 5;

-- Query 2: workflows
SELECT id, name as title, category,
       steps as content, 'workflow' as type
FROM workflows
WHERE name  ILIKE '%create page AEM%'
OR    steps ILIKE '%create page AEM%'
LIMIT 3;

-- Query 3: error_guides
SELECT id, title, category,
       symptoms || ' ' || solution as content,
       error_code, 'error' as type
FROM error_guides
WHERE title      ILIKE '%create page AEM%'
OR    symptoms   ILIKE '%create page AEM%'
OR    error_code ILIKE '%create page AEM%'
LIMIT 3;
```

---

### Why It Found the Right Doc

```
Query extracted: "create page AEM"

ILIKE '%create page AEM%' checks:

title:   "How to Create a Page in AEM"
         → contains "Create" ✅
         → contains "Page" ✅
         → contains "AEM" ✅
         → MATCH ✅

content: "To create a new page in AEM..."
         → also matches ✅
```

---

### LLM Answers in Own Words

```
LLM does NOT copy-paste from DB.
It READS the content and EXPLAINS it.

Like asking a colleague:
  You:       "how do I create a page?"
  Colleague: reads the guide...
  Colleague: explains in their words ✅

This is better than copy-paste:
  → Natural conversational answer ✅
  → Can combine multiple sources ✅
  → Can add context ✅
  → Feels like real assistant ✅
```

---

### Why This Is Called Agentic

```
Normal LLM:
  Question → LLM → Answer
  (from training data only — may hallucinate)

Agentic LLM:
  Question → LLM → tool call
                → YOUR CODE runs SQL
                → results sent back
                → LLM answers from
                   REAL DB data ✅

The loop between LLM and your code
= agentic pattern ✅

LLM  = the brain 🧠  (decides what to search)
Code = the hands 🤝  (runs SQL, sends results)
DB   = knowledge 📚  (stores real data)
```

---

### Keyword Search Limitation

```
ILIKE works when user uses exact words:

✅ "create a page"    → finds "Create a Page" doc
✅ "404 error"        → finds "404" error guide
✅ "publish content"  → finds "Publish" guide

❌ "make a new page"  → ILIKE '%make%new%page%'
                        "make" not in docs
                        only "create" → MISS

❌ "I want to author content"
                      → ILIKE '%author%content%'
                        different vocabulary → MISS

This is the vocabulary mismatch problem.
Switch to Vector mode to solve it:
  "make a new page" → finds "create page" ✅
  Semantic meaning beats exact keywords ✅
```

---

### Keyword vs Vector — Side by Side

```
Query: "make a new page"

SQL Keyword mode:
  ILIKE '%make a new page%'
  → No match ❌
  → Returns empty

Vector/Semantic mode:
  embed("make a new page")
  → [0.21, 0.79, 0.11, ...]

  embed("How to Create a Page in AEM")
  → [0.22, 0.78, 0.12, ...]

  cosine similarity = 0.94 (very close!)
  → MATCH ✅
  → Returns correct doc

"make" and "create" mean the same thing
Vector captures meaning, not just words ✅
```
