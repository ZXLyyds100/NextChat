import { createServer } from "node:http";

// Local, synthetic API fixture. Never contacts Mistral or uses real credentials.
const port = 3512;
const events = [];
const text = [
  "Bonjour! This reply was streamed through NextChat's native Mistral provider.",
  "",
  "- Provider-specific API key: verified by the local fixture",
  "- Chat completion route: /v1/chat/completions",
  "- Text and content-chunk SSE events: received",
  "",
  "Local test fixture — this is not a live Mistral model response.",
].join("\n");

const server = createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  if (req.method === "OPTIONS") return res.writeHead(204).end();
  if (req.url === "/events") {
    return res.writeHead(200, { "Content-Type": "application/json" })
      .end(JSON.stringify(events, null, 2));
  }
  if (req.method !== "POST" || req.url !== "/v1/chat/completions") {
    return res.writeHead(404).end();
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const payload = JSON.parse(Buffer.concat(chunks).toString());
  const authValid = [
    "Bearer server-mistral-fixture-key",
    "Bearer client-mistral-fixture-key",
  ].includes(req.headers.authorization);
  const event = {
    timestamp: new Date().toISOString(),
    model: payload.model,
    stream: payload.stream,
    authValid,
    messages: payload.messages,
    temperature: payload.temperature,
    max_tokens: payload.max_tokens,
    aborted: false,
  };
  events.push(event);
  console.log(JSON.stringify({ ...event, messages: `[${payload.messages?.length ?? 0} synthetic messages]` }));
  if (!authValid) {
    return res.writeHead(401, { "Content-Type": "application/json" })
      .end(JSON.stringify({ message: "Local fixture: incorrect Mistral key" }));
  }
  const lastMessage = payload.messages.at(-1)?.content ?? "";
  if (lastMessage.includes("[rate-limit]")) {
    return res.writeHead(429, { "Content-Type": "application/json", "Retry-After": "5" })
      .end(JSON.stringify({ message: "Local fixture: rate limit exceeded" }));
  }
  if (!payload.stream) {
    return res.writeHead(200, { "Content-Type": "application/json" })
      .end(JSON.stringify({
        id: "fixture-completion",
        model: payload.model,
        choices: [{ message: { role: "assistant", content: text }, finish_reason: "stop" }],
      }));
  }
  res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" });
  const send = (delta, extra = {}) => res.write(`data: ${JSON.stringify({
    id: "fixture-completion",
    model: payload.model,
    choices: [{ index: 0, delta, finish_reason: null }],
    ...extra,
  })}\n\n`);
  send({ role: "assistant", content: "" });
  const parts = text.match(/.{1,12}|\n/g);
  let index = 0;
  let done = false;
  const timer = setInterval(() => {
    if (index >= parts.length) {
      res.write('data: {"choices":[],"usage":{"prompt_tokens":10,"completion_tokens":20}}\n\n');
      res.write("data: [DONE]\n\n");
      done = true;
      clearInterval(timer);
      res.end();
      return;
    }
    const part = parts[index++];
    send({ content: index % 2 ? part : [{ type: "text", text: part }] });
  }, lastMessage.includes("[slow]") ? 600 : 60);
  res.on("close", () => {
    clearInterval(timer);
    event.aborted = !done;
  });
});
server.listen(port, "127.0.0.1", () => {
  console.log(`Synthetic Mistral API fixture listening on http://127.0.0.1:${port}`);
});
