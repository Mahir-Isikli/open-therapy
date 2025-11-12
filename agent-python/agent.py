from dotenv import load_dotenv

from livekit import agents
from livekit.agents import AgentSession, Agent, RoomInputOptions
from livekit.plugins import groq, deepgram, cartesia, noise_cancellation, silero
from livekit.plugins.turn_detector.multilingual import MultilingualModel

load_dotenv(".env.local")


class Assistant(Agent):
    def __init__(self) -> None:
        super().__init__(
            instructions="""You are a helpful voice AI assistant.
            You eagerly assist users with their questions by providing information from your extensive knowledge.
            Your responses are concise, to the point, and without any complex formatting or punctuation including emojis, asterisks, or other symbols.
            You are curious, friendly, and have a sense of humor.""",
        )


async def entrypoint(ctx: agents.JobContext):
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
        
        # Text-to-speech using Cartesia Sonic-3 with Jacqueline voice
        # Confident, young American adult female voice
        # See all available models as well as voice selections at https://docs.livekit.io/agents/models/tts/
        tts=cartesia.TTS(
            model="sonic-english",
            voice="9626c31c-bec5-4cca-baa8-f8ba9e84c8bc",
        ),
        
        # VAD and turn detection are used to determine when the user is speaking and when the agent should respond
        # See more at https://docs.livekit.io/agents/build/turns
        vad=silero.VAD.load(),
        turn_detection=MultilingualModel(),
    )

    await session.start(
        room=ctx.room,
        agent=Assistant(),
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
