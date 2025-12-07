// MODIFIED VERSION - Uses Google Gemini API (FREE) instead of OpenAI
// This version uses Gemini which is already installed in your project

import { db } from "@/db";
import { agents, meetings, user } from "@/db/schema";
import { inngest } from "@/inngest/client";
import { StreamTranscriptItem } from "@/modules/meetings/types";
import { eq, inArray } from "drizzle-orm";
import JSONL from "jsonl-parse-stringify"
import { GoogleGenAI } from "@google/genai";

// Initialize Google Gemini AI with free API key
const genAI = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY || ""
  // Don't specify apiVersion - let the SDK use the default
});

// Helper function to summarize using Gemini
async function summarizeWithGemini(transcript: string): Promise<string> {
  const systemPrompt = `
You are an expert summarizer. You write readable, concise, simple content. You are given a transcript of a meeting and you need to summarize it.

Use the following markdown structure for every output:

### Overview
Provide a detailed, engaging summary of the session's content. Focus on major features, user workflows, and any key takeaways. Write in a narrative style, using full sentences. Highlight unique or powerful aspects of the product, platform, or discussion.

### Notes
Break down key content into thematic sections with timestamp ranges. Each section should summarize key points, actions, or demos in bullet format.

Example:
#### Section Name
- Main point or demo shown here
- Another key insight or interaction
- Follow-up tool or explanation provided

#### Next Section
- Feature X automatically does Y
- Mention of integration with Z
  `.trim();

  const prompt = `${systemPrompt}\n\nTranscript to summarize:\n${transcript}`;

  try {
    const result = await genAI.models.generateContent({
      model: "gemini-2.0-flash-exp", // Using experimental model (available in default API)
      contents: prompt,
      config: {
        temperature: 0.7,
        maxOutputTokens: 2048,
      }
    });
    
    return result.text || "Summary generation failed";
  } catch (error) {
    console.error("Gemini API error:", error);
    throw new Error("Failed to generate summary with Gemini");
  }
}

export const meetingsProcessing = inngest.createFunction(
  { id: "meetings/processing" },
  {event: "meetings/processing" },
  async ({ event, step }) => {
    const response = await step.run("fetch-transcript", async() => {
      return fetch(event.data.transcriptUrl).then((res) => res.text());
    });

    const transcript = await step.run("parse-transcript", async () => {
      return JSONL.parse<StreamTranscriptItem>(response);
    });

    const transcirptWithSpeakers = await step.run("add-speakers", async() => {
      const speakerIds = [
        ...new Set(transcript.map((Item) => Item.speaker_id)),
      ];

      const userSpeakers = await db 
        .select()
        .from(user)
        .where(inArray(user.id, speakerIds))
        .then((users) => 
          users.map((user) => ({
            ...user,
          }))
        );

        const agentSpeakers = await db 
        .select()
        .from(agents)
        .where(inArray(agents.id, speakerIds))
        .then((agents) => 
          agents.map((agent) => ({
            ...agent,
          }))
        );

        const speakers = [...userSpeakers, ...agentSpeakers];

        return transcript.map((item) => {
          const speaker = speakers.find(
            (speaker) => speaker.id === item.speaker_id
          );

          if(!speaker) {
            return {
              ...item,
              user: {
                name: "Unknown",
              },
            };
          }

          return {
            ...item,
            user: {
              name: speaker.name,
            }
          }
        })
    });

    // Use Gemini instead of OpenAI for summarization
    const summary = await step.run("generate-summary", async () => {
      const transcriptText = JSON.stringify(transcirptWithSpeakers);
      return await summarizeWithGemini(transcriptText);
    });

    await step.run("save-summary", async() => {
      await db 
        .update(meetings)
        .set({
          summary: summary,
          status: "completed",
        })
        .where(eq(meetings.id, event.data.meetingId))
    })
  } ,
);