from dotenv import load_dotenv
import os
import requests
import logging

from livekit import agents
from livekit.agents import AgentSession, Agent, RoomInputOptions, ChatContext, ChatMessage, BackgroundAudioPlayer, AudioConfig
from livekit.plugins import groq, deepgram, cartesia, noise_cancellation, silero
from livekit.plugins.turn_detector.multilingual import MultilingualModel
from mem0 import AsyncMemoryClient

load_dotenv(".env.local")

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("memory_voice_agent")

# User ID for RAG data in Mem0
RAG_USER_ID = "livekit-mem0"
mem0_client = AsyncMemoryClient()


def load_system_prompt() -> str:
    """Load the system prompt from external file."""
    try:
        prompt_path = os.path.join(os.path.dirname(__file__), "system_prompt.txt")
        with open(prompt_path, "r") as f:
            return f.read().strip()
    except FileNotFoundError:
        logger.warning("system_prompt.txt not found, using default prompt")
        return """You are a helpful voice AI assistant. Your responses are concise and conversational, 
        without any complex formatting, emojis, or special characters."""


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


class MemoryEnabledAgent(Agent):
    """
    An agent that can remember past conversations using Mem0 for semantic memory retrieval.
    """
    def __init__(self) -> None:
        super().__init__(
            instructions=load_system_prompt(),
        )
        self._seen_results = set()  # Track previously seen memory result IDs
        logger.info(f"MemoryEnabledAgent initialized with system prompt from file. Using user_id: {RAG_USER_ID}")

    async def on_enter(self):
        """Called when the agent enters the conversation."""
        self.session.generate_reply(
            instructions="Greet the user warmly and offer your assistance. If you have context from past conversations, acknowledge it naturally."
        )

    async def on_user_turn_completed(self, turn_ctx: ChatContext, new_message: ChatMessage) -> None:
        """
        Called when the user finishes speaking.
        Store the user message in Mem0 and retrieve relevant context.
        """
        # Persist the user message in Mem0
        try:
            logger.info(f"Adding user message to Mem0: {new_message.text_content}")
            add_result = await mem0_client.add(
                [{"role": "user", "content": new_message.text_content}],
                user_id=RAG_USER_ID
            )
            logger.info(f"Mem0 add result (user): {add_result}")
        except Exception as e:
            logger.warning(f"Failed to store user message in Mem0: {e}")

        # RAG: Retrieve relevant context from Mem0 and inject as system message
        try:
            logger.info("About to await mem0_client.search for RAG context")
            search_results = await mem0_client.search(
                query=new_message.text_content,
                filters={"user_id": RAG_USER_ID},
                version="v2"
            )
            logger.info(f"mem0_client.search returned: {search_results}")
            if search_results and search_results.get('results', []):
                context_parts = []
                for result in search_results.get('results', []):
                    paragraph = result.get("memory") or result.get("text")
                    if paragraph:
                        context_parts.append(paragraph)
                
                if context_parts:
                    # Inject context as a system message before the user's question
                    memory_context = "Context from memory: " + "; ".join(context_parts)
                    logger.info(f"Injecting RAG context: {memory_context}")
                    turn_ctx.add_message(role="system", content=memory_context)
                    await self.update_chat_ctx(turn_ctx)
        except Exception as e:
            logger.warning(f"Failed to inject RAG context from Mem0: {e}")

        await super().on_user_turn_completed(turn_ctx, new_message)


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
        agent=MemoryEnabledAgent(),
        room=ctx.room,
        room_input_options=RoomInputOptions(
            # For telephony applications, use `BVCTelephony` instead for best results
            noise_cancellation=noise_cancellation.BVC(),
        ),
    )
    
    # Set up background audio with thinking sound for tool calls
    thinking_sound_path = os.path.join(os.path.dirname(__file__), "thinking-sound.mp3")
    background_audio = BackgroundAudioPlayer(
        thinking_sound=AudioConfig(thinking_sound_path, volume=0.6),
    )
    await background_audio.start(room=ctx.room, agent_session=session)
    print("✓ Thinking sound enabled for tool calls")


if __name__ == "__main__":
    agents.cli.run_app(agents.WorkerOptions(entrypoint_fnc=entrypoint))
