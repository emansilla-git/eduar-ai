// api/image.js - Test connectivity first
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const apiKey = process.env.HF_API_KEY;
  const { prompt } = req.body || {};

  try {
    // First test: can we reach HF at all?
    console.log("Testing HF connectivity...");
    
    const testRes = await fetch("https://huggingface.co/api/models/stabilityai/sdxl-turbo", {
      method: "GET",
      headers: { "Authorization": "Bearer " + apiKey }
    });
    
    console.log("HF connectivity test:", testRes.status);
    
    if (!testRes.ok) {
      return res.status(500).json({ 
        error: "No se puede conectar a Hugging Face desde Vercel. Status: " + testRes.status 
      });
    }

    // Now try inference
    const response = await fetch(
      "https://api-inference.huggingface.co/models/stabilityai/sdxl-turbo",
      {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + apiKey,
          "Content-Type": "application/json",
          "x-wait-for-model": "true"
        },
        body: JSON.stringify({
          inputs: (prompt || "a cat") + ", high quality",
          parameters: { num_inference_steps: 1, guidance_scale: 0.0, width: 512, height: 512 }
        }),
      }
    );

    console.log("Inference status:", response.status);

    if (response.status === 503) {
      return res.status(202).json({ loading: true, error: "Modelo iniciando, reintentá en 30s" });
    }
    if (!response.ok) {
      const t = await response.text();
      return res.status(500).json({ error: "Inference error " + response.status + ": " + t.substring(0,150) });
    }

    const ct = response.headers.get("content-type") || "";
    if (ct.includes("json")) {
      const j = await response.json();
      return res.status(500).json({ error: "JSON: " + JSON.stringify(j).substring(0,100) });
    }

    const buf = await response.arrayBuffer();
    const b64 = Buffer.from(buf).toString("base64");
    return res.status(200).json({ url: "data:image/jpeg;base64," + b64 });

  } catch (err) {
    console.error("Exception:", err.message, err.cause ? JSON.stringify(err.cause) : "");
    return res.status(500).json({ 
      error: "Exception: " + err.message,
      cause: err.cause ? String(err.cause) : undefined
    });
  }
}
