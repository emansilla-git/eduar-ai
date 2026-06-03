// api/chat.js — Vercel Serverless Function
// Proxy seguro para la API de Anthropic

export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "API Key no configurada en el servidor" });
  }

  try {
    const { messages, system } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Mensajes inválidos" });
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: system || "Eres Eduar.ai, asistente de inteligencia artificial creado por Eduardo (Córdoba, Argentina). Respondé siempre en español con claridad y calidez.",
        messages: messages,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Error Anthropic:", data);
      return res.status(response.status).json({ error: data.error?.message || "Error de la API" });
    }

    return res.status(200).json(data);

  } catch (err) {
    console.error("Error:", err.message);
    return res.status(500).json({ error: "Error interno: " + err.message });
  }
}
