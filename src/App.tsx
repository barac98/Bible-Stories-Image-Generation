/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Download, BookOpen, Sparkles, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function App() {
  const [storyName, setStoryName] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);

  const generateColoringPage = async () => {
    if (!storyName.trim()) {
      toast.error("Please enter a Bible story name.");
      return;
    }

    setIsGenerating(true);
    setGeneratedImage(null);

    try {
      // Constructing a detailed prompt for FLUX
      const promptText = `bold-line coloring page for children, Bible story: ${storyName}, simple black and white line art, thick black outlines, no shading, no gradients, high contrast, pure white background, clear edges, easy for kids to color, professional coloring book style, 8.5x11 aspect ratio`;
      
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt: promptText }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(errorData || "Failed to generate image from server");
      }
      
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      
      setGeneratedImage(objectUrl);
      toast.success("Coloring page generated!");
    } catch (error) {
      console.error("Generation error:", error);
      toast.error("Failed to generate coloring page. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadImage = () => {
    if (!generatedImage) return;
    const link = document.createElement("a");
    link.href = generatedImage;
    link.download = `${storyName.replace(/\s+/g, "-").toLowerCase()}-coloring-page.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-[#fdfcf8] text-[#3c2f2f] font-sans selection:bg-[#e6d5b8]">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <header className="text-center mb-12">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center justify-center p-3 bg-[#e6d5b8] rounded-full mb-4">
              <BookOpen className="w-8 h-8 text-[#8b5e3c]" />
            </div>
            <h1 className="text-4xl md:text-5xl font-serif font-bold mb-3 tracking-tight">
              Bible Story Coloring Pages
            </h1>
            <p className="text-lg text-[#6b5b4b] max-w-xl mx-auto">
              Transform your favorite Bible stories into beautiful, bold-line coloring pages for kids.
            </p>
          </motion.div>
        </header>

        <main className="space-y-8">
          <Card className="border-2 border-[#e6d5b8] shadow-sm bg-white overflow-hidden">
            <CardHeader className="bg-[#f9f7f2] border-b border-[#e6d5b8]">
              <CardTitle className="text-xl font-serif">What story should we color today?</CardTitle>
              <CardDescription>Enter a story like "Noah's Ark", "David and Goliath", or "The Good Shepherd".</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                  <Input
                    placeholder="Enter Bible story name..."
                    value={storyName}
                    onChange={(e) => setStoryName(e.target.value)}
                    className="h-12 text-lg border-[#d4c3a3] focus-visible:ring-[#8b5e3c] pl-4"
                    onKeyDown={(e) => e.key === "Enter" && generateColoringPage()}
                  />
                </div>
                <Button
                  onClick={generateColoringPage}
                  disabled={isGenerating}
                  className="h-12 px-8 bg-[#8b5e3c] hover:bg-[#6b4a2f] text-white font-semibold transition-all duration-300"
                >
                  {isGenerating ? (
                    <>
                      <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-5 w-5" />
                      Generate Page
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          <AnimatePresence mode="wait">
            {isGenerating ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex flex-col items-center justify-center space-y-4 p-12 border-2 border-dashed border-[#e6d5b8] rounded-2xl bg-white/50"
              >
                <div className="relative">
                  <Skeleton className="w-[300px] h-[400px] rounded-lg shadow-inner" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center p-6 bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-[#e6d5b8]">
                      <RefreshCw className="w-10 h-10 text-[#8b5e3c] animate-spin mx-auto mb-3" />
                      <p className="font-medium text-[#3c2f2f]">Drawing your story...</p>
                      <p className="text-sm text-[#6b5b4b] mt-1 italic">"Let there be light!"</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : generatedImage ? (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div className="flex justify-between items-center px-2">
                  <h3 className="text-2xl font-serif font-bold text-[#3c2f2f]">
                    {storyName}
                  </h3>
                  <Button
                    variant="outline"
                    onClick={downloadImage}
                    className="border-[#8b5e3c] text-[#8b5e3c] hover:bg-[#8b5e3c] hover:text-white"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download PNG
                  </Button>
                </div>
                
                <div className="relative group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-[#e6d5b8] to-[#d4c3a3] rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
                  <div className="relative bg-white p-4 rounded-xl border-2 border-[#e6d5b8] shadow-xl overflow-hidden">
                    <img
                      src={generatedImage}
                      alt={`Coloring page for ${storyName}`}
                      className="w-full h-auto max-h-[80vh] object-contain rounded-lg shadow-sm"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                </div>
                
                <div className="text-center text-sm text-[#6b5b4b] italic">
                  Tip: Print this out on 8.5" x 11" paper for the best coloring experience!
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-20 border-2 border-dashed border-[#e6d5b8] rounded-2xl bg-white/30"
              >
                <div className="max-w-xs mx-auto space-y-4">
                  <div className="w-16 h-16 bg-[#f9f7f2] rounded-full flex items-center justify-center mx-auto border border-[#e6d5b8]">
                    <Sparkles className="w-8 h-8 text-[#d4c3a3]" />
                  </div>
                  <h3 className="text-xl font-serif font-medium">Ready to create?</h3>
                  <p className="text-[#6b5b4b]">
                    Enter a Bible story name above to generate a unique coloring page instantly.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        <footer className="mt-20 pt-8 border-t border-[#e6d5b8] text-center text-[#8b5e3c]/60 text-sm">
          <p>© {new Date().getFullYear()} Bible Story Coloring Pages • Powered by FLUX.1-schnell on Hugging Face</p>
        </footer>
      </div>
      <Toaster position="bottom-center" />
    </div>
  );
}
