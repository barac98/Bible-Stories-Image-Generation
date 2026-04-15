/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { GoogleGenAI } from "@google/genai";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Download, BookOpen, Sparkles, RefreshCw, Edit3, Wand2, Layers, Trash2, CheckCircle2, AlertCircle, FileArchive, Settings2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface GeneratedImage {
  id: string;
  prompt: string;
  url: string | null;
  status: "pending" | "loading" | "success" | "error";
  error?: string;
}

type GenerationApi = "pollinations" | "hf" | "deapi";

export default function App() {
  const [topic, setTopic] = useState("");
  const [imageCount, setImageCount] = useState(3);
  const [selectedApi, setSelectedApi] = useState<GenerationApi>("pollinations");
  const [prompts, setPrompts] = useState<string[]>([]);
  const [isGeneratingPrompts, setIsGeneratingPrompts] = useState(false);
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [step, setStep] = useState<"input" | "review" | "results">("input");

  const generatePrompts = async () => {
    if (!topic.trim()) {
      toast.error("Please enter a topic.");
      return;
    }

    setIsGeneratingPrompts(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Create a list of ${imageCount} unique and high-quality image generation prompts for children's coloring book pages based on the topic: "${topic}". 
        Each prompt MUST specify: 
        - Style: "Bold & Easy" toddler coloring book style.
        - Lines: Extremely thick, chunky, heavy black outlines.
        - Composition: One or two large, simple objects or characters.
        - Coloring Areas: HUGE, WIDE OPEN, EMPTY white spaces for coloring. No small details.
        - Shading: ABSOLUTELY NO SHADING, no shadows, no gray, no gradients, no textures.
        - Background: Pure white, empty background.
        - Keywords: "bold and easy", "large coloring areas", "thick lines", "simple shapes", "no shading", "pure white", "flat line art", "toddler coloring page", "thick black outlines".
        Focus on making the pages extremely easy to color for a 3-year-old, with zero clutter and zero shading.
        Format the output as a simple list where each prompt is on a new line. Do not include numbers or bullet points.`,
      });

      const text = response.text;
      if (text) {
        const lines = text.split("\n").filter(line => line.trim().length > 10).slice(0, imageCount);
        setPrompts(lines);
        setStep("review");
      } else {
        throw new Error("Failed to generate prompts.");
      }
    } catch (error) {
      console.error("Prompt generation error:", error);
      toast.error("Failed to generate prompts. Please try again.");
    } finally {
      setIsGeneratingPrompts(false);
    }
  };

  const startBulkGeneration = async () => {
    setStep("results");
    setIsGeneratingImages(true);
    
    const initialImages: GeneratedImage[] = prompts.map((p, i) => ({
      id: `img-${i}-${Date.now()}`,
      prompt: p,
      url: null,
      status: "pending"
    }));
    
    setGeneratedImages(initialImages);

    // Process images one by one or in small batches to avoid overwhelming the server
    for (let i = 0; i < initialImages.length; i++) {
      const currentImg = initialImages[i];
      
      setGeneratedImages(prev => prev.map(img => 
        img.id === currentImg.id ? { ...img, status: "loading" } : img
      ));

      try {
        const response = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            prompt: currentImg.prompt,
            api: selectedApi
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Generation failed");
        }
        
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        
        setGeneratedImages(prev => prev.map(img => 
          img.id === currentImg.id ? { ...img, status: "success", url } : img
        ));
      } catch (error) {
        console.error(`Error generating image ${i}:`, error);
        setGeneratedImages(prev => prev.map(img => 
          img.id === currentImg.id ? { ...img, status: "error", error: error instanceof Error ? error.message : "Failed to generate" } : img
        ));
      }
    }
    
    setIsGeneratingImages(false);
    toast.success("Bulk generation complete!");
  };

  const downloadAllAsZip = async () => {
    const successfulImages = generatedImages.filter(img => img.status === "success" && img.url);
    if (successfulImages.length === 0) {
      toast.error("No images to download.");
      return;
    }

    setIsZipping(true);
    try {
      const zip = new JSZip();
      const folder = zip.folder(`${topic.replace(/\s+/g, "-").toLowerCase()}-coloring-book`);
      
      if (!folder) throw new Error("Failed to create zip folder");

      const fetchPromises = successfulImages.map(async (img, idx) => {
        const response = await fetch(img.url!);
        const blob = await response.blob();
        folder.file(`page-${idx + 1}.png`, blob);
      });

      await Promise.all(fetchPromises);
      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, `${topic.replace(/\s+/g, "-").toLowerCase()}-coloring-book.zip`);
      toast.success("Coloring book downloaded!");
    } catch (error) {
      console.error("Zipping error:", error);
      toast.error("Failed to create ZIP file.");
    } finally {
      setIsZipping(false);
    }
  };

  const updatePrompt = (index: number, value: string) => {
    const newPrompts = [...prompts];
    newPrompts[index] = value;
    setPrompts(newPrompts);
  };

  const removePrompt = (index: number) => {
    setPrompts(prompts.filter((_, i) => i !== index));
  };

  const downloadImage = (url: string, index: number) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = `${topic.replace(/\s+/g, "-").toLowerCase()}-${index + 1}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const reset = () => {
    setTopic("");
    setPrompts([]);
    setGeneratedImages([]);
    setStep("input");
  };

  return (
    <div className="min-h-screen bg-[#fdfcf8] text-[#3c2f2f] font-sans selection:bg-[#e6d5b8]">
      <div className="max-w-5xl mx-auto px-4 py-12">
        <header className="text-center mb-12">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center justify-center p-3 bg-[#e6d5b8] rounded-full mb-4 cursor-pointer hover:scale-105 transition-transform" onClick={reset}>
              <Layers className="w-8 h-8 text-[#8b5e3c]" />
            </div>
            <h1 className="text-4xl md:text-5xl font-serif font-bold mb-3 tracking-tight">
              Bulk Coloring Page Creator
            </h1>
            <p className="text-lg text-[#6b5b4b] max-w-xl mx-auto">
              Generate entire collections of coloring pages in seconds.
            </p>
          </motion.div>
        </header>

        <main className="space-y-8">
          <AnimatePresence mode="wait">
            {step === "input" && (
              <motion.div
                key="input-step"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                <Card className="border-2 border-[#e6d5b8] shadow-sm bg-white overflow-hidden">
                  <CardHeader className="bg-[#f9f7f2] border-b border-[#e6d5b8]">
                    <CardTitle className="text-xl font-serif">Step 1: Choose a Topic & Quantity</CardTitle>
                    <CardDescription>What would you like to create a collection of?</CardDescription>
                  </CardHeader>
                  <CardContent className="p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                      <div className="md:col-span-6">
                        <Label className="text-[#8b5e3c] mb-2 block">Topic</Label>
                        <Input
                          placeholder="e.g., Ocean Animals, Space Exploration, Bible Stories"
                          value={topic}
                          onChange={(e) => setTopic(e.target.value)}
                          className="h-12 text-lg border-[#d4c3a3] focus-visible:ring-[#8b5e3c]"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Label className="text-[#8b5e3c] mb-2 block">Quantity</Label>
                        <Input
                          type="number"
                          min="1"
                          max="40"
                          value={imageCount}
                          onChange={(e) => setImageCount(Math.min(40, Math.max(1, parseInt(e.target.value) || 1)))}
                          className="h-12 text-lg border-[#d4c3a3] focus-visible:ring-[#8b5e3c]"
                        />
                      </div>
                      <div className="md:col-span-4">
                        <Label className="text-[#8b5e3c] mb-2 block flex items-center gap-2">
                          <Settings2 className="w-4 h-4" />
                          Generation Engine
                        </Label>
                        <Select value={selectedApi} onValueChange={(v) => setSelectedApi(v as GenerationApi)}>
                          <SelectTrigger className="h-12 border-[#d4c3a3] focus:ring-[#8b5e3c]">
                            <SelectValue placeholder="Select API" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pollinations">Pollinations (Free, Fast)</SelectItem>
                            <SelectItem value="hf">Hugging Face (High Quality)</SelectItem>
                            <SelectItem value="deapi">DEApi (Professional)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div className="flex justify-center pt-4">
                      <Button
                        onClick={generatePrompts}
                        disabled={isGeneratingPrompts}
                        className="h-14 px-12 bg-[#8b5e3c] hover:bg-[#6b4a2f] text-white font-bold text-lg shadow-lg w-full md:w-auto"
                      >
                        {isGeneratingPrompts ? (
                          <RefreshCw className="mr-2 h-6 w-6 animate-spin" />
                        ) : (
                          <Wand2 className="mr-2 h-6 w-6" />
                        )}
                        Draft Collection Prompts
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {step === "review" && (
              <motion.div
                key="review-step"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6"
              >
                <div className="flex justify-between items-center px-2">
                  <h2 className="text-2xl font-serif font-bold text-[#3c2f2f]">Review Collection Prompts ({prompts.length})</h2>
                  <Button variant="outline" onClick={() => setStep("input")} className="border-[#d4c3a3]">Back</Button>
                </div>
                
                <div className="grid gap-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                  {prompts.map((p, idx) => (
                    <Card key={idx} className="border-2 border-[#e6d5b8] shadow-sm bg-white">
                      <CardContent className="p-4 flex gap-4">
                        <div className="w-8 h-8 rounded-full bg-[#f9f7f2] border border-[#e6d5b8] flex items-center justify-center shrink-0 text-sm font-bold text-[#8b5e3c]">
                          {idx + 1}
                        </div>
                        <div className="flex-1 space-y-2">
                          <Textarea
                            value={p}
                            onChange={(e) => updatePrompt(idx, e.target.value)}
                            className="min-h-[80px] border-[#d4c3a3] focus-visible:ring-[#8b5e3c]"
                          />
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => removePrompt(idx)}
                          className="text-red-400 hover:text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-5 h-5" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="flex justify-center pt-4">
                  <Button
                    onClick={startBulkGeneration}
                    disabled={prompts.length === 0}
                    className="h-14 px-12 bg-[#8b5e3c] hover:bg-[#6b4a2f] text-white font-bold text-lg shadow-lg"
                  >
                    <Sparkles className="mr-2 h-6 w-6" />
                    Generate All {prompts.length} Pages using {selectedApi === "pollinations" ? "Pollinations" : selectedApi === "hf" ? "Hugging Face" : "DEApi"}
                  </Button>
                </div>
              </motion.div>
            )}

            {step === "results" && (
              <motion.div
                key="results-step"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-8"
              >
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 px-2">
                  <div>
                    <h3 className="text-3xl font-serif font-bold text-[#3c2f2f]">
                      {topic} Collection
                    </h3>
                    <p className="text-[#6b5b4b]">
                      {isGeneratingImages ? `Generating page ${generatedImages.filter(img => img.status === "success").length + 1} of ${generatedImages.length}...` : "Collection complete!"}
                    </p>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    {!isGeneratingImages && (
                      <Button 
                        onClick={downloadAllAsZip} 
                        disabled={isZipping}
                        className="flex-1 sm:flex-none bg-[#8b5e3c] text-white hover:bg-[#6b4a2f]"
                      >
                        {isZipping ? (
                          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <FileArchive className="mr-2 h-4 w-4" />
                        )}
                        Download All (ZIP)
                      </Button>
                    )}
                    {!isGeneratingImages && (
                      <Button onClick={reset} className="flex-1 sm:flex-none bg-[#e6d5b8] text-[#8b5e3c] hover:bg-[#d4c3a3]">
                        Start New
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {generatedImages.map((img, idx) => (
                    <Card key={img.id} className="border-2 border-[#e6d5b8] shadow-md bg-white overflow-hidden group">
                      <div className="aspect-[17/22] relative bg-[#f9f7f2] flex items-center justify-center">
                        {img.status === "loading" && (
                          <div className="flex flex-col items-center gap-3">
                            <RefreshCw className="w-10 h-10 text-[#8b5e3c] animate-spin" />
                            <p className="text-sm font-medium text-[#8b5e3c]">Creating...</p>
                          </div>
                        )}
                        {img.status === "pending" && (
                          <div className="text-[#d4c3a3] flex flex-col items-center gap-2">
                            <RefreshCw className="w-8 h-8 opacity-20" />
                            <p className="text-xs">Waiting...</p>
                          </div>
                        )}
                        {img.status === "error" && (
                          <div className="text-red-400 flex flex-col items-center gap-2 p-4 text-center">
                            <AlertCircle className="w-10 h-10" />
                            <p className="text-sm font-medium">{img.error}</p>
                          </div>
                        )}
                        {img.status === "success" && img.url && (
                          <>
                            <img
                              src={img.url}
                              alt={`Generated coloring page ${idx + 1}`}
                              className="w-full h-full object-contain"
                              referrerPolicy="no-referrer"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                              <Button 
                                size="icon" 
                                className="bg-white text-[#8b5e3c] hover:bg-[#fdfcf8]"
                                onClick={() => downloadImage(img.url!, idx)}
                              >
                                <Download className="w-5 h-5" />
                              </Button>
                            </div>
                            <div className="absolute top-2 right-2">
                              <CheckCircle2 className="w-6 h-6 text-green-500 bg-white rounded-full shadow-sm" />
                            </div>
                          </>
                        )}
                      </div>
                      <CardContent className="p-3 border-t border-[#e6d5b8] bg-[#fdfcf8]">
                        <p className="text-xs text-[#6b5b4b] line-clamp-2 italic">
                          {img.prompt}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        <footer className="mt-20 pt-8 border-t border-[#e6d5b8] text-center text-[#8b5e3c]/60 text-sm">
          <p>© {new Date().getFullYear()} Bulk Coloring Page Creator • Powered by Pollinations.ai, Hugging Face & DEApi</p>
        </footer>
      </div>
      <Toaster position="bottom-center" />
    </div>
  );
}
