'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/livekit/button';

interface Voice {
  id: string;
  name: string;
  isActive: boolean;
}

interface VoiceSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVoiceSelected: (voiceId: string) => void;
  onOpenCloning: () => void;
}

export function VoiceSelectionModal({
  isOpen,
  onClose,
  onVoiceSelected,
  onOpenCloning,
}: VoiceSelectionModalProps) {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadVoices();
    }
  }, [isOpen]);

  const loadVoices = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/voices');
      if (!response.ok) {
        throw new Error('Failed to load voices');
      }
      const data = await response.json();
      setVoices(data.voices || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load voices');
      console.error('Failed to load voices:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetActive = async (voiceId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/voices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'setActive', voiceId }),
      });

      if (!response.ok) {
        throw new Error('Failed to set active voice');
      }

      const data = await response.json();
      setVoices(data.voices || []);
      onVoiceSelected(voiceId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set active voice');
      console.error('Failed to set active voice:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-background/95 backdrop-blur-md w-full max-w-xs rounded-xl p-5 shadow-2xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-foreground mb-3 text-sm font-mono uppercase tracking-wider font-medium">Select Voice</h2>

        {/* Error Message */}
        {error && (
          <div className="mb-3 rounded-lg bg-red-500/10 p-2 text-red-500 text-xs font-mono">{error}</div>
        )}

        {/* Loading State */}
        {isLoading && voices.length === 0 && (
          <div className="text-muted-foreground flex justify-center py-6">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
          </div>
        )}

        {/* Voice List */}
        {!isLoading && voices.length === 0 && (
          <div className="text-muted-foreground text-center py-6 text-xs font-mono">
            <p>No voices cloned yet.</p>
          </div>
        )}

        {voices.length > 0 && (
          <div className="mb-3 space-y-2">
            {voices.map((voice) => (
              <button
                key={voice.id}
                onClick={() => !voice.isActive && handleSetActive(voice.id)}
                disabled={isLoading}
                className={`
                  w-full text-left px-3 py-2.5 rounded-full transition-all duration-200 font-mono text-xs uppercase tracking-wider
                  ${
                    voice.isActive
                      ? 'bg-primary text-primary-foreground font-bold'
                      : 'bg-foreground/15 text-foreground/70 hover:bg-foreground/20 hover:text-foreground cursor-pointer'
                  }
                  ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              >
                <div className="flex items-center justify-between">
                  <span>{voice.name}</span>
                  {voice.isActive && (
                    <span className="text-[10px] opacity-70">✓</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col gap-2 mt-4">
          <Button
            onClick={() => {
              onClose();
              onOpenCloning();
            }}
            variant="outline"
            size="sm"
            disabled={isLoading}
            className="w-full font-mono text-[10px]"
          >
            + Clone New Voice
          </Button>
          <Button
            onClick={onClose}
            variant="ghost"
            size="sm"
            disabled={isLoading}
            className="w-full font-mono text-[10px]"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
