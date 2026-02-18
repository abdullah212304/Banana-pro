
import React from 'react';
import { Sparkles, Image as ImageIcon, MessageSquare, Zap, Shield, Cpu } from 'lucide-react';

export const APP_NAME = "Nano Banana Agent";
export const APP_TAGLINE = "Intelligent, Multimodal, Effortless.";

export const MODELS = {
  TEXT: 'gemini-3-flash-preview',
  IMAGE: 'gemini-2.5-flash-image',
};

export const SYSTEM_PROMPT = `You are Nano Banana, a sleek and highly capable AI agent. 
You are sophisticated, witty, and helpful. You prefer concise, high-impact responses.
When a user asks you to "imagine", "visualize", or "generate an image" of something, 
acknowledge it briefly and let them know you're crafting it.
Your tone should be futuristic and friendly.`;

export const FEATURES = [
  {
    icon: <Sparkles className="w-5 h-5 text-yellow-400" />,
    title: "Crystal Reasoning",
    description: "Powered by Gemini 3 Flash for near-instant responses."
  },
  {
    icon: <ImageIcon className="w-5 h-5 text-yellow-400" />,
    title: "Banana Vision",
    description: "High-fidelity image generation (Nano Banana series)."
  },
  {
    icon: <Zap className="w-5 h-5 text-yellow-400" />,
    title: "Zero Latency",
    description: "Optimized for speed and fluid interactions."
  }
];
