import React, { useState, useEffect, useRef } from 'react';

export interface VoiceTypingButtonProps {
  onTranscript: (text: string) => void;
  onListeningStateChange?: (isListening: boolean) => void;
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
  onListeningStateChange,
  disabled = false,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechClass = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechClass) {
        setIsSupported(false);
      }
    }
  }, []);

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
    onListeningStateChange?.(false);
  };

  const startListening = async () => {
    if (typeof window === 'undefined') return;

    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      setIsSupported(false);
      setErrorMessage('Speech recognition is not supported in this webview environment.');
      setTimeout(() => setErrorMessage(null), 3500);
      return;
    }

    // Explicitly prompt/verify microphone permissions if mediaDevices is available
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Immediately release tracks after permission verification
        stream.getTracks().forEach((track) => track.stop());
      } catch (micErr: unknown) {
        const name = (micErr as { name?: string })?.name;
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
          setErrorMessage('Microphone access denied. Grant permission in system settings.');
          setTimeout(() => setErrorMessage(null), 4000);
          return;
        }
      }
    }

    try {
      const recognition = new SpeechRecognitionClass();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        setErrorMessage(null);
        onListeningStateChange?.(true);
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let fullTranscript = '';
        for (let i = 0; i < event.results.length; ++i) {
          const result = event.results[i];
          if (result && result[0]) {
            fullTranscript += result[0].transcript;
          }
        }
        if (fullTranscript.trim()) {
          onTranscript(fullTranscript.trim());
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        if (event.error === 'aborted') {
          setIsListening(false);
          onListeningStateChange?.(false);
          return;
        }
        setIsListening(false);
        onListeningStateChange?.(false);

        if (event.error === 'not-allowed') {
          setErrorMessage('Microphone access denied. Please grant microphone permission.');
        } else if (event.error === 'no-speech') {
          // No speech detected, quietly finish
          return;
        } else if (event.error === 'network') {
          setErrorMessage('Speech service network unavailable. Type your task directly.');
        } else {
          setErrorMessage(`Speech recognition error: ${event.error}`);
        }
        setTimeout(() => setErrorMessage(null), 4000);
      };

      recognition.onend = () => {
        setIsListening(false);
        onListeningStateChange?.(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: unknown) {
      setIsListening(false);
      onListeningStateChange?.(false);
      const msg = err instanceof Error ? err.message : 'Failed to initialize voice typing';
      setErrorMessage(msg);
      setTimeout(() => setErrorMessage(null), 4000);
    }
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
              ? 'Voice typing: Dictate your task'
              : 'Voice typing not available in this webview'
        }
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '5px',
          padding: isListening ? '5px 10px' : '6px 8px',
          borderRadius: '6px',
          border: isListening
            ? '1px solid rgba(239, 68, 68, 0.6)'
            : '1px solid rgba(255, 255, 255, 0.1)',
          backgroundColor: isListening ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.05)',
          color: isListening ? '#f87171' : 'var(--vscode-foreground, #a1a1aa)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          fontSize: '11px',
          fontWeight: isListening ? 600 : 400,
          transition: 'all 0.18s ease',
          boxShadow: isListening ? '0 0 10px rgba(239, 68, 68, 0.35)' : 'none',
        }}
        onMouseEnter={(e) => {
          if (!disabled && !isListening) {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            e.currentTarget.style.color = 'var(--vscode-foreground, #ffffff)';
          }
        }}
        onMouseLeave={(e) => {
          if (!disabled && !isListening) {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
            e.currentTarget.style.color = 'var(--vscode-foreground, #a1a1aa)';
          }
        }}
      >
        {/* Microphone SVG Icon */}
        <svg
          viewBox="0 0 24 24"
          width="13"
          height="13"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="22" />
        </svg>

        {isListening && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
            <span style={{ fontSize: '10px', fontWeight: 600, color: '#fca5a5' }}>Listening</span>
            {/* Animated Audio Wave bars */}
            <span
              style={{
                display: 'inline-block',
                width: '2px',
                height: '8px',
                backgroundColor: '#f87171',
                borderRadius: '1px',
              }}
            />
            <span
              style={{
                display: 'inline-block',
                width: '2px',
                height: '11px',
                backgroundColor: '#f87171',
                borderRadius: '1px',
              }}
            />
            <span
              style={{
                display: 'inline-block',
                width: '2px',
                height: '6px',
                backgroundColor: '#f87171',
                borderRadius: '1px',
              }}
            />
          </span>
        )}
      </button>

      {/* Floating error notification if speech fails */}
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
