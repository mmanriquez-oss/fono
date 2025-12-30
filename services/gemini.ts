
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { AnalysisResult, WordResult } from "../types";

const MODEL_NAME = 'gemini-3-flash-preview';
const TTS_MODEL = 'gemini-2.5-flash-preview-tts';
const IMAGE_MODEL = 'gemini-2.5-flash-image';

export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  }

  async generateImage(word: string): Promise<string> {
    const response = await this.ai.models.generateContent({
      model: IMAGE_MODEL,
      contents: {
        parts: [
          {
            text: `A simple, extremely cute, colorful, kid-friendly 3D clay-style illustration of a "${word}" isolated on a soft pastel background. Bright lighting, high quality, appealing to a 6-year-old child.`,
          },
        ],
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("No se pudo pintar la imagen mágica.");
  }

  async generatePhonologicalReport(history: WordResult[]): Promise<string> {
    const historyData = history.map(h => ({
      word: h.word.text,
      score: h.analysis.score,
      errors: h.analysis.errors.map(e => e.part + ": " + e.issue)
    }));

    const response = await this.ai.models.generateContent({
      model: MODEL_NAME,
      contents: [
        {
          text: `Actúa como una Logopeda Experta (Hada de los Sonidos). 
          Basado en este historial de práctica de un niño: ${JSON.stringify(historyData)}.
          Genera un "Informe Fonológico Mágico" que resuma fortalezas y patrones detectados de forma motivadora y dulce.`
        }
      ]
    });

    return response.text || "Tu informe se perdió en el bosque mágico.";
  }

  async analyzePronunciation(targetText: string, audioBase64: string, mimeType: string): Promise<AnalysisResult> {
    const response = await this.ai.models.generateContent({
      model: MODEL_NAME,
      contents: [
        {
          parts: [
            { inlineData: { data: audioBase64, mimeType: mimeType } },
            { text: `Analiza la pronunciación de "${targetText}" letra por letra de forma extremadamente exigente para una niña pequeña. Tu tono es el de una maestra hada exigente. Responde en JSON.` }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.NUMBER },
            feedback: { type: Type.STRING },
            transcription: { type: Type.STRING },
            errors: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  part: { type: Type.STRING },
                  issue: { type: Type.STRING },
                  suggestion: { type: Type.STRING }
                },
                required: ["part", "issue", "suggestion"]
              }
            },
            improvementTips: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["score", "feedback", "errors", "improvementTips", "transcription"]
        }
      }
    });

    return JSON.parse(response.text.trim());
  }

  async playReferenceAudio(text: string): Promise<void> {
    const response = await this.ai.models.generateContent({
      model: TTS_MODEL,
      contents: [{ parts: [{ text: `Pronuncia "${text}" con claridad perfecta y voz amigable de mujer latina.` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } }
      }
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const audioData = this.decodeBase64(base64Audio);
      const audioBuffer = await this.decodeAudioData(audioData, audioContext, 24000, 1);
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      source.start();
    }
  }

  private decodeBase64(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
    return bytes;
  }

  private async decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
    return buffer;
  }
}
