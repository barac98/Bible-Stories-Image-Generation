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
    const { prompt, api = "pollinations" } = req.body;
    const HF_API_KEY = process.env.HF_API_KEY;
    const DEAPI_KEY = process.env.DEAPI_KEY;

    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    try {
      // Append strict styling to ensure no shading and large areas
      const enhancedPrompt = `${prompt}, bold black and white line art, extremely thick chunky outlines, large empty coloring areas, no shading, no gray, no gradients, no shadows, pure white background, simple toddler style, flat 2d`;
      
      console.log(`Generating image using ${api} for prompt: ${enhancedPrompt}`);

      if (api === "hf") {
        if (!HF_API_KEY) {
          return res.status(500).json({ error: "Hugging Face API Key is not configured." });
        }
        const response = await fetch(
          "https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell",
          {
            headers: { 
              "Authorization": `Bearer ${HF_API_KEY}`,
              "Content-Type": "application/json"
            },
            method: "POST",
            body: JSON.stringify({ 
              inputs: enhancedPrompt,
              parameters: { width: 832, height: 1088, num_inference_steps: 4 }
            }),
          }
        );
        if (!response.ok) {
          const errorText = await response.text();
          if (response.status === 402) {
            throw new Error("Hugging Face credits depleted. Please switch to 'Pollinations' for free generation.");
          }
          throw new Error(`HF API error: ${errorText}`);
        }
        const buffer = await response.arrayBuffer();
        res.setHeader("Content-Type", response.headers.get("content-type") || "image/webp");
        return res.send(Buffer.from(buffer));
      } 
      
      if (api === "deapi") {
        if (!DEAPI_KEY) {
          return res.status(500).json({ error: "DEApi Key is not configured." });
        }
        
        // Correcting the endpoint domain to .com as .io and .it failed to resolve
        const response = await fetch("https://api.deapi.com/v1/image/generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${DEAPI_KEY}`
          },
          body: JSON.stringify({
            prompt: enhancedPrompt,
            model: "flux-schnell",
            width: 832,
            height: 1088
          })
        });

        if (!response.ok) throw new Error(`DEApi error: ${await response.text()}`);
        
        const data = await response.json();
        const imageUrl = data.image_url || data.url || (data.images && data.images[0]);
        
        if (!imageUrl) throw new Error("DEApi succeeded but no image URL found");
        
        const imgRes = await fetch(imageUrl);
        const buffer = await imgRes.arrayBuffer();
        res.setHeader("Content-Type", "image/png");
        return res.send(Buffer.from(buffer));
      }

      // Default: Pollinations.ai
      const encodedPrompt = encodeURIComponent(enhancedPrompt);
      const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=832&height=1088&model=flux&nologo=true&seed=${Math.floor(Math.random() * 1000000)}`;
      const response = await fetch(imageUrl);
      if (!response.ok) throw new Error(`Pollinations API error: ${await response.text()}`);
      const buffer = await response.blob();
      const arrayBuffer = await buffer.arrayBuffer();
      res.setHeader("Content-Type", "image/png");
      res.send(Buffer.from(arrayBuffer));

    } catch (error) {
      console.error("Server error during image generation:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to generate image" });
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
