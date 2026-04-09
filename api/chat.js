export default async function handler(req, res) {
  // --- CORS (needed for browser calls) ---
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Preflight request
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { message } = req.body || {};

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Missing or invalid `message`" });
    }

    const VAPI_PRIVATE_KEY = process.env.VAPI_PRIVATE_KEY;
    const VAPI_ASSISTANT_ID = process.env.VAPI_ASSISTANT_ID;

    if (!VAPI_PRIVATE_KEY) {
      return res.status(500).json({ error: "Missing VAPI_PRIVATE_KEY env var" });
    }
    if (!VAPI_ASSISTANT_ID) {
      return res.status(500).json({ error: "Missing VAPI_ASSISTANT_ID env var" });
    }

    const vapiResp = await fetch("https://api.vapi.ai/chat", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${VAPI_PRIVATE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        assistantId: VAPI_ASSISTANT_ID,
        input: message,
        stream: false,
      }),
    });

    const data = await vapiResp.json();

    if (!vapiResp.ok) {
      return res.status(vapiResp.status).json({
        error: "Vapi request failed",
        details: data,
      });
    }

    // Vapi returns: { output: [{ role: "assistant", content: "..." }], ... }
    const reply =
      (Array.isArray(data.output) &&
        data.output.find((m) => m.role === "assistant")?.content) ||
      "";

    return res.status(200).json({ reply, raw: data });
  } catch (err) {
    return res.status(500).json({
      error: "Server error",
      details: String(err?.message || err),
    });
  }
}
