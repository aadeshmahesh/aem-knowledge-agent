import { useState } from "react";

const SERVER = "http://localhost:3007";

const SAMPLE_QUESTIONS = [
  "How do I create a page in AEM?",
  "What access do I need to publish content?",
  "I'm getting a 404 error on /content/site/en/products",
  "Who owns the /content/site/en/home page?",
  "How does the content approval workflow work?",
  "How do I request DAM access?",
  "Content is published but not showing on live site",
];

const MODE_CONFIG = {
  keyword:  { color: "#3B82F6", bg: "#EFF6FF", label: "Keyword",  icon: "🔍" },
  semantic: { color: "#8B5CF6", bg: "#F5F3FF", label: "Semantic", icon: "🧠" },
  hybrid:   { color: "#10B981", bg: "#F0FDF4", label: "Hybrid",   icon: "⚡" },
};

const TYPE_CONFIG = {
  guide:    { icon: "📄", color: "#2563EB" },
  workflow: { icon: "🔄", color: "#7C3AED" },
  error:    { icon: "🚨", color: "#DC2626" },
};

const DATA_SOURCE_CONFIG = {
  sql:    { color: "#2563EB", bg: "#EFF6FF", label: "SQL Only",    icon: "🗄️", desc: "Keyword search + SQL lookups. No embeddings." },
  vector: { color: "#10B981", bg: "#F0FDF4", label: "SQL + Vector", icon: "⚡", desc: "Hybrid search with pgvector embeddings + SQL." },
};

// ── Search Config Panel ──
function SearchConfig({ config, onChange }) {
  const isSQL = config.dataSource === "sql";

  return (
    <div style={{ background: "white", borderRadius: "10px",
      padding: "16px", boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
      marginBottom: "16px" }}>
      <div style={{ fontSize: "12px", fontWeight: 700, color: "#374151",
        marginBottom: "10px" }}>
        ⚙️ Search Configuration
      </div>

      {/* Data Source Toggle */}
      <div style={{ marginBottom: "14px" }}>
        <div style={{ fontSize: "11px", color: "#6B7280",
          fontWeight: 600, marginBottom: "6px" }}>
          Data Source Mode
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          {Object.entries(DATA_SOURCE_CONFIG).map(([ds, cfg]) => (
            <button key={ds}
              onClick={() => onChange({
                ...config,
                dataSource: ds,
                mode: ds === "sql" ? "keyword" : "hybrid",
              })}
              style={{
                flex: 1, padding: "10px 12px", borderRadius: "8px",
                border: `2px solid ${config.dataSource === ds ? cfg.color : "#E5E7EB"}`,
                background: config.dataSource === ds ? cfg.bg : "white",
                color: config.dataSource === ds ? cfg.color : "#6B7280",
                cursor: "pointer", textAlign: "left",
              }}>
              <div style={{ fontSize: "13px", fontWeight: 700 }}>
                {cfg.icon} {cfg.label}
              </div>
              <div style={{ fontSize: "11px", marginTop: "2px",
                color: config.dataSource === ds ? cfg.color : "#9CA3AF" }}>
                {cfg.desc}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Search mode — only show when vector mode */}
      {!isSQL && (
        <>
          <div style={{ fontSize: "11px", color: "#6B7280",
            fontWeight: 600, marginBottom: "6px" }}>
            Search Strategy
          </div>
          <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
            {Object.entries(MODE_CONFIG).map(([mode, cfg]) => (
              <button key={mode}
                onClick={() => onChange({ ...config, mode })}
                style={{
                  flex: 1, padding: "8px", borderRadius: "8px",
                  border: `2px solid ${config.mode === mode ? cfg.color : "#E5E7EB"}`,
                  background: config.mode === mode ? cfg.bg : "white",
                  color: config.mode === mode ? cfg.color : "#6B7280",
                  cursor: "pointer", fontSize: "12px", fontWeight: 600,
                }}>
                {cfg.icon} {cfg.label}
              </button>
            ))}
          </div>

          {/* Weights — only for hybrid */}
          {config.mode === "hybrid" && (
            <div style={{ padding: "10px", background: "#F9FAFB",
              borderRadius: "6px", marginBottom: "10px" }}>
              <div style={{ fontSize: "11px", color: "#6B7280",
                marginBottom: "8px", fontWeight: 600 }}>
                Hybrid Weights
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "11px", color: "#3B82F6",
                  fontWeight: 600, width: "80px" }}>
                  🔍 Keyword: {Math.round(config.weights.keyword * 100)}%
                </span>
                <input type="range" min="0" max="100"
                  value={Math.round(config.weights.keyword * 100)}
                  onChange={e => {
                    const k = e.target.value / 100;
                    onChange({
                      ...config,
                      weights: { keyword: k, semantic: 1 - k }
                    });
                  }}
                  style={{ flex: 1 }}
                />
                <span style={{ fontSize: "11px", color: "#8B5CF6",
                  fontWeight: 600, width: "80px", textAlign: "right" }}>
                  🧠 Semantic: {Math.round(config.weights.semantic * 100)}%
                </span>
              </div>
            </div>
          )}
        </>
      )}

      {/* SQL mode info */}
      {isSQL && (
        <div style={{ padding: "10px", background: "#EFF6FF",
          borderRadius: "6px", marginBottom: "10px",
          fontSize: "12px", color: "#2563EB" }}>
          🗄️ Using keyword search (ILIKE) + SQL lookups only.
          No Voyage AI calls. Fast and simple.
        </div>
      )}

      {/* Limit */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <span style={{ fontSize: "11px", color: "#6B7280", fontWeight: 600 }}>
          Results limit:
        </span>
        {[3, 5, 8, 10].map(n => (
          <button key={n}
            onClick={() => onChange({ ...config, limit: n })}
            style={{
              padding: "3px 10px", borderRadius: "4px",
              border: `1px solid ${config.limit === n ? "#111827" : "#E5E7EB"}`,
              background: config.limit === n ? "#111827" : "white",
              color: config.limit === n ? "white" : "#6B7280",
              cursor: "pointer", fontSize: "12px",
            }}>
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Source Card ──
function SourceCard({ result }) {
  const [expanded, setExpanded] = useState(false);
  const type = TYPE_CONFIG[result.type] || TYPE_CONFIG.guide;
  const mode = MODE_CONFIG[result.search_type] || MODE_CONFIG.hybrid;

  return (
    <div onClick={() => setExpanded(!expanded)}
      style={{ border: "1px solid #E5E7EB", borderRadius: "8px",
        padding: "10px 12px", marginBottom: "6px", cursor: "pointer",
        background: expanded ? "#F9FAFB" : "white" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span>{type.icon}</span>
        <span style={{ fontSize: "12px", fontWeight: 600,
          color: "#111827", flex: 1 }}>
          {result.title}
        </span>
        <span style={{ fontSize: "10px", padding: "2px 6px",
          background: mode.bg, color: mode.color,
          borderRadius: "4px", fontWeight: 600 }}>
          {mode.icon} {mode.label}
        </span>
        {result.score && (
          <span style={{ fontSize: "10px", color: "#9CA3AF",
            fontFamily: "monospace" }}>
            {(result.score * 100).toFixed(0)}%
          </span>
        )}
        <span style={{ fontSize: "10px", color: "#9CA3AF" }}>
          {expanded ? "▲" : "▼"}
        </span>
      </div>
      {expanded && (
        <div style={{ marginTop: "8px", paddingTop: "8px",
          borderTop: "1px solid #E5E7EB",
          fontSize: "12px", color: "#6B7280",
          lineHeight: 1.6, whiteSpace: "pre-wrap",
          maxHeight: "200px", overflowY: "auto" }}>
          {result.content?.substring(0, 500)}
          {result.content?.length > 500 ? "..." : ""}
        </div>
      )}
    </div>
  );
}

// ── Answer Display ──
function Answer({ result }) {
  const cfg = MODE_CONFIG[result.searchConfig?.mode] || MODE_CONFIG.hybrid;

  return (
    <div style={{ background: "white", borderRadius: "12px",
      padding: "20px", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>

      {/* Meta */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "16px",
        flexWrap: "wrap" }}>
        {result.fromCache && (
          <span style={{ fontSize: "11px", padding: "3px 8px",
            background: "#F0FDF4", color: "#10B981",
            borderRadius: "4px", fontWeight: 700 }}>
            ⚡ Cached Response
          </span>
        )}
        <span style={{ fontSize: "11px", padding: "3px 8px",
          background: cfg.bg, color: cfg.color,
          borderRadius: "4px", fontWeight: 600 }}>
          {cfg.icon} {cfg.label} Search
        </span>
        <span style={{ fontSize: "11px", padding: "3px 8px",
          background: "#F3F4F6", color: "#6B7280",
          borderRadius: "4px" }}>
          🔧 {result.toolsUsed?.join(", ")}
        </span>
        <span style={{ fontSize: "11px", padding: "3px 8px",
          background: "#F3F4F6", color: "#6B7280",
          borderRadius: "4px" }}>
          🔄 {result.turns} turns
        </span>
        {result.searchResults?.length > 0 && (
          <span style={{ fontSize: "11px", padding: "3px 8px",
            background: "#F3F4F6", color: "#6B7280",
            borderRadius: "4px" }}>
            📄 {result.searchResults.length} sources
          </span>
        )}
      </div>

      {/* Answer */}
      <div style={{ fontSize: "14px", color: "#111827",
        lineHeight: 1.8, whiteSpace: "pre-wrap",
        marginBottom: "20px" }}>
        {result.answer}
      </div>

      {/* Sources */}
      {result.searchResults?.length > 0 && (
        <div>
          <div style={{ fontSize: "11px", fontWeight: 700,
            color: "#6B7280", marginBottom: "8px",
            textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Sources Used
          </div>
          {result.searchResults.slice(0, 5).map((r, i) => (
            <SourceCard key={i} result={r} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main App ──
export default function App() {
  const [question, setQuestion] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [result,   setResult]   = useState(null);
  const [error,    setError]    = useState("");
  const [config,   setConfig]   = useState({
    dataSource: "sql",              // sql | vector
    mode:       "keyword",          // keyword | semantic | hybrid
    weights:    { keyword: 0.3, semantic: 0.7 },
    limit:      5,
  });

  const ask = async (q = question) => {
    if (!q.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res  = await fetch(`${SERVER}/ask`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ question: q, searchConfig: config }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data.result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#F9FAFB",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>

      {/* Header */}
      <div style={{ background: "#E8532A", padding: "16px 24px",
        display: "flex", alignItems: "center", gap: "12px" }}>
        <div style={{ fontSize: "24px" }}>⚙️</div>
        <div>
          <div style={{ fontSize: "16px", fontWeight: 800,
            color: "white", letterSpacing: "-0.02em" }}>
            AEM Knowledge Agent
          </div>
          <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.8)" }}>
            Project 7 — SQL + Hybrid Search · Internal Knowledge Base
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 16px" }}>

        {/* Search Config */}
        <SearchConfig config={config} onChange={setConfig} />

        {/* Input */}
        <div style={{ background: "white", borderRadius: "12px",
          padding: "16px", boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
          marginBottom: "16px" }}>
          <div style={{ display: "flex", gap: "10px" }}>
            <input
              value={question}
              onChange={e => setQuestion(e.target.value)}
              onKeyDown={e => e.key === "Enter" && ask()}
              placeholder="Ask anything about AEM..."
              style={{ flex: 1, padding: "12px 14px",
                border: "1px solid #E5E7EB", borderRadius: "8px",
                fontSize: "14px", outline: "none",
                fontFamily: "inherit" }}
            />
            <button onClick={() => ask()} disabled={loading}
              style={{ padding: "12px 20px",
                background: loading ? "#9CA3AF" : "#E8532A",
                color: "white", border: "none", borderRadius: "8px",
                cursor: loading ? "not-allowed" : "pointer",
                fontSize: "14px", fontWeight: 700,
                whiteSpace: "nowrap" }}>
              {loading ? "⏳ Asking..." : "Ask →"}
            </button>
          </div>

          {error && (
            <div style={{ marginTop: "10px", padding: "10px",
              background: "#FEF2F2", border: "1px solid #FECACA",
              borderRadius: "6px", color: "#DC2626", fontSize: "13px" }}>
              ❌ {error}
            </div>
          )}
        </div>

        {/* Sample Questions */}
        {!result && !loading && (
          <div style={{ background: "white", borderRadius: "12px",
            padding: "16px", boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
            marginBottom: "16px" }}>
            <div style={{ fontSize: "12px", fontWeight: 700,
              color: "#374151", marginBottom: "10px" }}>
              Try these questions:
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {SAMPLE_QUESTIONS.map((q, i) => (
                <button key={i}
                  onClick={() => { setQuestion(q); ask(q); }}
                  style={{ padding: "6px 12px", borderRadius: "20px",
                    border: "1px solid #E5E7EB", background: "#F9FAFB",
                    color: "#374151", cursor: "pointer",
                    fontSize: "12px", textAlign: "left" }}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ background: "white", borderRadius: "12px",
            padding: "48px", textAlign: "center",
            boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
            <div style={{ fontSize: "36px", marginBottom: "12px" }}>⚙️</div>
            <div style={{ fontWeight: 700, color: "#111827",
              marginBottom: "6px" }}>
              Searching knowledge base...
            </div>
            <div style={{ fontSize: "13px", color: "#9CA3AF" }}>
              Mode: {MODE_CONFIG[config.mode]?.icon} {config.mode}
            </div>
          </div>
        )}

        {/* Result */}
        {result && <Answer result={result} />}
      </div>
    </div>
  );
}
