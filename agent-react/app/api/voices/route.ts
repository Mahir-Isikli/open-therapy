import { NextResponse } from 'next/server';

interface Voice {
  id: string;
  name: string;
  isActive: boolean;
}

interface VoiceConfig {
  voices: Voice[];
}

const getConfigPath = async () => {
  const path = await import('path');
  return path.join(process.cwd(), '..', 'agent-python', 'voice_config.json');
};

const readConfig = async (): Promise<VoiceConfig> => {
  try {
    const fs = await import('fs/promises');
    const configPath = await getConfigPath();
    const data = await fs.readFile(configPath, 'utf-8');
    const parsed = JSON.parse(data);

    // Migrate old format if needed
    if (parsed.voice_id && !parsed.voices) {
      return {
        voices: [{ id: parsed.voice_id, name: 'Default Voice', isActive: true }],
      };
    }

    return parsed.voices ? parsed : { voices: [] };
  } catch (error) {
    return { voices: [] };
  }
};

const writeConfig = async (config: VoiceConfig): Promise<void> => {
  const fs = await import('fs/promises');
  const configPath = await getConfigPath();
  await fs.writeFile(configPath, JSON.stringify(config, null, 2));
};

// GET - List all voices
export async function GET() {
  try {
    const config = await readConfig();
    return NextResponse.json({ voices: config.voices });
  } catch (error) {
    console.error('[VOICES] Failed to read voices:', error);
    return NextResponse.json({ error: 'Failed to read voices' }, { status: 500 });
  }
}

// POST - Set active voice or delete voice
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, voiceId } = body;

    if (!action || !voiceId) {
      return NextResponse.json({ error: 'action and voiceId are required' }, { status: 400 });
    }

    const config = await readConfig();

    if (action === 'setActive') {
      // Deactivate all voices
      config.voices.forEach((voice) => (voice.isActive = false));

      // Activate the selected voice
      const targetVoice = config.voices.find((v) => v.id === voiceId);
      if (!targetVoice) {
        return NextResponse.json({ error: 'Voice not found' }, { status: 404 });
      }
      targetVoice.isActive = true;

      await writeConfig(config);
      console.log('[VOICES] Set active voice:', voiceId);

      return NextResponse.json({ success: true, voices: config.voices });
    } else if (action === 'delete') {
      const initialLength = config.voices.length;
      config.voices = config.voices.filter((v) => v.id !== voiceId);

      if (config.voices.length === initialLength) {
        return NextResponse.json({ error: 'Voice not found' }, { status: 404 });
      }

      // If we deleted the active voice, activate the first remaining voice
      if (config.voices.length > 0 && !config.voices.some((v) => v.isActive)) {
        config.voices[0].isActive = true;
      }

      await writeConfig(config);
      console.log('[VOICES] Deleted voice:', voiceId);

      return NextResponse.json({ success: true, voices: config.voices });
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('[VOICES] Failed to manage voices:', error);
    return NextResponse.json({ error: 'Failed to manage voices' }, { status: 500 });
  }
}
