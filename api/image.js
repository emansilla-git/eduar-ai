// api/image.js — Usa Hugging Face Serverless Inference (rápido)
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  const apiKey = process.env.HF_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "HF_API_KEY no configurada" });

  const { prompt } = req.body || {};
  if (!prompt) return res.status(400).json({ error: "Prompt requerido" });

  try {
    console.log("Requesting image for:", prompt.substring(0, 50));

    // Use HF Inference API with fast model - 8 second max
    const response = await fetch(
      "https://api-inference.huggingface.co/models/stabilityai/sdxl-turbo",
      {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            num_inference_steps: 1,
            guidance_scale: 0.0,
          }
        }),
      }
    );

    console.log("Status:", response.status);

    if (response.status === 503) {
      // Model loading - return special status so frontend can show message
      return res.status(202).json({ 
        loading: true,
        error: "El modelo está cargando, esperá 20 segundos e intentá de nuevo."
      });
    }

    if (!response.ok) {
      const txt = await response.text();
      console.error("Error:", response.status, txt.substring(0, 200));
      return res.status(response.status).json({ 
        error: "Error " + response.status + ": " + txt.substring(0, 150)
      });
    }

    const ct = response.headers.get("content-type") || "";
    if (ct.includes("json")) {
      const j = await response.json();
      console.error("Unexpected JSON:", JSON.stringify(j).substring(0, 200));
      return res.status(500).json({ error: "Respuesta inesperada: " + JSON.stringify(j).substring(0, 100) });
    }

    const buffer = await response.arrayBuffer();
    console.log("Success! Bytes:", buffer.byteLength);
    const b64 = Buffer.from(buffer).toString("base64");
    const mime = ct.includes("png") ? "image/png" : "image/jpeg";
    return res.status(200).json({ url: "data:" + mime + ";base64," + b64 });

  } catch (err) {
    console.error("Exception:", err.message);
    return res.status(500).json({ error: "Error: " + err.message });
  }
}
