import "dotenv/config";
import { Redis } from "@upstash/redis";
import crypto from "crypto";

// ── Redis client (optional — gracefully skip if not configured) ──
let redis = null;

try {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    redis = new Redis({
      url:   process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    console.log("✅ Redis cache enabled");
  } else {
    console.log("⚠️  Redis not configured — caching disabled (add UPSTASH keys to .env)");
  }
} catch (err) {
  console.log("⚠️  Redis connection failed — caching disabled");
}

const TTL = 60 * 60; // 1 hour

// ── Generate cache key from question + search config ──
function makeCacheKey(question, searchConfig) {
  const normalized = question.toLowerCase().trim();
  const configStr  = `${searchConfig.dataSource}:${searchConfig.mode}:${searchConfig.limit}`;
  const hash       = crypto
    .createHash("md5")
    .update(`${normalized}:${configStr}`)
    .digest("hex")
    .slice(0, 12);
  return `aem-kb:${hash}`;
}

// ── Get from cache ──
export async function getCached(question, searchConfig) {
  if (!redis) return null;

  try {
    const key  = makeCacheKey(question, searchConfig);
    const data = await redis.get(key);

    if (data) {
      console.log(`\n⚡ Cache HIT — key: ${key}`);
      return typeof data === "string" ? JSON.parse(data) : data;
    }

    console.log(`\n❌ Cache MISS — key: ${key}`);
    return null;
  } catch (err) {
    console.log("⚠️  Cache get failed:", err.message);
    return null;
  }
}

// ── Save to cache ──
export async function setCached(question, searchConfig, result) {
  if (!redis) return;

  try {
    const key = makeCacheKey(question, searchConfig);
    await redis.set(key, JSON.stringify(result), { ex: TTL });
    console.log(`💾 Cached — key: ${key} (TTL: ${TTL}s)`);
  } catch (err) {
    console.log("⚠️  Cache set failed:", err.message);
  }
}

// ── Cache stats ──
export async function getCacheStats() {
  if (!redis) return { enabled: false };

  try {
    const keys = await redis.keys("aem-kb:*");
    return {
      enabled: true,
      cachedAnswers: keys.length,
      ttlSeconds: TTL,
    };
  } catch {
    return { enabled: true, error: "Could not fetch stats" };
  }
}

// ── Clear cache ──
export async function clearCache() {
  if (!redis) return { cleared: 0 };

  try {
    const keys = await redis.keys("aem-kb:*");
    if (keys.length > 0) {
      await redis.del(...keys);
    }
    return { cleared: keys.length };
  } catch (err) {
    return { error: err.message };
  }
}
