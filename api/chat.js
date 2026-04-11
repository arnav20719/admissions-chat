export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  // Debug check
  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      hasKey: !!process.env.VAPI_PRIVATE_KEY,
      hasAssistantId: !!process.env.VAPI_ASSISTANT_ID,
      assistantId: process.env.VAPI_ASSISTANT_ID || null,
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { message, sessionId } = req.body || {};
    if (!message || typeof message !== "string") {
      return res.status(200).json({ reply: "Missing or invalid `message`" });
    }

    const VAPI_PRIVATE_KEY = process.env.VAPI_PRIVATE_KEY;
    const VAPI_ASSISTANT_ID = process.env.VAPI_ASSISTANT_ID;

    if (!VAPI_PRIVATE_KEY) return res.status(200).json({ reply: "Missing VAPI_PRIVATE_KEY env var" });
    if (!VAPI_ASSISTANT_ID) return res.status(200).json({ reply: "Missing VAPI_ASSISTANT_ID env var" });

    // 1) Ensure session
    let activeSessionId =
      typeof sessionId === "string" && sessionId.trim() ? sessionId.trim() : null;

    if (!activeSessionId) {
      const sessionResp = await fetch("https://api.vapi.ai/session", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${VAPI_PRIVATE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assistantId: VAPI_ASSISTANT_ID,
          name: "Admissions Web Chat Session",
          expirationSeconds: 86400,
        }),
      });

      const sessionData = await sessionResp.json().catch(() => null);
      if (!sessionResp.ok || !sessionData?.id) {
        return res.status(200).json({
          reply: `Session create failed. status=${sessionResp.status}`,
        });
      }

      activeSessionId = sessionData.id;
    }

    // 2) Send chat message
    const vapiResp = await fetch("https://api.vapi.ai/chat", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${VAPI_PRIVATE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sessionId: activeSessionId,
        input: message,
        stream: false,
      }),
    });

    const data = await vapiResp.json().catch(() => null);

    if (!vapiResp.ok || !data) {
      return res.status(200).json({
        reply: `Vapi request failed. status=${vapiResp.status}`,
        sessionId: activeSessionId,
      });
    }

    // Collect ALL assistant messages
    const replies = Array.isArray(data.output)
      ? data.output
          .filter((m) => m?.role === "assistant" && typeof m.content === "string" && m.content.trim())
          .map((m) => m.content.trim())
      : [];

    // Prefer showing ONLY the last assistant message (usually the question after tool calls)
    const finalReply = replies.length ? replies[replies.length - 1] : "";

    return res.status(200).json({
      replies,
      reply: finalReply || "Empty assistant reply",
      sessionId: activeSessionId,
    });
  } catch (err) {
    return res.status(200).json({
      reply: `Server exception: ${String(err?.message || err).slice(0, 300)}`,
    });
  }
}
