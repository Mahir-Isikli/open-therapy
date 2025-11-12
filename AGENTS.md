# Voice Agent Project

## 🎯 Project Structure

```
AI-tinkerers-Nov/
├── agent-python/         # Python agent (Backend)
│   ├── agent.py         # Main agent code
│   ├── .env.local       # API keys (not in Git)
│   └── .venv/           # Python virtual environment
├── agent-react/         # React frontend (UI)
│   ├── app/             # Next.js app routes
│   ├── components/      # UI components
│   ├── public/
│   │   └── gradient/    # Animated gradient background (WebGL)
│   ├── .env.local       # API keys (not in Git)
│   └── node_modules/    # Dependencies
├── .env                 # Master API keys file
└── AGENTS.md           # This file
```

## 🧠 Agent Configuration

**LLM:** Groq - Kimi K2 Instruct (`moonshotai/kimi-k2-instruct`)
**STT:** Deepgram Nova-3
**TTS:** Cartesia Sonic-3 (Voice: Jacqueline)
**Memory:** Mem0 (Semantic memory with RAG)

## 🚀 Starting the Apps

### Python Agent (Backend)
```bash
cd agent-python
nohup uv run agent.py dev > agent.log 2>&1 &
```
- **Logs:** `agent-python/agent.log`
- **Stop:** `pkill -f "uv run agent.py"`

### React Frontend (UI)
```bash
cd agent-react
nohup pnpm dev > agent-react.log 2>&1 &
```
- **Access:** http://localhost:3001
- **Logs:** `agent-react/agent-react.log`
- **Stop:** `pkill -f "pnpm dev.*agent-react"`

### View Logs (Real-time)
```bash
# Python agent
tail -f agent-python/agent.log

# React frontend
tail -f agent-react/agent-react.log
```

## 📝 Development Rules

### ⚠️ BEFORE ADDING ANYTHING NEW:

1. **READ THIS FILE FIRST** - Check for conflicts or redundancy
2. **FLAG CONFLICTS** - Alert user if additions conflict with existing setup
3. **THINK 5 SOLUTIONS** - Consider 5 possible approaches
4. **CHOOSE ELEGANCE** - Pick the most elegant, simple solution
5. **UPDATE THIS FILE** - Keep documentation in sync

### Documentation Style:
- **Concise & Clean** - As much as needed, as little as possible
- **No Redundancy** - Each piece of info appears once
- **Clear Structure** - Easy to scan and understand

## 🔑 API Keys

All API keys are stored in `.env.local` files (excluded from Git):

- `LIVEKIT_API_KEY` - LiveKit Cloud credentials
- `LIVEKIT_API_SECRET` - LiveKit Cloud credentials
- `LIVEKIT_URL` - LiveKit Cloud WebSocket URL
- `GROQ_API_KEY` - Groq LLM access
- `DEEPGRAM_API_KEY` - Deepgram STT access
- `CARTESIA_API_KEY` - Cartesia TTS and voice cloning access (required in both Python and React .env.local)
- `MEM0_API_KEY` - Mem0 semantic memory and RAG access

## 🛠️ Common Tasks

### Check Running Processes
```bash
ps aux | grep -E "(uv run agent|pnpm dev)" | grep -v grep
```

### Restart Everything
```bash
# Stop all
pkill -f "uv run agent.py"
pkill -f "pnpm dev.*agent-react"

# Start all
cd agent-python && nohup uv run agent.py dev > agent.log 2>&1 &
cd agent-react && nohup pnpm dev > agent-react.log 2>&1 &
```

### Download Python Model Files
```bash
cd agent-python
uv run agent.py download-files
```

## 🏗️ Architecture

```
User Browser (localhost:3001)
    ↓
React Frontend (agent-react)
    ├── Voice Cloning UI (optional)
    └── Audio Recording Component
    ↓
LiveKit Cloud (WebSocket)
    ↓
Python Agent (agent-python)
    ├── Groq (Kimi K2) - Reasoning
    ├── Deepgram - Speech Recognition
    ├── Cartesia - Voice Synthesis (with optional custom voice)
    └── Mem0 - Semantic Memory & RAG (stores/retrieves conversation context)
```

## 🎤 Voice Cloning Feature

Users can clone their own voice for a personalized agent experience:

1. Click "Clone Your Voice" button on the welcome screen
2. Record 3-10 seconds of clear audio
3. Voice is cloned via Cartesia API (instant voice cloning)
4. Agent uses the custom voice for all responses

**Best Practices for Recording:**
- Quiet environment with minimal background noise
- Clear speech without long pauses
- 3-10 seconds of audio (10 second max enforced)
- Speak naturally in your normal voice

## 🧠 Memory System (Mem0)

The agent uses Mem0 for semantic memory and RAG (Retrieval Augmented Generation):

**How it works:**
1. Every user message is stored in Mem0 with semantic embedding
2. Before responding, agent searches Mem0 for relevant past context
3. Retrieved memories are injected into the conversation as context
4. Agent uses this context to provide personalized, context-aware responses

**Memory User ID:** `livekit-mem0` (shared across all sessions)

**Implementation:** Follows LiveKit's official Mem0 integration pattern with global client initialization

**Features:**
- Automatic conversation storage
- Semantic search for relevant past interactions
- Natural context injection (agent doesn't explicitly mention memory)
- Persistent across sessions

## 🎭 Agent Personality & System Prompts

The agent uses dynamic system prompts managed through `system_prompt_config.json`, similar to voice configuration:

### Available Modes

**Therapist (Default):**
- Supportive therapist who keeps it real and brief
- Acknowledges emotions then moves to action
- Natural conversational voice with humanized communication
- Uses memory naturally without announcing it

**Roleplay:**
- Practice difficult conversations in a safe environment
- Agent roleplays as people you're having difficulty with (boss, partner, parent, etc.)
- Adjustable difficulty levels (easy, realistic, challenging)
- Can break character for coaching when requested

### Managing System Prompts

**Via UI:**
1. Click "Select Mode" button on welcome screen
2. Choose from existing modes, add context, or create new modes
3. **Quick Context Addition**: Click "+ Context" or "✎ Context" next to any mode to add situation-specific context without editing the base prompt
4. **Full Editing**: Click "Edit" to modify the entire prompt
5. Selected mode becomes active immediately

**Layered Context System:**
Each mode has a **base prompt** (the core instructions) and an optional **context field** that layers on top:
- **Base**: "You are roleplaying as someone the user is having difficulty with..."
- **Context**: "You're my best friend John who's been distant lately because of work stress. You tend to get defensive when confronted."
- **Result**: Agent uses both together, with context adding specific details to the base framework

This lets you reuse powerful base modes (like Roleplay) while customizing them for specific situations.

**Via JSON:**
Edit `agent-python/system_prompt_config.json` to add/modify modes. Structure:
```json
{
  "prompts": [
    {
      "id": "unique-id",
      "name": "Display Name",
      "description": "Brief description",
      "isActive": true,
      "context": "Optional situation-specific context that layers on top",
      "content": "Base system prompt..."
    }
  ]
}
```

Changes take effect after restarting the agent.

## 🔊 Thinking Sound

The agent plays a subtle background audio during tool calls and processing to provide user feedback:

**Implementation:**
- Uses `BackgroundAudioPlayer` with custom thinking sound
- Plays automatically when agent is in "thinking" state (tool calls)
- Custom audio file: `agent-python/thinking-sound.mp3`
- Volume set to 60% for subtle, non-intrusive feedback

**Customization:**
Replace `thinking-sound.mp3` with any audio file (MP3, WAV, OGG supported). Changes require agent restart.

## 🎨 Animated Gradient Background

The React frontend features a WebGL-based animated gradient background (based on GradientGen):

**Features:**
- GPU-accelerated WebGL rendering
- Therapeutic preset (calm blue tones, slow movement)
- Automatically responsive to screen size
- Positioned behind all UI elements

**Files:**
- `public/gradient/gradient-engine.js` - Main WebGL engine (no UI controls)
- `public/gradient/README.md` - Customization guide

**Customization:**
To change colors, speed, or patterns, edit `gradient-engine.js` and modify the `shaderParams` object. See the README for preset examples (ocean, sunset, forest, etc.).

## 🔄 Dynamic Welcome Text

The welcome screen features an animated word rotation effect for the agent's role:

**Implementation:**
- Uses custom `WordRotate` component with smooth vertical transitions
- Displays "Chat with your [rotating role]"
- Rotates through: therapist, manager, friend, mom, sister, boyfriend, husband
- Changes every 2.5 seconds with fade animation

**Files:**
- `components/ui/word-rotate.tsx` - Reusable word rotation component
- `components/app/welcome-view.tsx` - Welcome screen implementation

**Customization:**
To add/remove roles, edit the `words` array in `welcome-view.tsx`. Adjust `duration` prop to change rotation speed.

## 📚 Key Files

**Backend:**
- `agent-python/agent.py` - Agent logic with MemoryEnabledAgent class, model configuration, voice cloning, thinking sound, and system prompt loading
- `agent-python/system_prompt_config.json` - Dynamic system prompts with base + context layering
- `agent-python/voice_config.json` - Voice configurations for TTS
- `agent-python/thinking-sound.mp3` - Custom audio played during tool calls and processing

**Frontend:**
- `agent-react/app/api/connection-details/route.ts` - Connection token generation with voice ID support
- `agent-react/app/api/clone-voice/route.ts` - Voice cloning API endpoint
- `agent-react/app/api/system-prompts/route.ts` - System prompt management API
- `agent-react/app/api/voices/route.ts` - Voice management API
- `agent-react/components/app/system-prompt-modal.tsx` - System prompt selection and context editing UI
- `agent-react/components/app/voice-cloning-modal.tsx` - Voice recording and cloning UI
- `agent-react/components/app/voice-selection-modal.tsx` - Voice selection UI
- `agent-react/components/app/welcome-view.tsx` - Welcome screen with word rotation
- `agent-react/components/app/app.tsx` - Main UI component
- `agent-react/components/ui/word-rotate.tsx` - Animated word rotation component
- `agent-react/public/gradient/` - Animated gradient background engine

**Configuration:**
- `.gitignore` - Protects sensitive files from Git
- `.env.local` files - API keys (not in Git)

## ⚡ Performance Notes

- Kimi K2 runs at ~185 tokens/second on Groq
- Agent initialization takes ~8-10 seconds
- Turn detection uses Silero VAD + Multilingual Model

## 🔄 Version Control

This project uses Git. The `.gitignore` excludes:
- `.env` and `.env.local` files
- `node_modules/` and `.venv/`
- Log files (`*.log`)
- Build artifacts

---

**Last Updated:** 2025-11-12
**Status:** Working ✅
