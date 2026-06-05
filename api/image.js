// api/image.js — Vercel Serverless Function
// Genera imágenes usando Hugging Face - modelo gratuito

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  const apiKey = process.env.HF_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "HF_API_KEY no configurada en Vercel" });

  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt requerido" });

    console.log("Generating image for prompt:", prompt.substring(0, 50));

    // Use flux-schnell which is free on Hugging Face
    const response = await fetch(
      "https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell",
      {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + apiKey,
          "Content-Type": "application/json",
          "x-wait-for-model": "true"
        },
        body: JSON.stringify({
          inputs: prompt,
        }),
      }
    );

    console.log("HF response status:", response.status);

    if (!response.ok) {
      const errText = await response.text();
      console.error("HF error:", errText.substring(0, 300));
      if (response.status === 503) {
        return res.status(503).json({ 
          error: "El modelo está iniciando. Esperá 30 segundos e intentá de nuevo.",
          retry: true
        });
      }
      return res.status(response.status).json({ 
        error: "Error de Hugging Face (status " + response.status + "): " + errText.substring(0, 150)
      });
    }

    // Check content type
    const contentType = response.headers.get("content-type") || "";
    console.log("Content-Type:", contentType);

    if (contentType.includes("application/json")) {
      const jsonData = await response.json();
      console.error("Unexpected JSON:", JSON.stringify(jsonData).substring(0, 200));
      return res.status(500).json({ error: "Respuesta inesperada del modelo: " + JSON.stringify(jsonData).substring(0, 100) });
    }

    // Binary image response
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const mimeType = contentType.includes("png") ? "image/png" : "image/jpeg";
    const dataUrl = "data:" + mimeType + ";base64," + base64;

    console.log("Image generated successfully, size:", buffer.byteLength, "bytes");
    return res.status(200).json({ url: dataUrl });

  } catch (err) {
    console.error("Internal error:", err.message);
    return res.status(500).json({ error: "Error interno: " + err.message });
  }
}
