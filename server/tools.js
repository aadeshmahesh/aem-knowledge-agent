import "dotenv/config";
import { VoyageAIClient } from "voyageai";
import {
  keywordSearch,
  semanticSearch,
  hybridSearch,
  getPageOwner,
  getErrorGuide,
} from "./db.js";

const voyage = new VoyageAIClient({ apiKey: process.env.VOYAGE_API_KEY });

// ── Generate embedding ──
async function embed(text) {
  const res = await voyage.embed({
    input: [text],
    model: "voyage-3-lite",
  });
  return res.data[0].embedding;
}

// ══════════════════════════════════════════
// TOOL DEFINITIONS
// ══════════════════════════════════════════
export const TOOLS = [
  {
    name: "search_knowledge_base",
    description: `Search AEM documentation, how-to guides, policies, and troubleshooting articles.
Use this for questions about:
- How to do something in AEM (authoring, publishing, workflows)
- AEM access requests and permissions
- Content workflows and approval processes
- General AEM troubleshooting`,
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query — what the user is looking for",
        },
        category: {
          type: "string",
          description: "Optional filter by category",
          enum: ["AEM Authoring", "Access Management", "Workflows", "Troubleshooting"],
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_page_owner",
    description: `Look up who owns a specific AEM page path.
Use when user asks:
- Who owns this page?
- Who is responsible for /content/site/en/...?
- Who should I contact about this page?`,
    input_schema: {
      type: "object",
      properties: {
        page_path: {
          type: "string",
          description: "The AEM page path e.g. /content/site/en/home",
        },
      },
      required: ["page_path"],
    },
  },
  {
    name: "get_error_guide",
    description: `Get troubleshooting guide for a specific error code.
Use when user mentions a specific error code like 404, 403, 500, REPL_001.`,
    input_schema: {
      type: "object",
      properties: {
        error_code: {
          type: "string",
          description: "The error code e.g. 404, 403, 500, REPL_001",
        },
      },
      required: ["error_code"],
    },
  },
];

// ══════════════════════════════════════════
// TOOL EXECUTOR
// ══════════════════════════════════════════
export async function executeTool(name, input, searchConfig = {}) {
  const {
    dataSource = "sql",             // sql | vector
    mode       = "keyword",         // keyword | semantic | hybrid
    weights    = { keyword: 0.3, semantic: 0.7 },
    limit      = 5,
  } = searchConfig;

  // SQL only mode always uses keyword
  const effectiveMode = dataSource === "sql" ? "keyword" : mode;

  console.log(`\n🔧 Tool: ${name} | DataSource: ${dataSource} | Mode: ${effectiveMode}`);
  console.log(`   Input: ${JSON.stringify(input)}`);

  // ── search_knowledge_base ──
  if (name === "search_knowledge_base") {
    const { query, category } = input;
    let results = [];

    if (effectiveMode === "keyword") {
      results = await keywordSearch(query, category, limit);
      console.log(`   🗄️ SQL keyword search → ${results.length} results`);

    } else if (effectiveMode === "semantic") {
      const embedding = await embed(query);
      results = await semanticSearch(embedding, category, limit);
      console.log(`   🧠 Semantic search → ${results.length} results`);

    } else {
      // hybrid
      const embedding = await embed(query);
      results = await hybridSearch(query, embedding, category, limit, weights);
      console.log(`   ⚡ Hybrid search → ${results.length} results`);
    }

    if (results.length === 0) {
      return {
        found: false,
        message: "No relevant documentation found for this query.",
      };
    }

    return {
      found:   true,
      mode,
      count:   results.length,
      results: results.map(r => ({
        title:       r.title,
        category:    r.category,
        content:     r.content,
        type:        r.type,
        score:       r.final_score || r.score,
        search_type: r.search_type,
      })),
    };
  }

  // ── get_page_owner ──
  if (name === "get_page_owner") {
    const { page_path } = input;
    const owner = await getPageOwner(page_path);

    if (!owner) {
      return {
        found:   false,
        message: `No owner found for path: ${page_path}. Contact the AEM admin team at aem-admin@company.com`,
      };
    }

    return {
      found:       true,
      page_path:   owner.page_path,
      owner_name:  owner.owner_name,
      owner_email: owner.owner_email,
      team:        owner.team,
      last_updated: owner.last_updated,
    };
  }

  // ── get_error_guide ──
  if (name === "get_error_guide") {
    const { error_code } = input;
    const guide = await getErrorGuide(error_code);

    if (!guide) {
      return {
        found:   false,
        message: `No specific guide for error ${error_code}. Try searching the knowledge base or contact #aem-support on Slack.`,
      };
    }

    return {
      found:      true,
      error_code: guide.error_code,
      title:      guide.title,
      symptoms:   guide.symptoms,
      solution:   guide.solution,
    };
  }

  return { error: `Unknown tool: ${name}` };
}
