// OPTIONAL: Enhanced call-active.tsx with FREE Voice AI
// This adds browser-based voice AI (completely free, no API needed)
// Replace src/modules/call/ui/components/call-active.tsx with this file

import { 
    CallControls, 
    CallParticipantsList, 
    CallStatsButton, 
    PaginatedGridLayout, 
    SpeakerLayout, 
    useCallStateHooks 
} from "@stream-io/video-react-sdk";
import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff } from "lucide-react";

interface Props {
    onLeave: () => void;
    meetingName: string;
}

export const CallActive = ({ onLeave, meetingName }: Props) => {
    const { useParticipants } = useCallStateHooks();
    const participants = useParticipants();
    const [layout, setLayout] = useState<"speaker" | "grid">("speaker");
    
    // Free Voice AI State
    const [isAIListening, setIsAIListening] = useState(false);
    const [aiResponse, setAiResponse] = useState("");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognitionRef = useRef<any>(null);
    const lastRequestTime = useRef<number>(0);
    const MIN_REQUEST_INTERVAL = 3000; // 3 seconds between requests

    // Process speech with Free AI (replace with your chosen AI)
    const processWithFreeAI = useCallback(async (text: string) => {
        try {
            // Rate limiting: Check if enough time has passed since last request
            const now = Date.now();
            const timeSinceLastRequest = now - lastRequestTime.current;
            
            if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
                const waitTime = Math.ceil((MIN_REQUEST_INTERVAL - timeSinceLastRequest) / 1000);
                console.log(`Rate limit: Please wait ${waitTime} seconds before next request`);
                setAiResponse(`Please wait ${waitTime} seconds...`);
                return;
            }
            
            console.log('Processing speech with AI:', text);
            lastRequestTime.current = now;
            
            // Example: Call your free AI endpoint
            // This would use Gemini or Groq from your backend
            const response = await fetch('/api/ai/process-speech', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('AI API error:', errorData);
                console.error('Full error details:', JSON.stringify(errorData, null, 2));
                
                // Special handling for quota errors
                if (response.status === 429 || errorData.error?.includes('quota')) {
                    setAiResponse('Quota limit reached. Please wait a moment before trying again.');
                } else {
                    setAiResponse(`Error: ${errorData.details || errorData.error || 'Failed to get AI response'}`);
                }
                return;
            }

            const data = await response.json();
            console.log('AI response received:', data.response);
            setAiResponse(data.response);

            // Speak response using free browser TTS
            if ('speechSynthesis' in window) {
                const utterance = new SpeechSynthesisUtterance(data.response);
                utterance.lang = 'en-US';
                utterance.rate = 1.0;
                utterance.pitch = 1.0;
                window.speechSynthesis.speak(utterance);
            }
        } catch (error) {
            console.error('AI processing error:', error);
            setAiResponse('Error: Failed to connect to AI service');
        }
    }, []);

    // Initialize Free Browser Speech Recognition
    useEffect(() => {
        if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const SpeechRecognitionAPI = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
            
            recognitionRef.current = new SpeechRecognitionAPI();
            recognitionRef.current.continuous = true;
            recognitionRef.current.interimResults = true;
            recognitionRef.current.lang = 'en-US';

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            recognitionRef.current.onresult = (event: any) => {
                const transcript = Array.from(event.results)
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    .map((result: any) => result[0])
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    .map((result: any) => result.transcript)
                    .join('');

                // Send to free AI for processing only when final (user finished speaking)
                // and only if the transcript is meaningful (more than 2 words)
                if (event.results[0].isFinal && transcript.trim().split(' ').length > 2) {
                    processWithFreeAI(transcript);
                }
            };

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            recognitionRef.current.onerror = (event: any) => {
                console.error('Speech recognition error:', event.error);
                setIsAIListening(false);
            };
        }

        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
        };
    }, [processWithFreeAI]);

    // Toggle AI Voice Assistant
    const toggleAIAssistant = () => {
        if (!recognitionRef.current) {
            alert('Speech recognition not supported in your browser');
            return;
        }

        if (isAIListening) {
            recognitionRef.current.stop();
            setIsAIListening(false);
        } else {
            recognitionRef.current.start();
            setIsAIListening(true);
        }
    };

    return (
        <div className="h-full flex flex-col">
            <div className="flex-1 overflow-hidden">
                {layout === "speaker" ? (
                    <SpeakerLayout participantsBarPosition="bottom" />
                ) : (
                    <PaginatedGridLayout />
                )}
            </div>

            {/* AI Response Display */}
            {aiResponse && (
                <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-black/80 text-white px-4 py-2 rounded-lg max-w-md">
                    <p className="text-sm">AI: {aiResponse}</p>
                </div>
            )}

            <div className="p-4 bg-background border-t flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <h2 className="font-semibold">{meetingName}</h2>
                    <span className="text-xs text-muted-foreground">
                        {participants.length} participant{participants.length !== 1 ? 's' : ''}
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    {/* Free AI Voice Assistant Toggle */}
                    <Button
                        variant={isAIListening ? "destructive" : "outline"}
                        size="sm"
                        onClick={toggleAIAssistant}
                        className="gap-2"
                    >
                        {isAIListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                        {isAIListening ? 'AI Listening...' : 'Enable AI Assistant'}
                    </Button>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setLayout(layout === "speaker" ? "grid" : "speaker")}
                    >
                        {layout === "speaker" ? "Grid" : "Speaker"} View
                    </Button>

                    <CallStatsButton />
                    <CallParticipantsList onClose={() => {}} />
                </div>

                <CallControls onLeave={onLeave} />
            </div>
        </div>
    );
};