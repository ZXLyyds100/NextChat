import assert from "node:assert/strict";

const root = process.env.NEXTCHAT_TEST_URL || "http://127.0.0.1:3511";
assert.equal(new URL(root).hostname, "127.0.0.1", "Only a local test deployment is allowed");
const checks = [];
const message = (content, stream = false) => ({
  model: "mistral-large-latest",
  messages: [{ role: "user", content }],
  stream,
});
const chat = (body, authorization = "Bearer client-mistral-fixture-key") =>
  fetch(`${root}/api/mistral/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(authorization && { Authorization: authorization }) },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

// The first call uses an invalid-for-production, synthetic client key.
// Continue only after the local fixture has identified itself.
const direct = await chat(message("HTTP synthetic client-key verification"));
assert.equal(direct.status, 200);
assert((await direct.text()).includes("Local test fixture"));
checks.push({ name: "synthetic client Mistral key", status: "PASS" });

const server = await chat(message("HTTP synthetic server-key verification"), "");
assert.equal(server.status, 200);
assert((await server.text()).includes("Local test fixture"));
checks.push({ name: "server Mistral key injection", status: "PASS" });

const config = await (await fetch(`${root}/api/config`)).text();
assert(!config.includes("server-mistral-fixture-key"));
assert(!config.includes("mistralApiKey"));
checks.push({ name: "public configuration does not expose Mistral credentials", status: "PASS" });

const streaming = await chat(message("HTTP SSE verification", true));
assert.equal(streaming.status, 200);
assert.equal(streaming.headers.get("X-Accel-Buffering"), "no");
assert(streaming.headers.get("Content-Type").startsWith("text/event-stream"));
const sse = await streaming.text();
assert(sse.includes("[DONE]"));
assert(sse.includes('"type":"text"'));
assert(sse.includes('"choices":[]'));
checks.push({ name: "real HTTP SSE with text, content chunks, usage event and DONE", status: "PASS" });

const limited = await chat(message("[rate-limit]"));
assert.equal(limited.status, 429);
assert.equal(limited.headers.get("Retry-After"), "5");
assert((await limited.text()).includes("rate limit"));
checks.push({ name: "upstream 429 and Retry-After preserved", status: "PASS" });

const malformed = await chat("{");
assert.equal(malformed.status, 400);
await malformed.text();
checks.push({ name: "malformed JSON rejected", status: "PASS" });

const denied = await chat(message("wrong key"), "Bearer deliberately-incorrect-fixture-key");
assert.equal(denied.status, 401);
await denied.text();
checks.push({ name: "upstream 401 preserved", status: "PASS" });

const unsupported = await fetch(`${root}/api/mistral/v1/files`, {
  method: "POST",
  headers: { Authorization: "Bearer client-mistral-fixture-key" },
});
assert.equal(unsupported.status, 404);
await unsupported.text();
checks.push({ name: "unsupported upstream paths rejected", status: "PASS" });

console.log(JSON.stringify({ capturedAt: new Date().toISOString(), root, checks }, null, 2));
