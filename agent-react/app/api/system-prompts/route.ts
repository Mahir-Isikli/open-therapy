import { NextResponse } from 'next/server';

interface SystemPrompt {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  context: string;
  content: string;
}

interface SystemPromptConfig {
  prompts: SystemPrompt[];
}

const getConfigPath = async () => {
  const path = await import('path');
  return path.join(process.cwd(), '..', 'agent-python', 'system_prompt_config.json');
};

const readConfig = async (): Promise<SystemPromptConfig> => {
  try {
    const fs = await import('fs/promises');
    const configPath = await getConfigPath();
    const data = await fs.readFile(configPath, 'utf-8');
    const parsed = JSON.parse(data);
    return parsed.prompts ? parsed : { prompts: [] };
  } catch (error) {
    console.error('[SYSTEM_PROMPTS] Failed to read config:', error);
    return { prompts: [] };
  }
};

const writeConfig = async (config: SystemPromptConfig): Promise<void> => {
  const fs = await import('fs/promises');
  const configPath = await getConfigPath();
  await fs.writeFile(configPath, JSON.stringify(config, null, 2));
};

// GET - List all system prompts
export async function GET() {
  try {
    const config = await readConfig();
    return NextResponse.json({ prompts: config.prompts });
  } catch (error) {
    console.error('[SYSTEM_PROMPTS] Failed to read prompts:', error);
    return NextResponse.json({ error: 'Failed to read prompts' }, { status: 500 });
  }
}

// POST - Set active prompt, add new prompt, update prompt, or delete prompt
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action } = body;

    if (!action) {
      return NextResponse.json({ error: 'action is required' }, { status: 400 });
    }

    const config = await readConfig();

    if (action === 'setActive') {
      const { promptId } = body;
      if (!promptId) {
        return NextResponse.json({ error: 'promptId is required' }, { status: 400 });
      }

      // Deactivate all prompts
      config.prompts.forEach((prompt) => (prompt.isActive = false));

      // Activate the selected prompt
      const targetPrompt = config.prompts.find((p) => p.id === promptId);
      if (!targetPrompt) {
        return NextResponse.json({ error: 'Prompt not found' }, { status: 404 });
      }
      targetPrompt.isActive = true;

      await writeConfig(config);
      console.log('[SYSTEM_PROMPTS] Set active prompt:', promptId);

      return NextResponse.json({ success: true, prompts: config.prompts });
    } else if (action === 'add') {
      const { name, description, content, context } = body;
      if (!name || !content) {
        return NextResponse.json({ error: 'name and content are required' }, { status: 400 });
      }

      // Generate ID with roleplay- prefix
      const baseName = name.toLowerCase().replace(/\s+/g, '-');
      const id = `roleplay-${baseName}`;

      // Check if ID already exists
      if (config.prompts.some((p) => p.id === id)) {
        return NextResponse.json({ error: 'A roleplay with this name already exists' }, { status: 400 });
      }

      const newPrompt: SystemPrompt = {
        id,
        name: `Roleplay: ${name}`,
        description: description || 'Practice difficult conversations',
        isActive: false,
        context: context || '',
        content,
      };

      config.prompts.push(newPrompt);
      await writeConfig(config);
      console.log('[SYSTEM_PROMPTS] Added new prompt:', id);

      return NextResponse.json({ success: true, prompts: config.prompts, promptId: id });
    } else if (action === 'update') {
      const { promptId, name, description, content, context } = body;
      if (!promptId) {
        return NextResponse.json({ error: 'promptId is required' }, { status: 400 });
      }

      const targetPrompt = config.prompts.find((p) => p.id === promptId);
      if (!targetPrompt) {
        return NextResponse.json({ error: 'Prompt not found' }, { status: 404 });
      }

      // Update fields if provided
      if (name !== undefined) targetPrompt.name = name;
      if (description !== undefined) targetPrompt.description = description;
      if (content !== undefined) targetPrompt.content = content;
      if (context !== undefined) targetPrompt.context = context;

      await writeConfig(config);
      console.log('[SYSTEM_PROMPTS] Updated prompt:', promptId);

      return NextResponse.json({ success: true, prompts: config.prompts });
    } else if (action === 'delete') {
      const { promptId } = body;
      if (!promptId) {
        return NextResponse.json({ error: 'promptId is required' }, { status: 400 });
      }

      const initialLength = config.prompts.length;
      config.prompts = config.prompts.filter((p) => p.id !== promptId);

      if (config.prompts.length === initialLength) {
        return NextResponse.json({ error: 'Prompt not found' }, { status: 404 });
      }

      // If we deleted the active prompt, activate the first remaining prompt
      if (config.prompts.length > 0 && !config.prompts.some((p) => p.isActive)) {
        config.prompts[0].isActive = true;
      }

      await writeConfig(config);
      console.log('[SYSTEM_PROMPTS] Deleted prompt:', promptId);

      return NextResponse.json({ success: true, prompts: config.prompts });
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('[SYSTEM_PROMPTS] Failed to manage prompts:', error);
    return NextResponse.json({ error: 'Failed to manage prompts' }, { status: 500 });
  }
}
