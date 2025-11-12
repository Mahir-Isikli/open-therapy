import logging
import os

import requests
from dotenv import load_dotenv
from livekit import agents
from livekit.agents import (
    Agent,
    AgentSession,
    ChatContext,
    ChatMessage,
    RoomInputOptions,
    function_tool,
)
from livekit.plugins import cartesia, deepgram, groq, noise_cancellation, silero
from livekit.plugins.turn_detector.multilingual import MultilingualModel
from mem0 import AsyncMemoryClient

load_dotenv(".env.local")

# Set up logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("memory_voice_agent")

# User ID for RAG data in Mem0
RAG_USER_ID = "livekit-mem0"
mem0_client = AsyncMemoryClient()


def load_system_prompt() -> str:
    """Load the system prompt from JSON config file (similar to voice ID loading).
    Combines base content with optional context for layered prompts."""
    try:
        import json
        
        config_path = os.path.join(os.path.dirname(__file__), "system_prompt_config.json")
        with open(config_path, "r") as f:
            config = json.load(f)
            
            # Find active prompt
            if "prompts" in config and isinstance(config["prompts"], list):
                active_prompt = next(
                    (p for p in config["prompts"] if p.get("isActive")), None
                )
                if active_prompt:
                    prompt_name = active_prompt.get("name", "Custom")
                    base_content = active_prompt["content"]
                    context = active_prompt.get("context", "").strip()
                    
                    # Combine base content with context if provided
                    if context:
                        combined_prompt = f"{base_content}\n\n## Additional Context\n\n{context}"
                        logger.info(f"✓ Using active system prompt: {prompt_name} (with context)")
                        return combined_prompt
                    else:
                        logger.info(f"✓ Using active system prompt: {prompt_name}")
                        return base_content
            
            # Fallback to first prompt if no active one found
            if config["prompts"]:
                logger.warning("No active prompt found, using first prompt")
                return config["prompts"][0]["content"]
                
    except FileNotFoundError:
        logger.warning("system_prompt_config.json not found, falling back to system_prompt.txt")
        try:
            prompt_path = os.path.join(os.path.dirname(__file__), "system_prompt.txt")
            with open(prompt_path, "r") as f:
                return f.read().strip()
        except FileNotFoundError:
            logger.warning("system_prompt.txt also not found, using default prompt")
    except Exception as e:
        logger.error(f"Failed to load system prompt from config: {e}")
    
    # Ultimate fallback
    return """You are a helpful voice AI assistant. Your responses are concise and conversational,
    without any complex formatting, emojis, or special characters."""


def clone_voice(
    audio_file_path: str, name: str, language: str = "en", mode: str = "similarity"
) -> str:
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
            headers={"X-API-Key": api_key, "Cartesia-Version": "2024-11-13"},
            files={"clip": audio_file},
            data={
                "name": name,
                "description": "User cloned voice",
                "language": language,
                "mode": mode,
                "enhance": "true",
            },
        )

    response.raise_for_status()
    return response.json()["id"]


@function_tool()
async def search_memory(query: str) -> str:
    """
    Search past conversation history for relevant context.
    Use this when the user asks about previous conversations, past topics, or when you need context from earlier sessions.

    Args:
        query: The search query to find relevant past context

    Returns:
        Relevant context from past conversations
    """
    try:
        logger.info(f"Tool called: Searching Mem0 for query: {query}")
        search_results = await mem0_client.search(
            query=query,
            filters={"user_id": RAG_USER_ID},
            version="v2",
        )

        if search_results and search_results.get("results", []):
            context_parts = []
            for result in search_results.get("results", []):
                paragraph = result.get("memory") or result.get("text")
                if paragraph:
                    context_parts.append(paragraph)

            if context_parts:
                context = "Context from past sessions: " + "; ".join(context_parts)
                logger.info(f"Memory search returned: {context}")
                return context

        logger.info("No relevant memories found")
        return "No relevant past context found."
    except Exception as e:
        logger.warning(f"Memory search failed: {e}")
        return f"Memory search unavailable: {str(e)}"


class MemoryEnabledAgent(Agent):
    """
    An agent that can remember past conversations using Mem0 for semantic memory retrieval.
    Memory search is now tool-based and only called when relevant.
    """

    def __init__(self) -> None:
        super().__init__(
            instructions=load_system_prompt(),
            tools=[search_memory],
        )
        logger.info(
            f"MemoryEnabledAgent initialized with system prompt and memory search tool. Using user_id: {RAG_USER_ID}"
        )

    async def on_enter(self):
        """Called when the agent enters the conversation."""
        self.session.generate_reply(instructions="Say: 'Hey Mahir, how have you been?'")

    async def on_user_turn_completed(
        self, turn_ctx: ChatContext, new_message: ChatMessage
    ) -> None:
        """
        Called when the user finishes speaking.
        Store the user message in Mem0 for future reference.
        Memory search is now handled via the search_memory tool when needed.
        """
        # Persist the user message in Mem0
        try:
            logger.info(f"Adding user message to Mem0: {new_message.text_content}")
            add_result = await mem0_client.add(
                [{"role": "user", "content": new_message.text_content}],
                user_id=RAG_USER_ID,
            )
            logger.info(f"Mem0 add result (user): {add_result}")
        except Exception as e:
            logger.warning(f"Failed to store user message in Mem0: {e}")

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

            # Support new multi-voice structure
            if "voices" in config and isinstance(config["voices"], list):
                # Find active voice
                active_voice = next(
                    (v for v in config["voices"] if v.get("isActive")), None
                )
                if active_voice:
                    voice_id = active_voice["id"]
                    voice_name = active_voice.get("name", "Custom Voice")
                    print(f"✓ Using active voice: {voice_name} ({voice_id})")
            # Fallback to old format
            elif "voice_id" in config and config["voice_id"]:
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
            speed=0.8,  # Slightly slower speech (1.0 = default, <1.0 = slower, >1.0 = faster)
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


if __name__ == "__main__":
    agents.cli.run_app(agents.WorkerOptions(entrypoint_fnc=entrypoint))
