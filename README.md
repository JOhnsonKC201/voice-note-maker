# 🎙️ Lecture Note Maker - AI-Powered

Record your professor's lecture → AI generates comprehensive notes with web research. Completely free, works in your browser.

## ⚡ Quick Start

### 1️⃣ Get Free Groq API Key (2 minutes)
- Visit: https://console.groq.com/keys
- Sign up with email (no credit card needed)
- Copy your API key (starts with `gsk_`)

### 2️⃣ Setup
```bash
# Clone & install
git clone <repo>
cd voice-note-maker
npm install

# Edit .env.local with your Groq key
# Replace: gsk_YOUR_ACTUAL_API_KEY_HERE
```

### 3️⃣ Run (Two Terminal Windows)

**Terminal 1: Start Backend**
```bash
npm run server:groq
# Should show: "🚀 Server running on port 3002"
```

**Terminal 2: Start Frontend**
```bash
npm run dev
# Visit: http://localhost:5173 (or next available port)
```

## 🎯 How to Use

1. **Click "Start Recording"** - Begin recording your lecture
2. **Speak clearly** - Live transcript appears as you speak
3. **Click "Stop Recording"** - Lecture automatically transcribed
4. **Click "Generate Note"** - AI analyzes + web research
5. **Download** - Save your comprehensive note as .txt

## ✨ What It Does

✅ Records audio from your microphone
✅ Real-time transcription (browser-based, no upload)
✅ AI analyzes lecture content using Groq (free tier)
✅ Web searches for related topics (DuckDuckGo - no key needed)
✅ Generates formatted note with key points & action items
✅ Exports as text file you can share/print

## 🔧 Technical Stack

- **Frontend**: React 18 + Vite + Tailwind CSS
- **Transcription**: Web Speech API (browser-native, no key needed)
- **AI Analysis**: Groq API (free tier LLM)
- **Web Search**: DuckDuckGo API (no key needed)
- **Backend**: Node.js + Express

## 📝 Notes

- All notes stored in browser (never sent to cloud)
- Free forever - no accounts, no trial limits
- No tracking or analytics
- Works offline for recording & transcription

## 🐛 Troubleshooting

**"Error: Failed to generate note"**
- Check your Groq API key in `.env.local`
- Make sure backend is running (`npm run server:groq`)
- Verify internet connection

**"Speech Recognition not supported"**
- Use Chrome, Edge, or Firefox (Safari has limited support)

**"Cannot connect to API"**
- Backend must be on port 3002
- Check `.env.local` has `PORT=3002`

## 📄 License

MIT
