import { NextResponse } from 'next/server';
import { AccessToken, type AccessTokenOptions, type VideoGrant } from 'livekit-server-sdk';
import { RoomConfiguration, RoomAgentDispatch } from '@livekit/protocol';

type ConnectionDetails = {
  serverUrl: string;
  roomName: string;
  participantName: string;
  participantToken: string;
};

// NOTE: you are expected to define the following environment variables in `.env.local`:
const API_KEY = process.env.LIVEKIT_API_KEY;
const API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_URL = process.env.LIVEKIT_URL;

// don't cache the results
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    if (LIVEKIT_URL === undefined) {
      throw new Error('LIVEKIT_URL is not defined');
    }
    if (API_KEY === undefined) {
      throw new Error('LIVEKIT_API_KEY is not defined');
    }
    if (API_SECRET === undefined) {
      throw new Error('LIVEKIT_API_SECRET is not defined');
    }

    // Parse agent configuration from request body
    const body = await req.json();
    const agentName: string = body?.room_config?.agents?.[0]?.agent_name;
    let voiceId: string | undefined = body?.voice_id;
    
    // If no voice ID provided, try to read active voice from config
    if (!voiceId) {
      try {
        const fs = await import('fs/promises');
        const path = await import('path');
        const configPath = path.join(process.cwd(), '..', 'agent-python', 'voice_config.json');
        const configData = await fs.readFile(configPath, 'utf-8');
        const config = JSON.parse(configData);
        
        // Support new multi-voice structure
        if (config.voices && Array.isArray(config.voices)) {
          const activeVoice = config.voices.find((v: any) => v.isActive);
          if (activeVoice) {
            voiceId = activeVoice.id;
            console.log('[CONNECTION] Using active voice from config:', activeVoice.name, voiceId);
          }
        }
        // Fallback to old format
        else if (config.voice_id) {
          voiceId = config.voice_id;
          console.log('[CONNECTION] Using voice from old config format:', voiceId);
        }
      } catch (error) {
        console.log('[CONNECTION] No voice config found, using default voice');
      }
    } else {
      console.log('[CONNECTION] Received request with voiceId:', voiceId);
    }

    // Generate participant token
    const participantName = 'user';
    const participantIdentity = `voice_assistant_user_${Math.floor(Math.random() * 10_000)}`;
    const roomName = `voice_assistant_room_${Math.floor(Math.random() * 10_000)}`;

    const participantToken = await createParticipantToken(
      { identity: participantIdentity, name: participantName },
      roomName,
      agentName,
      voiceId
    );

    // If we have a voice ID, create the room with metadata first
    if (voiceId) {
      console.log('[CONNECTION] Creating room with voice_id metadata:', voiceId);
      const { RoomServiceClient } = await import('livekit-server-sdk');
      const roomService = new RoomServiceClient(LIVEKIT_URL, API_KEY, API_SECRET);
      
      try {
        // Create the room with metadata included
        await roomService.createRoom({
          name: roomName,
          emptyTimeout: 60 * 5, // 5 minutes
          metadata: JSON.stringify({ voice_id: voiceId }),
        });
        console.log('[CONNECTION] Room created successfully with metadata');
      } catch (error: any) {
        // Room might already exist, try to update metadata
        if (error?.code === 'already_exists' || error?.status === 409) {
          console.log('[CONNECTION] Room exists, updating metadata...');
          try {
            await roomService.updateRoomMetadata(roomName, JSON.stringify({ voice_id: voiceId }));
            console.log('[CONNECTION] Room metadata updated successfully');
          } catch (updateError) {
            console.error('[CONNECTION] Failed to update room metadata:', updateError);
          }
        } else {
          console.error('[CONNECTION] Failed to create room:', error);
        }
      }
    }

    // Return connection details
    const data: ConnectionDetails = {
      serverUrl: LIVEKIT_URL,
      roomName,
      participantToken: participantToken,
      participantName,
    };
    const headers = new Headers({
      'Cache-Control': 'no-store',
    });
    return NextResponse.json(data, { headers });
  } catch (error) {
    if (error instanceof Error) {
      console.error(error);
      return new NextResponse(error.message, { status: 500 });
    }
  }
}

function createParticipantToken(
  userInfo: AccessTokenOptions,
  roomName: string,
  agentName?: string,
  voiceId?: string
): Promise<string> {
  const at = new AccessToken(API_KEY, API_SECRET, {
    ...userInfo,
    ttl: '15m',
  });
  const grant: VideoGrant = {
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canPublishData: true,
    canSubscribe: true,
  };
  at.addGrant(grant);

  if (agentName) {
    // Use RoomAgentDispatch to properly pass metadata to the agent
    const agentDispatch = new RoomAgentDispatch({
      agentName: agentName,
      metadata: voiceId ? JSON.stringify({ voice_id: voiceId }) : undefined,
    });
    
    if (voiceId) {
      console.log('[TOKEN] Setting agent dispatch metadata:', agentDispatch.metadata);
    }
    
    at.roomConfig = new RoomConfiguration({
      agents: [agentDispatch],
    });
  }

  // Also set participant metadata as backup
  if (voiceId) {
    at.metadata = JSON.stringify({ voice_id: voiceId });
    console.log('[TOKEN] Setting participant metadata:', at.metadata);
  }

  return at.toJwt();
}
