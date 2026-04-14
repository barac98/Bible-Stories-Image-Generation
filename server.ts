import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API route for image generation
  app.post("/api/generate", async (req, res) => {
    const { prompt } = req.body;
    const HF_API_KEY = process.env.HF_API_KEY;

    if (!HF_API_KEY) {
      console.error("HF_API_KEY is not set in environment variables.");
      return res.status(500).json({ error: "Hugging Face API Key is not configured. Please add HF_API_KEY to your secrets." });
    }

    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    try {
      console.log(`Generating image for prompt: ${prompt}`);
      const response = await fetch(
        "https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell",
        {
          headers: { 
            "Authorization": `Bearer ${HF_API_KEY}`,
            "Content-Type": "application/json"
          },
          method: "POST",
          body: JSON.stringify({ inputs: prompt }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Hugging Face API error (${response.status}):`, errorText);
        return res.status(response.status).send(errorText);
      }

      const buffer = await response.arrayBuffer();
      const contentType = response.headers.get("content-type") || "image/webp";
      
      res.setHeader("Content-Type", contentType);
      res.send(Buffer.from(buffer));
    } catch (error) {
      console.error("Server error during image generation:", error);
      res.status(500).json({ error: "Failed to generate image due to a server error." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
