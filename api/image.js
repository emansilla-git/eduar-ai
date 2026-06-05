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

  const { prompt } = req.body || {};
  if (!prompt) return res.status(400).json({ error: "Prompt requerido" });

  // Models to try in order (all free on HF)
  const models = [
    "stabilityai/stable-diffusion-2-1",
    "runwayml/stable-diffusion-v1-5",
    "CompVis/stable-diffusion-v1-4"
  ];

  let lastError = "";

  for (const model of models) {
    try {
      console.log("Trying model:", model, "prompt:", prompt.substring(0, 40));

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 55000); // 55s timeout

      const response = await fetch(
        "https://api-inference.huggingface.co/models/" + model,
        {
          method: "POST",
          headers: {
            "Authorization": "Bearer " + apiKey,
            "Content-Type": "application/json",
            "x-wait-for-model": "true"
          },
          body: JSON.stringify({ inputs: prompt }),
          signal: controller.signal
        }
      );

      clearTimeout(timeout);
      console.log("Response status:", response.status, "from model:", model);

      if (response.status === 503) {
        lastError = "Modelo cargando (" + model + ")";
        continue; // try next model
      }

      if (!response.ok) {
        const txt = await response.text();
        lastError = "Error " + response.status + " from " + model + ": " + txt.substring(0, 100);
        console.error(lastError);
        continue;
      }

      const contentType = response.headers.get("content-type") || "";
      console.log("Content-Type:", contentType);

      if (contentType.includes("application/json")) {
        const json = await response.json();
        lastError = "JSON response from " + model + ": " + JSON.stringify(json).substring(0, 100);
        console.error(lastError);
        continue;
      }

      // Success - binary image
      const buffer = await response.arrayBuffer();
      console.log("Success! Image size:", buffer.byteLength, "bytes from", model);

      const base64 = Buffer.from(buffer).toString("base64");
      const mime = contentType.includes("png") ? "image/png" : "image/jpeg";
      return res.status(200).json({ url: "data:" + mime + ";base64," + base64 });

    } catch (err) {
      lastError = "Exception with " + model + ": " + err.message;
      console.error(lastError);
    }
  }

  // All models failed
  return res.status(500).json({ 
    error: "No se pudo generar la imagen. Último error: " + lastError
  });
}
