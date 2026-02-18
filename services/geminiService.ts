
import { GoogleGenAI, Type } from "@google/genai";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export interface MontageSegment {
  start_timestamp: string;
  end_timestamp: string;
  visual_description: string;
}

const getAI = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export async function withRetry<T>(fn: () => Promise<T>, maxRetries = 7): Promise<T> {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const message = (error?.message || "").toLowerCase();
      const status = (error?.status || "").toString().toLowerCase();
      const code = (error?.code || error?.error?.code || "").toString();

      if ((code === "429" || status.includes("429") || message.includes("quota")) && i < maxRetries - 1) {
        const waitTime = Math.pow(2, i) * 5000 + Math.random() * 3000;
        await sleep(waitTime);
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

export const geminiService = {
  async generateVideo(prompt: string, config: { 
    style: string, 
    orientation: string, 
    resolution: string
  }) {
    return withRetry(async () => {
      const ai = getAI();
      // Use the high-quality model for 1080p to prevent black screen issues
      const modelName = config.resolution === '1080p' ? 'veo-3.1-generate-preview' : 'veo-3.1-fast-generate-preview';
      
      const finalPrompt = `
        CRITICAL PRODUCTION DIRECTIVE: 
        THE RESULTING VIDEO MUST BE EXACTLY 5 SECONDS LONG.
        Style: ${config.style}. 
        Subject: ${prompt}.
      `;
      
      const operation = await ai.models.generateVideos({
        model: modelName,
        prompt: finalPrompt,
        config: {
          numberOfVideos: 1,
          resolution: config.resolution as any,
          aspectRatio: config.orientation as any,
        }
      });
      return operation;
    });
  },

  async generateLogoAnimation(logoBase64: string, niche: string, mimeType: string, aspectRatio: '16:9' | '9:16' = '16:9', resolution: '720p' | '1080p' = '720p', customDirection: string = '') {
    return withRetry(async () => {
      const ai = getAI();
      // Use the high-quality model for 1080p to prevent black screen issues
      const modelName = resolution === '1080p' ? 'veo-3.1-generate-preview' : 'veo-3.1-fast-generate-preview';

      const prompt = `STRICT LOGO INTEGRITY DIRECTIVE: 
      - THE PROVIDED IMAGE IS THE LOGO. IT IS SACRED.
      - USE THE LOGO EXACTLY AS IT APPEARS. DO NOT REDESIGN, RECOLOR, OR DISTORT ITS BUBBLY TEAL FORM.
      - THE TASK IS A CINEMATIC REVEAL ANIMATION FOR THIS SPECIFIC LOGO.
      - DURATION: EXACTLY 5 SECONDS. 
      - NICHE: ${niche}. 
      - DIRECTION: ${customDirection}`;

      const operation = await ai.models.generateVideos({
        model: modelName,
        prompt: prompt,
        image: {
          imageBytes: logoBase64,
          mimeType: mimeType.includes('png') ? 'image/png' : 'image/jpeg'
        },
        config: {
          numberOfVideos: 1,
          resolution: resolution,
          aspectRatio: aspectRatio
        }
      });
      return operation;
    });
  },

  // Fix: Added missing enhanceImage method to handle image sharpening and watermark removal.
  async enhanceImage(base64: string, mode: 'auto' | 'remedy', prompt?: string) {
    return withRetry(async () => {
      const ai = getAI();
      const instruction = mode === 'remedy' 
        ? `Task: Remove watermark/logo/unwanted objects as specified. Directive: ${prompt || "clean removal"}. Return the edited image.`
        : `Task: Auto-enhance, sharpen, and clear the image. Directive: ${prompt || "professional polish"}. Return the edited image.`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            { inlineData: { data: base64, mimeType: 'image/png' } },
            { text: instruction }
          ]
        }
      });

      if (!response.candidates?.[0]?.content?.parts) {
        throw new Error("No response content from studio engine.");
      }

      // Iterate through parts to find the image part as per guidelines.
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
      }
      throw new Error("No image data returned from model");
    });
  },

  // Fix: Added missing remedyVideo method to handle video reconstruction/editing via Veo.
  async remedyVideo(file: File, prompt: string) {
    return withRetry(async () => {
      const ai = getAI();
      // We use the Veo model to generate a clean version based on the descriptive prompt.
      const operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: `CINEMATIC REMEDY TASK: ${prompt}. Reconstruct sequence with full visual integrity, removing unwanted elements.`,
        config: {
          numberOfVideos: 1,
          resolution: '720p',
          aspectRatio: '16:9',
        }
      });
      return operation;
    });
  },

  // Fix: Added missing analyzeVideoForMontage method to process multiple video clips and return highlight metadata.
  async analyzeVideoForMontage(clips: { data: string, mimeType: string }[]) {
    return withRetry(async () => {
      const ai = getAI();
      const parts = clips.map(c => ({
        inlineData: { data: c.data, mimeType: c.mimeType }
      }));
      
      // Use gemini-3-pro-preview for advanced reasoning and video analysis.
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: { 
          parts: [
            ...parts,
            { text: "Analyze these video clips and identify cinematic highlights. Return a list of segments with start_timestamp, end_timestamp, and visual_description in JSON format." }
          ] as any
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                start_timestamp: { type: Type.STRING },
                end_timestamp: { type: Type.STRING },
                visual_description: { type: Type.STRING }
              },
              propertyOrdering: ["start_timestamp", "end_timestamp", "visual_description"]
            }
          }
        }
      });

      try {
        const jsonStr = response.text || "[]";
        return JSON.parse(jsonStr) as MontageSegment[];
      } catch (e) {
        console.error("Failed to parse montage analysis output", e);
        return [];
      }
    });
  },

  async pollOperation(operation: any, signal?: AbortSignal) {
    let currentOp = operation;
    while (!currentOp.done) {
      if (signal?.aborted) throw new Error("AbortError");
      await sleep(10000);
      currentOp = await withRetry(async () => {
        const ai = getAI();
        return await ai.operations.getVideosOperation({ operation: currentOp });
      });
    }
    if (currentOp.error) throw new Error(currentOp.error.message || 'Generation failed');
    return currentOp;
  }
};
