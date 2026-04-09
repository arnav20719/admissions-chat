export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { message } = req.body || {};
    if (!message || typeof message !== "string") {
      console.error("Invalid body:", req.body);
      return res.status(400).json({ error: "Missing or invalid `message`" });
    }

    const VAPI_PRIVATE_KEY = process.env.VAPI_PRIVATE_KEY;
    const VAPI_ASSISTANT_ID = process.env.VAPI_ASSISTANT_ID;

    if (!VAPI_PRIVATE_KEY) {
      console.error("Missing env: VAPI_PRIVATE_KEY");
      return res.status(500).json({ error: "Missing VAPI_PRIVATE_KEY env var" });
    }
    if (!VAPI_ASSISTANT_ID) {
      console.error("Missing env: VAPI_ASSISTANT_ID");
      return res.status(500).json({ error: "Missing VAPI_ASSISTANT_ID env var" });
    }

    const payload = { assistantId: VAPI_ASSISTANT_ID, input: message, stream: false };

    const vapiResp = await fetch("https://api.vapi.ai/chat", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${VAPI_PRIVATE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const text = await vapiResp.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      console.error("Vapi returned non-JSON:", { status: vapiResp.status, text });
      return res.status(502).json({ error: "Vapi returned non-JSON response", status: vapiResp.status });
    }

    if (!vapiResp.ok) {
      console.error("Vapi error:", { status: vapiResp.status, data });
      return res.status(502).json({ error: "Vapi request failed", status: vapiResp.status, details: data });
    }

    const reply =
      (Array.isArray(data.output) && data.output.find((m) => m.role === "assistant")?.content) || "";

    return res.status(200).json({ reply });
  } catch (err) {
    console.error("Server exception:", err);
    return res.status(500).json({ error: "Server error", details: String(err?.message || err) });
  }
}
