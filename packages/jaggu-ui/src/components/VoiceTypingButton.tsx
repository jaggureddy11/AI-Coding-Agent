import React, { useState, useEffect, useRef } from 'react';

export interface VoiceTypingButtonProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

// Typing definitions for Web Speech API
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognitionResultItem {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResultList;
  [index: number]: {
    isFinal: boolean;
    [index: number]: SpeechRecognitionResultItem;
  };
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  onresult: ((this: SpeechRecognitionInstance, ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((this: SpeechRecognitionInstance, ev: SpeechRecognitionErrorEvent) => void) | null;
  onend: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }
}

export const VoiceTypingButton: React.FC<VoiceTypingButtonProps> = ({
  onTranscript,
  disabled = false,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  useEffect(() => {
    // Check speech recognition support safely (handles SSR)
    if (typeof window !== 'undefined') {
      const SpeechRecognitionClass =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognitionClass) {
        setIsSupported(false);
      }
    }
  }, []);

  const startListening = () => {
    if (typeof window === 'undefined') return;

    const SpeechRecognitionClass =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      setIsSupported(false);
      setErrorMessage('Speech recognition is not available in this environment');
      setTimeout(() => setErrorMessage(null), 3500);
      return;
    }

    try {
      const recognition = new SpeechRecognitionClass();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        setErrorMessage(null);
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const result = event.results[i];
          if (result && result.isFinal && result[0]) {
            finalTranscript += result[0].transcript;
          }
        }
        if (finalTranscript.trim()) {
          onTranscript(finalTranscript.trim());
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        // Ignore aborted errors when user manually stops
        if (event.error === 'aborted') {
          setIsListening(false);
          return;
        }
        setIsListening(false);
        if (event.error === 'not-allowed') {
          setErrorMessage('Microphone access denied. Grant permission to use voice typing.');
        } else if (event.error === 'no-speech') {
          // No speech detected, keep listening or quiet stop
        } else {
          setErrorMessage(`Voice error: ${event.error}`);
        }
        setTimeout(() => setErrorMessage(null), 4000);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: unknown) {
      setIsListening(false);
      const msg = err instanceof Error ? err.message : 'Failed to initialize voice recognition';
      setErrorMessage(msg);
      setTimeout(() => setErrorMessage(null), 4000);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore stop failures if already closed
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
  };

  const toggleListening = (e: React.MouseEvent) => {
    e.preventDefault();
    if (disabled) return;

    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <button
        type="button"
        data-testid="voice-typing-btn"
        onClick={toggleListening}
        disabled={disabled}
        title={
          isListening
            ? 'Listening... Click to stop voice dictation'
            : isSupported
            ? 'Voice typing: Dictate your coding task'
            : 'Voice typing not supported in this webview'
        }
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          padding: '5px 8px',
          borderRadius: '6px',
          border: isListening
            ? '1px solid rgba(239, 68, 68, 0.6)'
            : '1px solid rgba(255, 255, 255, 0.1)',
          backgroundColor: isListening
            ? 'rgba(239, 68, 68, 0.2)'
            : 'rgba(255, 255, 255, 0.05)',
          color: isListening ? '#f87171' : 'var(--vscode-foreground, #cccccc)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          fontSize: '11px',
          transition: 'all 0.18s ease',
          boxShadow: isListening
            ? '0 0 12px rgba(239, 68, 68, 0.35)'
            : 'none',
        }}
      >
        {/* Microphone SVG Icon */}
        <svg
          viewBox="0 0 24 24"
          width="14"
          height="14"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            animation: isListening ? 'pulse 1.2s infinite' : 'none',
          }}
        >
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="22" />
        </svg>

        {isListening && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
            <span style={{ fontSize: '10px', fontWeight: 600, color: '#fca5a5' }}>
              Listening
            </span>
            {/* Animated Audio Wave bars */}
            <span
              style={{
                display: 'inline-block',
                width: '2px',
                height: '8px',
                backgroundColor: '#f87171',
                animation: 'pulse 0.6s infinite alternate',
              }}
            />
            <span
              style={{
                display: 'inline-block',
                width: '2px',
                height: '12px',
                backgroundColor: '#f87171',
                animation: 'pulse 0.8s infinite 0.2s alternate',
              }}
            />
            <span
              style={{
                display: 'inline-block',
                width: '2px',
                height: '6px',
                backgroundColor: '#f87171',
                animation: 'pulse 0.5s infinite 0.4s alternate',
              }}
            />
          </span>
        )}
      </button>

      {/* Floating error hint if speech recognition fails or permissions denied */}
      {errorMessage && (
        <div
          style={{
            position: 'absolute',
            bottom: '100%',
            right: 0,
            marginBottom: '6px',
            padding: '6px 10px',
            borderRadius: '6px',
            backgroundColor: '#1f1315',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            color: '#fca5a5',
            fontSize: '11px',
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
            zIndex: 100,
          }}
        >
          {errorMessage}
        </div>
      )}
    </div>
  );
};
