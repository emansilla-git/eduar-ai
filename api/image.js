// api/image.js — Vercel Serverless Function
// Genera imágenes usando Hugging Face Inference API (GRATUITO)

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  const apiKey = process.env.HF_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "HF_API_KEY no configurada" });

  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt requerido" });

    // Use Stable Diffusion model on Hugging Face (free)
    const response = await fetch(
      "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0",
      {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: { width: 768, height: 512 }
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      // Model loading - tell client to retry
      if (response.status === 503) {
        return res.status(503).json({ error: "El modelo está cargando, intentá nuevamente en 30 segundos." });
      }
      return res.status(response.status).json({ error: "Error: " + errText.substring(0, 200) });
    }

    // Response is binary image data
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const dataUrl = "data:image/jpeg;base64," + base64;

    return res.status(200).json({ url: dataUrl });

  } catch (err) {
    console.error("Error:", err.message);
    return res.status(500).json({ error: "Error interno: " + err.message });
  }
}
