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
│   ├── .env.local       # API keys (not in Git)
│   └── node_modules/    # Dependencies
├── .env                 # Master API keys file
└── AGENTS.md           # This file
```

## 🧠 Agent Configuration

**LLM:** Groq - Kimi K2 Instruct (`moonshotai/kimi-k2-instruct`)
**STT:** Deepgram Nova-3
**TTS:** Cartesia Sonic-3 (Voice: Jacqueline)

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
    └── Cartesia - Voice Synthesis (with optional custom voice)
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

## 📚 Key Files

- `agent-python/agent.py` - Agent logic, model configuration, and voice cloning function
- `agent-react/app/api/connection-details/route.ts` - Connection token generation with voice ID support
- `agent-react/app/api/clone-voice/route.ts` - Voice cloning API endpoint
- `agent-react/components/app/voice-cloning-modal.tsx` - Voice recording and cloning UI
- `agent-react/components/app/app.tsx` - Main UI component
- `.gitignore` - Protects sensitive files from Git

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
