from dotenv import load_dotenv
import os
import requests

from livekit import agents
from livekit.agents import AgentSession, Agent, RoomInputOptions
from livekit.plugins import groq, deepgram, cartesia, noise_cancellation, silero
from livekit.plugins.turn_detector.multilingual import MultilingualModel

load_dotenv(".env.local")


def clone_voice(audio_file_path: str, name: str, language: str = "en", mode: str = "similarity") -> str:
    """
    Clone a voice using Cartesia's voice cloning API.
    
    Args:
        audio_file_path: Path to the audio file (3-10 seconds recommended)
        name: Name for the cloned voice
        language: Language code (default: "en")
        mode: "similarity" for close match or "stability" for polished sound
    
    Returns:
        Voice ID string that can be used with Cartesia TTS
    """
    api_key = os.getenv("CARTESIA_API_KEY")
    if not api_key:
        raise ValueError("CARTESIA_API_KEY not found in environment")
    
    with open(audio_file_path, "rb") as audio_file:
        response = requests.post(
            "https://api.cartesia.ai/voices/clone",
            headers={
                "X-API-Key": api_key,
                "Cartesia-Version": "2024-11-13"
            },
            files={"clip": audio_file},
            data={
                "name": name,
                "description": "User cloned voice",
                "language": language,
                "mode": mode,
                "enhance": "true"
            }
        )
    
    response.raise_for_status()
    return response.json()["id"]


class Assistant(Agent):
    def __init__(self) -> None:
        super().__init__(
            instructions="""You are a helpful voice AI assistant.
            You eagerly assist users with their questions by providing information from your extensive knowledge.
            Your responses are concise, to the point, and without any complex formatting or punctuation including emojis, asterisks, or other symbols.
            You are curious, friendly, and have a sense of humor.""",
        )


async def entrypoint(ctx: agents.JobContext):
    import json
    
    # Read voice ID from config file (simple and reliable!)
    voice_id = "9626c31c-bec5-4cca-baa8-f8ba9e84c8bc"  # Default Jacqueline voice
    
    try:
        import os
        config_path = os.path.join(os.path.dirname(__file__), "voice_config.json")
        with open(config_path, "r") as f:
            config = json.load(f)
            if "voice_id" in config and config["voice_id"]:
                voice_id = config["voice_id"]
                print(f"✓ Using custom voice ID from config file: {voice_id}")
    except FileNotFoundError:
        print(f"No voice config file found, using default voice")
    except Exception as e:
        print(f"Failed to read voice config: {e}, using default voice")
    
    print(f"[FINAL] Voice ID: {voice_id}")
    
    # Set up a voice AI pipeline using Groq Kimi K2, Deepgram STT, and Cartesia TTS
    session = AgentSession(
        # Speech-to-text using Deepgram Nova-3 for high-quality transcription
        # See all available models at https://docs.livekit.io/agents/models/stt/
        stt=deepgram.STT(
            model="nova-3",
            language="en",
        ),
        
        # Large Language Model using Kimi K2 Instruct through Groq
        # Kimi K2 is optimized for complex reasoning with strong multilingual support
        # See all providers at https://docs.livekit.io/agents/models/llm/
        llm=groq.LLM(
            model="moonshotai/kimi-k2-instruct",
        ),
        
        # Text-to-speech using Cartesia Sonic-3 with configurable voice
        # Voice can be customized via voice cloning or use default Jacqueline voice
        # See all available models as well as voice selections at https://docs.livekit.io/agents/models/tts/
        tts=cartesia.TTS(
            model="sonic-english",
            voice=voice_id,
        ),
        
        # VAD and turn detection are used to determine when the user is speaking and when the agent should respond
        # See more at https://docs.livekit.io/agents/build/turns
        vad=silero.VAD.load(),
        turn_detection=MultilingualModel(),
    )

    await session.start(
        agent=Assistant(),
        room=ctx.room,
        room_input_options=RoomInputOptions(
            # For telephony applications, use `BVCTelephony` instead for best results
            noise_cancellation=noise_cancellation.BVC(),
        ),
    )

    await session.generate_reply(
        instructions="Greet the user and offer your assistance."
    )


if __name__ == "__main__":
    agents.cli.run_app(agents.WorkerOptions(entrypoint_fnc=entrypoint))
