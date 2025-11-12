import { NextResponse } from 'next/server';

const CARTESIA_API_KEY = process.env.CARTESIA_API_KEY;

export async function POST(req: Request) {
  try {
    if (!CARTESIA_API_KEY) {
      throw new Error('CARTESIA_API_KEY is not defined');
    }

    const formData = await req.formData();
    const audioFile = formData.get('audio') as File;
    const name = formData.get('name') as string;
    const language = (formData.get('language') as string) || 'en';
    const mode = (formData.get('mode') as string) || 'similarity';

    if (!audioFile) {
      return NextResponse.json({ error: 'Audio file is required' }, { status: 400 });
    }

    if (!name) {
      return NextResponse.json({ error: 'Voice name is required' }, { status: 400 });
    }

    // Create form data for Cartesia API
    const cartesiaFormData = new FormData();
    cartesiaFormData.append('clip', audioFile);
    cartesiaFormData.append('name', name);
    cartesiaFormData.append('description', 'User cloned voice');
    cartesiaFormData.append('language', language);
    cartesiaFormData.append('mode', mode);
    cartesiaFormData.append('enhance', 'true');

    // Call Cartesia voice cloning API
    const response = await fetch('https://api.cartesia.ai/voices/clone', {
      method: 'POST',
      headers: {
        'X-API-Key': CARTESIA_API_KEY,
        'Cartesia-Version': '2024-11-13',
      },
      body: cartesiaFormData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Cartesia API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();

    // Write voice ID to config file for Python agent to read
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const configPath = path.join(process.cwd(), '..', 'agent-python', 'voice_config.json');
      await fs.writeFile(configPath, JSON.stringify({ voice_id: result.id }, null, 2));
      console.log('[VOICE-CLONE] Wrote voice ID to config file:', result.id);
    } catch (error) {
      console.error('[VOICE-CLONE] Failed to write config file:', error);
    }

    return NextResponse.json({
      voiceId: result.id,
      name: result.name,
      language: result.language,
    });
  } catch (error) {
    console.error('Voice cloning error:', error);
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: 'Unknown error occurred' }, { status: 500 });
  }
}
