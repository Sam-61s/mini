// OPTIONAL: Free AI Voice Processing Endpoint
// Create this file at: src/app/api/ai/process-speech/route.ts
// This processes voice input using your chosen free AI

import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

// Initialize your chosen free AI - let it use default API version
const genAI = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY || ""
  // Don't specify apiVersion - let the SDK use the default
});

export async function POST(req: NextRequest) {
  try {
    // Check if API key is configured
    if (!process.env.GEMINI_API_KEY) {
      console.error("GEMINI_API_KEY is not configured");
      return NextResponse.json(
        { error: "AI service not configured. Please set GEMINI_API_KEY in environment variables." },
        { status: 500 }
      );
    }

    const { text } = await req.json();

    if (!text) {
      return NextResponse.json(
        { error: "No text provided" },
        { status: 400 }
      );
    }

    const systemContext = `You are a helpful AI assistant in a video call. 
Keep responses very brief and conversational (1-2 sentences max). 
Be friendly and helpful. Respond naturally as if speaking to someone.`;

    const prompt = `${systemContext}\n\nUser said: "${text}"\n\nYour response:`;

    // Process with Free AI (Gemini)
    const result = await genAI.models.generateContent({
      model: "gemini-2.0-flash-exp", // Using experimental model (available in default API)
      contents: prompt,
      config: {
        temperature: 0.9,
        maxOutputTokens: 150, // Keep responses concise for voice
      }
    });

    const aiResponse = result.text || "Sorry, I couldn't process that.";

    return NextResponse.json({ 
      response: aiResponse,
      success: true 
    });

  } catch (error) {
    console.error("AI processing error:", error);
    // Log more details about the error
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }
    
    // Check if it's a quota error
    const errorStr = String(error);
    if (errorStr.includes("quota") || errorStr.includes("RESOURCE_EXHAUSTED")) {
      return NextResponse.json(
        { 
          error: "API quota exceeded. Please check your Gemini API key at https://aistudio.google.com/app/apikey or wait a moment and try again.",
          details: "Quota limit reached"
        },
        { status: 429 }
      );
    }
    
    return NextResponse.json(
      { 
        error: "Failed to process with AI", 
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}