'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/livekit/button';

interface VoiceCloningModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVoiceCloned: (voiceId: string) => void;
}

export function VoiceCloningModal({ isOpen, onClose, onVoiceCloned }: VoiceCloningModalProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voiceName, setVoiceName] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      setError(null);
      audioChunksRef.current = [];
      setAudioBlob(null);
      setRecordingTime(0);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        stream.getTracks().forEach((track) => track.stop());
        if (timerRef.current) clearInterval(timerRef.current);
      };

      mediaRecorder.start();
      setIsRecording(true);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          const newTime = prev + 1;
          // Auto-stop at 10 seconds
          if (newTime >= 10 && mediaRecorderRef.current?.state === 'recording') {
            stopRecording();
          }
          return newTime;
        });
      }, 1000);
    } catch (err) {
      setError('Failed to access microphone. Please check permissions.');
      console.error('Recording error:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const handleUpload = async () => {
    if (!audioBlob || !voiceName.trim()) {
      setError('Please provide a voice name and record audio');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'voice-sample.webm');
      formData.append('name', voiceName.trim());
      formData.append('language', 'en');
      formData.append('mode', 'similarity');

      const response = await fetch('/api/clone-voice', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to clone voice');
      }

      const data = await response.json();
      onVoiceCloned(data.voiceId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clone voice');
      console.error('Upload error:', err);
    } finally {
      setIsUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background border-border w-full max-w-md rounded-lg border p-6 shadow-lg">
        <h2 className="text-foreground mb-4 text-xl font-semibold">Clone Your Voice</h2>

        <p className="text-muted-foreground mb-4 text-sm">
          Record 3-10 seconds of clear audio in a quiet environment for best results.
        </p>

        {/* Voice Name Input */}
        <div className="mb-4">
          <label htmlFor="voiceName" className="text-foreground mb-2 block text-sm font-medium">
            Voice Name
          </label>
          <input
            id="voiceName"
            type="text"
            value={voiceName}
            onChange={(e) => setVoiceName(e.target.value)}
            placeholder="My Custom Voice"
            className="bg-input border-border text-foreground placeholder:text-muted-foreground w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isUploading}
          />
        </div>

        {/* Recording Controls */}
        <div className="mb-4 flex flex-col items-center space-y-3">
          {isRecording && (
            <div className="text-foreground text-2xl font-mono">
              {recordingTime}s / 10s
            </div>
          )}

          {audioBlob && !isRecording && (
            <div className="text-muted-foreground flex items-center space-x-2 text-sm">
              <span>✓ Recording complete ({recordingTime}s)</span>
            </div>
          )}

          <div className="flex space-x-3">
            {!isRecording && !audioBlob && (
              <Button onClick={startRecording} variant="primary" size="md" disabled={isUploading}>
                Start Recording
              </Button>
            )}

            {isRecording && (
              <Button onClick={stopRecording} variant="destructive" size="md">
                Stop Recording
              </Button>
            )}

            {audioBlob && !isRecording && (
              <Button
                onClick={startRecording}
                variant="secondary"
                size="md"
                disabled={isUploading}
              >
                Re-record
              </Button>
            )}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 rounded-md bg-red-500/10 p-3 text-sm text-red-500">{error}</div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3">
          <Button onClick={onClose} variant="secondary" size="md" disabled={isUploading}>
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            variant="primary"
            size="md"
            disabled={!audioBlob || !voiceName.trim() || isUploading}
          >
            {isUploading ? 'Cloning...' : 'Clone Voice'}
          </Button>
        </div>
      </div>
    </div>
  );
}
