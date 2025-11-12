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
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file type
    const validTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/webm', 'audio/ogg', 'audio/m4a'];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(mp3|wav|webm|ogg|m4a)$/i)) {
      setError('Please upload a valid audio file (MP3, WAV, WEBM, OGG, or M4A)');
      return;
    }

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB');
      return;
    }

    setAudioBlob(file);
    setUploadedFileName(file.name);
    setRecordingTime(0);
    setError(null);
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
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-background/95 backdrop-blur-md w-full max-w-sm rounded-xl p-5 shadow-2xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-foreground mb-2 text-sm font-mono uppercase tracking-wider font-medium">Clone Your Voice</h2>

        <p className="text-muted-foreground mb-4 text-xs font-mono leading-relaxed">
          Record 3-10 seconds of clear audio in a quiet environment.
        </p>

        {/* Voice Name Input */}
        <div className="mb-4">
          <label htmlFor="voiceName" className="text-foreground/70 mb-1.5 block text-xs font-mono uppercase tracking-wider">
            Voice Name
          </label>
          <input
            id="voiceName"
            type="text"
            value={voiceName}
            onChange={(e) => setVoiceName(e.target.value)}
            placeholder="My Custom Voice"
            className="bg-muted/50 border-input/50 text-foreground placeholder:text-muted-foreground/50 w-full rounded-lg border px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
            disabled={isUploading}
          />
        </div>

        {/* Recording Status */}
        <div className="mb-4 flex flex-col items-center">
          {isRecording && (
            <div className="text-foreground text-2xl font-mono font-bold animate-pulse">
              {recordingTime}s / 10s
            </div>
          )}

          {audioBlob && !isRecording && (
            <div className="text-foreground flex items-center gap-2 text-sm font-mono">
              <span className="text-primary">✓</span>
              <span>
                {uploadedFileName 
                  ? `File uploaded: ${uploadedFileName.substring(0, 20)}${uploadedFileName.length > 20 ? '...' : ''}`
                  : `Recording complete (${recordingTime}s)`
                }
              </span>
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 rounded-lg bg-red-500/10 p-2 text-red-500 text-xs font-mono">{error}</div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col gap-2">
          {!isRecording && !audioBlob && (
            <>
              <Button onClick={startRecording} variant="primary" size="default" disabled={isUploading} className="w-full font-mono text-[11px]">
                Start Recording
              </Button>
              <div className="flex items-center gap-2 my-1">
                <div className="flex-1 h-px bg-foreground/10"></div>
                <span className="text-foreground/40 text-[10px] font-mono uppercase">or</span>
                <div className="flex-1 h-px bg-foreground/10"></div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*,.mp3,.wav,.webm,.ogg,.m4a"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                size="default"
                disabled={isUploading}
                className="w-full font-mono text-[11px]"
              >
                Upload Audio File
              </Button>
            </>
          )}

          {isRecording && (
            <Button onClick={stopRecording} variant="destructive" size="default" className="w-full font-mono text-[11px]">
              Stop Recording
            </Button>
          )}

          {audioBlob && !isRecording && (
            <>
              <Button
                onClick={handleUpload}
                variant="primary"
                size="default"
                disabled={!voiceName.trim() || isUploading}
                className="w-full font-mono text-[11px]"
              >
                {isUploading ? 'Cloning...' : 'Clone Voice'}
              </Button>
              <div className="flex gap-2">
                <Button
                  onClick={startRecording}
                  variant="outline"
                  size="sm"
                  disabled={isUploading}
                  className="flex-1 font-mono text-[10px]"
                >
                  Re-record
                </Button>
                <Button
                  onClick={() => {
                    setAudioBlob(null);
                    setUploadedFileName(null);
                    setRecordingTime(0);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  variant="outline"
                  size="sm"
                  disabled={isUploading}
                  className="flex-1 font-mono text-[10px]"
                >
                  Clear
                </Button>
              </div>
            </>
          )}
          
          <Button onClick={onClose} variant="ghost" size="sm" disabled={isUploading} className="w-full font-mono text-[10px]">
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
