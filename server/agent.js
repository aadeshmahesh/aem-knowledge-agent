import "dotenv/config";
import Anthropic  from "@anthropic-ai/sdk";
import Bottleneck from "bottleneck";
import { TOOLS, executeTool } from "./tools.js";

const client  = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const limiter = new Bottleneck({ maxConcurrent: 3, minTime: 200 });
const callLLM = (p) => limiter.schedule(() => client.messages.create(p));

const SYSTEM_PROMPT = `You are an AEM (Adobe Experience Manager) Knowledge Assistant for our company.

You help employees with:
- How-to questions about AEM authoring and publishing
- Access request procedures and permissions
- Content workflow and approval processes
- Page ownership lookups
- Troubleshooting errors and issues

ALWAYS use your tools to find answers — never answer from memory.
If a user mentions a specific error code (404, 403, 500), call get_error_guide first.
If a user asks about page ownership, call get_page_owner with the exact path.
For all other questions, call search_knowledge_base.

When answering:
- Be concise and practical
- Use numbered steps for processes
- Always mention who to contact if issue persists
- Cite the source document title

If the knowledge base doesn't have the answer, say so clearly and suggest:
- Slack: #aem-support
- Email: aem-admin@company.com`;

// ══════════════════════════════════════════
// RUN AGENT
// ══════════════════════════════════════════
export async function runAgent(userMessage, searchConfig = {}) {
  const messages = [{ role: "user", content: userMessage }];
  let turn  = 0;
  const MAX = 8;

  console.log("\n" + "═".repeat(60));
  console.log("🤖 AEM Knowledge Agent");
  console.log(`📝 Query: ${userMessage}`);
  console.log(`⚙️  Search mode: ${searchConfig.mode || "hybrid"}`);
  console.log("═".repeat(60));

  const toolsUsed  = [];
  const searchResults = [];

  while (turn < MAX) {
    turn++;

    const response = await callLLM({
      model:      "claude-sonnet-4-6",
      max_tokens: 2048,
      system:     SYSTEM_PROMPT,
      tools:      TOOLS,
      messages,
    });

    console.log(`\n🔄 Turn ${turn} — stop_reason: ${response.stop_reason}`);

    messages.push({ role: "assistant", content: response.content });

    // Done
    if (response.stop_reason === "end_turn") {
      const answer = response.content
        .filter(b => b.type === "text")
        .map(b => b.text)
        .join("");

      console.log("✅ Agent complete");

      return {
        answer,
        toolsUsed,
        searchResults,
        turns: turn,
        searchConfig,
      };
    }

    // Tool calls
    const toolCalls = response.content.filter(b => b.type === "tool_use");
    if (toolCalls.length === 0) break;

    console.log(`🔧 Tools called: ${toolCalls.map(t => t.name).join(", ")}`);

    // Execute tools in parallel
    const toolResults = await Promise.all(
      toolCalls.map(async (toolCall) => {
        toolsUsed.push(toolCall.name);
        const result = await executeTool(
          toolCall.name,
          toolCall.input,
          searchConfig
        );

        // Track search results for UI
        if (toolCall.name === "search_knowledge_base" && result.results) {
          searchResults.push(...result.results);
        }

        return {
          type:        "tool_result",
          tool_use_id: toolCall.id,
          content:     JSON.stringify(result),
        };
      })
    );

    messages.push({ role: "user", content: toolResults });
  }

  return {
    answer:        "I was unable to find a complete answer. Please contact #aem-support on Slack.",
    toolsUsed,
    searchResults,
    turns: turn,
    searchConfig,
  };
}
