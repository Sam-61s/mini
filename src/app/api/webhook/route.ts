// MODIFIED VERSION - Replace src/app/api/webhook/route.ts with this
// Note: OpenAI Realtime API doesn't have a direct free replacement
// This file shows alternatives for voice AI interaction

import { db } from "@/db";
import { agents, meetings } from "@/db/schema";
import { streamVideo } from "@/lib/stream-video";
import type { CallEndedEvent, CallRecordingReadyEvent, CallSessionParticipantLeftEvent, CallSessionStartedEvent, CallTranscriptionReadyEvent } from "@stream-io/video-react-sdk";
import { and, eq, not } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { inngest } from "@/inngest/client";

function verifySignatureWithSDK(body: string, signature: string): boolean {
    return streamVideo.verifyWebhook(body, signature);
}

export async function POST(req: NextRequest) {
    const signature = req.headers.get("x-signature");
    const apiKey = req.headers.get("x-api-key");

    if(!signature || !apiKey) {
        return NextResponse.json(
            { error: "Missing signature or API key" },
            { status: 400 }
        );
    }

    const body = await req.text();

    if(!verifySignatureWithSDK(body, signature)) {
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    let payload: unknown;
    try {
        payload = JSON.parse(body) as Record<string, unknown>;
    } catch {
        return NextResponse.json({ error: "Invalid JSON "}, { status: 400 });
    }

    const eventType = (payload as Record<string, unknown>)?.type;

    if(eventType === "call.session_started") {
        const event = payload as CallSessionStartedEvent;
        const meetingId = event.call.custom?.meetingId;

        if(!meetingId) {
            return NextResponse.json({ error: "Missing meetingId" }, { status: 400 });
        }

        const [existingMeeting] = await db
            .select()
            .from(meetings)
            .where(
                and(
                    eq(meetings.id, meetingId),
                    not(eq(meetings.status, "completed")),
                    not(eq(meetings.status, "active")),
                    not(eq(meetings.status, "cancelled")),
                    not(eq(meetings.status, "processing")),
                )
            );

        if(!existingMeeting) {
            return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
        }

        await db    
            .update(meetings)
            .set({
                status: "active",
                startedAt: new Date(),
            })
            .where(eq(meetings.id, existingMeeting.id));

        const [existingAgent] = await db
            .select()
            .from(agents)
            .where(eq(agents.id, existingMeeting.agentId));

        if(!existingAgent) {
            return NextResponse.json({ error: "Agent not found"}, { status: 404 });
        }

        // ALTERNATIVE APPROACH: Free Text-to-Speech for AI Voice
        // Since OpenAI Realtime API is paid, here are free alternatives:
        
        // Option A: Use browser's Web Speech API (client-side, completely free)
        // This can be implemented in the frontend call component
        
        // Option B: Use Google Cloud Text-to-Speech free tier
        // 1 million characters/month free
        // https://cloud.google.com/text-to-speech/pricing
        
        // Option C: Use ElevenLabs free tier
        // 10,000 characters/month free
        
        // Option D: Use Coqui TTS (open source, self-hosted, completely free)
        // https://github.com/coqui-ai/TTS

        // For now, we'll skip the realtime AI connection
        // The transcription and summarization will still work with free AI
        console.log("Call started. Real-time AI voice disabled (using free alternatives)");
        console.log("Agent instructions:", existingAgent.instructions);

        // You can implement custom voice response logic here
        // For example, use Google TTS + Gemini for responses

    } else if(eventType === "call.session_participant_left") {
        const event = payload as CallSessionParticipantLeftEvent;
        const meetingId = event.call_cid.split(":")[1];

        if(!meetingId) {
            return NextResponse.json({ error: "Missing meetingId "}, { status: 400 });
        }

        const call = streamVideo.video.call("default", meetingId);
        await call.end();
    } else if(eventType === "call.session_ended") {
        const event = payload as CallEndedEvent;
        const meetingId = event.call.custom?.meetingId;

        if(!meetingId) {
            return NextResponse.json({ error: "Missing meetingId" }, { status: 400 });
        }

        await db 
            .update(meetings)
            .set({
                status: "processing",
                endedAt: new Date(),
            })
            .where(and(eq(meetings.id, meetingId), eq(meetings.status, "active")));
    } else if(eventType === "call.transcription_ready") {
        const event = payload as CallTranscriptionReadyEvent;
        const meetingId = event.call_cid.split(":")[1];

        const [updateMeeting] = await db 
            .update(meetings)
            .set({
                transcriptUrl: event.call_transcription.url,
            })
            .where(eq(meetings.id, meetingId))
            .returning();

           // Trigger background job to summarize transcript with FREE AI
           if(!updateMeeting) {
            return NextResponse.json({ error: "Meeting not found " }, { status: 400 });
           }

           await inngest.send({
            name: "meetings/processing",
            data: {
                meetingId: updateMeeting.id,
                transcriptUrl: updateMeeting.transcriptUrl,
            }
           })
    } else if(eventType === "call.recording_ready") {
        const event = payload as CallRecordingReadyEvent;
        const meetingId = event.call_cid.split(":")[1];

       await db 
            .update(meetings)
            .set({
                recordingUrl: event.call_recording.url,
            })
            .where(and(eq(meetings.id, meetingId)));
    }

    return NextResponse.json({ status: "ok" });
};