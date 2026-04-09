export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { message, previousChatId } = req.body || {};
  if (!message) return res.status(400).json({ error: "Missing message" });

  const VAPI_PRIVATE_KEY = process.env.VAPI_PRIVATE_KEY;
  const ASSISTANT_ID = process.env.VAPI_ASSISTANT_ID;

  if (!VAPI_PRIVATE_KEY) return res.status(500).json({ error: "Missing VAPI_PRIVATE_KEY" });
  if (!ASSISTANT_ID) return res.status(500).json({ error: "Missing VAPI_ASSISTANT_ID" });

  const r = await fetch("https://api.vapi.ai/chat", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${VAPI_PRIVATE_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      assistantId: ASSISTANT_ID,
      input: message,
      previousChatId: previousChatId || undefined
    })
  });

  const data = await r.json();
  return res.status(r.status).json(data);
}
