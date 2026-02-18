export type AppTab = 'generate' | 'logo';

export interface MediaFile {
  id: string;
  file: File;
  previewUrl: string;
}

export interface EnhancementConfig {
  mode: 'auto' | 'prompt' | 'remedy';
  prompt?: string;
}

export interface VideoGenConfig {
  prompt: string;
  style: 'Realistic' | 'Cinematic' | 'Animation' | 'Cyberpunk' | 'Vintage';
  orientation: '16:9' | '9:16';
  resolution: '720p' | '1080p';
}

export interface ProcessingState {
  isProcessing: boolean;
  message: string;
  progress?: number;
}