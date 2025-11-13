'use client';

import { useRef, useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useRoomContext } from '@livekit/components-react';
import { useSession } from '@/components/app/session-provider';
import { SessionView } from '@/components/app/session-view';
import { WelcomeView } from '@/components/app/welcome-view';
import { VoiceCloningModal } from '@/components/app/voice-cloning-modal';
import { VoiceSelectionModal } from '@/components/app/voice-selection-modal';
import { SystemPromptModal } from '@/components/app/system-prompt-modal';

const MotionWelcomeView = motion.create(WelcomeView);
const MotionSessionView = motion.create(SessionView);

const VIEW_MOTION_PROPS = {
  variants: {
    visible: {
      opacity: 1,
    },
    hidden: {
      opacity: 0,
    },
  },
  initial: 'hidden',
  animate: 'visible',
  exit: 'hidden',
  transition: {
    duration: 0.5,
    ease: 'linear',
  },
};

export function ViewController() {
  const room = useRoomContext();
  const isSessionActiveRef = useRef(false);
  const { appConfig, isSessionActive, startSession } = useSession();
  const [isVoiceCloningModalOpen, setIsVoiceCloningModalOpen] = useState(false);
  const [isVoiceSelectionModalOpen, setIsVoiceSelectionModalOpen] = useState(false);
  const [isSystemPromptModalOpen, setIsSystemPromptModalOpen] = useState(false);
  const [customVoiceId, setCustomVoiceId] = useState<string | null>(null);
  const [activePromptId, setActivePromptId] = useState<string | null>(null);
  const [activePromptName, setActivePromptName] = useState<string | null>(null);

  // Load active voice and system prompt on mount
  useEffect(() => {
    loadActiveVoice();
    loadActivePrompt();
  }, []);

  const loadActiveVoice = async () => {
    try {
      const response = await fetch('/api/voices');
      if (!response.ok) return;
      
      const data = await response.json();
      const activeVoice = data.voices?.find((v: any) => v.isActive);
      if (activeVoice) {
        setCustomVoiceId(activeVoice.id);
      }
    } catch (error) {
      console.error('Failed to load active voice:', error);
    }
  };

  const loadActivePrompt = async () => {
    try {
      const response = await fetch('/api/system-prompts');
      if (!response.ok) return;
      
      const data = await response.json();
      const activePrompt = data.prompts?.find((p: any) => p.isActive);
      if (activePrompt) {
        setActivePromptId(activePrompt.id);
        setActivePromptName(activePrompt.name);
      }
    } catch (error) {
      console.error('Failed to load active prompt:', error);
    }
  };

  // animation handler holds a reference to stale isSessionActive value
  isSessionActiveRef.current = isSessionActive;

  // disconnect room after animation completes
  const handleAnimationComplete = () => {
    if (!isSessionActiveRef.current && room.state !== 'disconnected') {
      room.disconnect();
    }
  };

  const handleVoiceCloned = (voiceId: string) => {
    setCustomVoiceId(voiceId);
    setIsVoiceCloningModalOpen(false);
  };

  const handleVoiceSelected = (voiceId: string) => {
    setCustomVoiceId(voiceId);
  };

  const handlePromptSelected = (promptId: string, promptName: string) => {
    setActivePromptId(promptId);
    setActivePromptName(promptName);
  };

  const handleStartCall = () => {
    startSession(customVoiceId || undefined);
  };

  const handleOpenVoiceSelection = () => {
    setIsVoiceSelectionModalOpen(true);
  };

  const handleOpenSystemPromptModal = () => {
    setIsSystemPromptModalOpen(true);
  };

  return (
    <>
      <AnimatePresence mode="wait">
        {/* Welcome screen */}
        {!isSessionActive && (
          <MotionWelcomeView
            key="welcome"
            {...VIEW_MOTION_PROPS}
            startButtonText={appConfig.startButtonText}
            onStartCall={handleStartCall}
            onOpenVoiceCloning={() => setIsVoiceCloningModalOpen(true)}
            onOpenVoiceSelection={handleOpenVoiceSelection}
            onOpenSystemPromptModal={handleOpenSystemPromptModal}
            hasCustomVoice={!!customVoiceId}
            activePromptName={activePromptName}
          />
        )}
        {/* Session view */}
        {isSessionActive && (
          <MotionSessionView
            key="session-view"
            {...VIEW_MOTION_PROPS}
            appConfig={appConfig}
            onAnimationComplete={handleAnimationComplete}
          />
        )}
      </AnimatePresence>

      {/* Voice Cloning Modal */}
      <VoiceCloningModal
        isOpen={isVoiceCloningModalOpen}
        onClose={() => setIsVoiceCloningModalOpen(false)}
        onVoiceCloned={handleVoiceCloned}
      />

      {/* Voice Selection Modal */}
      <VoiceSelectionModal
        isOpen={isVoiceSelectionModalOpen}
        onClose={() => setIsVoiceSelectionModalOpen(false)}
        onVoiceSelected={handleVoiceSelected}
        onOpenCloning={() => {
          setIsVoiceSelectionModalOpen(false);
          setIsVoiceCloningModalOpen(true);
        }}
      />

      {/* System Prompt Modal */}
      <SystemPromptModal
        isOpen={isSystemPromptModalOpen}
        onClose={() => setIsSystemPromptModalOpen(false)}
        onPromptSelected={handlePromptSelected}
      />
    </>
  );
}
