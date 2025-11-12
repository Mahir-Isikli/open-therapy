'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/livekit/button';

interface SystemPrompt {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  context: string;
  content: string;
}

interface SystemPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPromptSelected: (promptId: string) => void;
}

export function SystemPromptModal({
  isOpen,
  onClose,
  onPromptSelected,
}: SystemPromptModalProps) {
  const [prompts, setPrompts] = useState<SystemPrompt[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null);
  
  // Form state for adding/editing
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formContext, setFormContext] = useState('');
  const [formContent, setFormContent] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadPrompts();
    }
  }, [isOpen]);

  const loadPrompts = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/system-prompts');
      if (!response.ok) {
        throw new Error('Failed to load system prompts');
      }
      const data = await response.json();
      setPrompts(data.prompts || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load prompts');
      console.error('Failed to load prompts:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetActive = async (promptId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/system-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'setActive', promptId }),
      });

      if (!response.ok) {
        throw new Error('Failed to set active prompt');
      }

      const data = await response.json();
      setPrompts(data.prompts || []);
      onPromptSelected(promptId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set active prompt');
      console.error('Failed to set active prompt:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!formName.trim() || !formContent.trim()) {
      setError('Name and content are required');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/system-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add',
          name: formName,
          description: formDescription,
          context: formContext,
          content: formContent,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to add prompt');
      }

      const data = await response.json();
      setPrompts(data.prompts || []);
      
      // Reset form
      setFormName('');
      setFormDescription('');
      setFormContext('');
      setFormContent('');
      setIsAdding(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add prompt');
      console.error('Failed to add prompt:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingPromptId) {
      setError('No prompt selected for editing');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/system-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          promptId: editingPromptId,
          name: formName,
          description: formDescription,
          context: formContext,
          content: formContent,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update prompt');
      }

      const data = await response.json();
      setPrompts(data.prompts || []);
      
      // Reset form
      setFormName('');
      setFormDescription('');
      setFormContext('');
      setFormContent('');
      setEditingPromptId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update prompt');
      console.error('Failed to update prompt:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (prompt: SystemPrompt) => {
    setFormName(prompt.name);
    setFormDescription(prompt.description);
    setFormContext(prompt.context || '');
    setFormContent(prompt.content);
    setEditingPromptId(prompt.id);
    setIsAdding(false);
  };

  const handleEditContext = (prompt: SystemPrompt) => {
    setFormContext(prompt.context || '');
    setEditingPromptId(prompt.id);
    setFormName(prompt.name);
    setFormDescription(prompt.description);
    setFormContent(prompt.content);
    setIsAdding(false);
  };

  const handleCancelForm = () => {
    setFormName('');
    setFormDescription('');
    setFormContext('');
    setFormContent('');
    setIsAdding(false);
    setEditingPromptId(null);
    setError(null);
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-background/95 backdrop-blur-md w-full max-w-lg max-h-[80vh] rounded-xl p-5 shadow-2xl animate-in zoom-in-95 duration-200 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-foreground mb-3 text-sm font-mono uppercase tracking-wider font-medium">
          {isAdding ? 'Add System Prompt' : editingPromptId ? 'Edit System Prompt' : 'Select System Prompt'}
        </h2>

        {/* Error Message */}
        {error && (
          <div className="mb-3 rounded-lg bg-red-500/10 p-2 text-red-500 text-xs font-mono">{error}</div>
        )}

        {/* Add/Edit Form */}
        {(isAdding || editingPromptId) && (
          <div className="mb-4 space-y-3">
            <div>
              <label className="text-foreground/70 block mb-1 text-[10px] font-mono uppercase tracking-wider">
                Name
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g., Roleplay Helper"
                className="w-full px-3 py-2 rounded-lg bg-foreground/10 text-foreground text-xs font-mono placeholder:text-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary"
                disabled={isLoading}
              />
            </div>
            
            <div>
              <label className="text-foreground/70 block mb-1 text-[10px] font-mono uppercase tracking-wider">
                Description (Optional)
              </label>
              <input
                type="text"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Brief description of this mode"
                className="w-full px-3 py-2 rounded-lg bg-foreground/10 text-foreground text-xs font-mono placeholder:text-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary"
                disabled={isLoading}
              />
            </div>
            
            <div>
              <label className="text-foreground/70 block mb-1 text-[10px] font-mono uppercase tracking-wider">
                Additional Context (Optional)
              </label>
              <textarea
                value={formContext}
                onChange={(e) => setFormContext(e.target.value)}
                placeholder="E.g., 'You're roleplaying as my best friend John who's been distant lately because...' - This adds on top of the base mode"
                rows={3}
                className="w-full px-3 py-2 rounded-lg bg-foreground/10 text-foreground text-xs font-mono placeholder:text-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary resize-y"
                disabled={isLoading}
              />
              <p className="text-foreground/50 text-[9px] mt-1 font-mono">
                This context layers on top of the base system prompt below
              </p>
            </div>
            
            <div>
              <label className="text-foreground/70 block mb-1 text-[10px] font-mono uppercase tracking-wider">
                System Prompt {isAdding ? '' : '(Base)'}
              </label>
              <textarea
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                placeholder="Enter the full system prompt here..."
                rows={8}
                className="w-full px-3 py-2 rounded-lg bg-foreground/10 text-foreground text-xs font-mono placeholder:text-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary resize-y"
                disabled={isLoading}
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={editingPromptId ? handleUpdate : handleAdd}
                variant="primary"
                size="sm"
                disabled={isLoading || !formName.trim() || !formContent.trim()}
                className="flex-1 font-mono text-[10px]"
              >
                {editingPromptId ? 'Update' : 'Add'}
              </Button>
              <Button
                onClick={handleCancelForm}
                variant="ghost"
                size="sm"
                disabled={isLoading}
                className="flex-1 font-mono text-[10px]"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading && prompts.length === 0 && !isAdding && !editingPromptId && (
          <div className="text-muted-foreground flex justify-center py-6">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
          </div>
        )}

        {/* Prompt List */}
        {!isAdding && !editingPromptId && (
          <>
            {!isLoading && prompts.length === 0 && (
              <div className="text-muted-foreground text-center py-6 text-xs font-mono">
                <p>No system prompts configured yet.</p>
              </div>
            )}

            {prompts.length > 0 && (
              <div className="mb-3 space-y-2">
                {prompts.map((prompt) => (
                  <div
                    key={prompt.id}
                    className={`
                      w-full text-left px-3 py-2.5 rounded-lg transition-all duration-200
                      ${
                        prompt.isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-foreground/15 text-foreground/70'
                      }
                    `}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button
                        onClick={() => !prompt.isActive && handleSetActive(prompt.id)}
                        disabled={isLoading}
                        className="flex-1 text-left"
                      >
                        <div className="font-mono text-xs uppercase tracking-wider font-bold flex items-center gap-2">
                          {prompt.name}
                          {prompt.isActive && <span className="text-[10px] opacity-70">✓</span>}
                        </div>
                        {prompt.description && (
                          <div className="text-[10px] mt-0.5 opacity-70 font-mono">
                            {prompt.description}
                          </div>
                        )}
                      </button>
                      
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleEditContext(prompt)}
                          disabled={isLoading}
                          className="text-[10px] px-2 py-1 rounded hover:bg-foreground/10 transition-colors font-mono opacity-70 hover:opacity-100"
                          title="Add/edit context for this mode"
                        >
                          {prompt.context ? '✎ Context' : '+ Context'}
                        </button>
                        <button
                          onClick={() => handleEdit(prompt)}
                          disabled={isLoading}
                          className="text-[10px] px-2 py-1 rounded hover:bg-foreground/10 transition-colors font-mono opacity-70 hover:opacity-100"
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col gap-2 mt-4">
              <Button
                onClick={() => {
                  // Find the roleplay base template
                  const roleplayBase = prompts.find((p) => p.id.startsWith('roleplay'));
                  if (roleplayBase) {
                    // Pre-fill with roleplay base
                    setFormName('');
                    setFormDescription('Practice difficult conversations');
                    setFormContext('');
                    setFormContent(roleplayBase.content);
                  }
                  setIsAdding(true);
                }}
                variant="outline"
                size="sm"
                disabled={isLoading}
                className="w-full font-mono text-[10px]"
              >
                + Add New Roleplay
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
          </>
        )}
      </div>
    </div>
  );
}
