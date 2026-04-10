export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  // TEMP DEBUG: open /api/chat in browser to verify env vars
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
      return res.status(200).json({ reply: "DEBUG: Missing or invalid `message`" });
    }

    const VAPI_PRIVATE_KEY = process.env.VAPI_PRIVATE_KEY;
    const VAPI_ASSISTANT_ID = process.env.VAPI_ASSISTANT_ID;

    if (!VAPI_PRIVATE_KEY) return res.status(200).json({ reply: "DEBUG: Missing VAPI_PRIVATE_KEY env var" });
    if (!VAPI_ASSISTANT_ID) return res.status(200).json({ reply: "DEBUG: Missing VAPI_ASSISTANT_ID env var" });

    // 1) Ensure we have a sessionId (create one if missing)
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
          expirationSeconds: 86400, // 24 hours
        }),
      });

      const sessionText = await sessionResp.text();

      let sessionData;
      try {
        sessionData = JSON.parse(sessionText);
      } catch {
        return res.status(200).json({
          reply: `DEBUG: Vapi session returned non-JSON. status=${sessionResp.status}. text=${sessionText.slice(0, 300)}`,
        });
      }

      if (!sessionResp.ok) {
        return res.status(200).json({
          reply: `DEBUG: Vapi session create failed. status=${sessionResp.status}. details=${JSON.stringify(sessionData).slice(0, 300)}`,
        });
      }

      activeSessionId = sessionData.id;
    }

    // 2) Send chat message using sessionId so context persists
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

    const text = await vapiResp.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return res.status(200).json({
        reply: `DEBUG: Vapi returned non-JSON. status=${vapiResp.status}. text=${text.slice(0, 300)}`,
        sessionId: activeSessionId,
      });
    }

    if (!vapiResp.ok) {
      return res.status(200).json({
        reply: `DEBUG: Vapi request failed. status=${vapiResp.status}. details=${JSON.stringify(data).slice(0, 300)}`,
        sessionId: activeSessionId,
      });
    }

    const reply =
      (Array.isArray(data.output) && data.output.find((m) => m.role === "assistant")?.content) ||
      "";

    return res.status(200).json({
      reply: reply || "DEBUG: Empty assistant reply from Vapi",
      sessionId: activeSessionId,
    });
  } catch (err) {
    return res.status(200).json({
      reply: `DEBUG: Server exception: ${String(err?.message || err).slice(0, 300)}`,
    });
  }
}
