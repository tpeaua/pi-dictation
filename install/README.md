# 🎤 Pi Dictation — Installation & User Guide

> Speak instead of type. Native macOS speech-to-text and text-to-speech inside [Pi](https://github.com/earendil-works/pi). The only truly zero-dependency voice extension for Pi.

---

## What is this?

A dictation and conversation extension for the [Pi coding agent](https://github.com/earendil-works/pi). It lets you talk to Pi using your Mac's built-in speech recognition — no cloud services, no API keys, no accounts. Everything runs locally on your machine.

You can dictate one-off messages, enter **voice mode** (continuous dictation, read responses on screen), or enable **conversation mode** (full-duplex: Pi speaks aloud and listens simultaneously with barge-in).

---

## What you get

| Feature | How |
|---------|-----|
| `/dictate` | One-shot dictation — speak, it transcribes, sends to Pi |
| `/voicemode` | Continuous dictation — Pi re-listens after each reply (no TTS) |
| `/conversation` | **Full-duplex conversation** — Pi speaks responses aloud (TTS) and listens for you |
| `Ctrl+Shift+D` | Keyboard shortcut to start dictating instantly |
| `Ctrl+Shift+C` | Silence Pi mid-speech (conversation mode) |
| Trigger words | Say "hey", "silence", "quiet" etc. to silence Pi without sending a message |
| `dictate` tool | LLM can call dictation — just say "let me dictate" |

Say **"exit"**, **"stop"**, **"goodbye"**, or **"end"** any time to leave voice/conversation mode.

---

## Before you start

Your Mac needs:

- **macOS 12 (Monterey)** or later — check in  > System Settings > General > Software Update
- **Xcode Command Line Tools** — if you don't have them, run `xcode-select --install` in Terminal
- **Siri enabled** —  > System Settings > Siri > Enable Ask Siri (required for on-device dictation)
- **Pi coding agent** — `npm install -g --ignore-scripts @earendil-works/pi-coding-agent`
- **Node.js** — `brew install node` if you don't have it

Quick check:

```bash
swift --version    # should show Apple Swift 5.x
pi --version       # should show a version number
```

---

## Installation

### Step 1: Get the files

```bash
git clone https://github.com/tpeaua/pi-dictation.git ~/pi-dictation
```

### Step 2: Run the installer

```bash
cd ~/pi-dictation
chmod +x install.sh
./install.sh
```

The installer will:
1. Check you're on macOS with pi and Swift installed
2. Symlink the extension so pi finds it (works in all projects)
3. Build the Swift speech recognition helper (~10 seconds, one-time only)

You'll see `✅ Installation complete!` when done.

### Step 3: Grant macOS permissions

The first time you use dictation, macOS will ask for two permissions. **You must allow both:**

- **Microphone** → so the helper can hear you
- **Speech Recognition** → so Apple's recognizer can transcribe

If you miss the popups, go to:

>  > **System Settings > Privacy & Security**
> - **Microphone** → toggle ON for your terminal app (Terminal, iTerm, Warp, etc.)
> - **Speech Recognition** → toggle ON for your terminal app

Also confirm Siri is enabled:

>  > **System Settings > Siri > Enable Ask Siri**

---

## Using it

### Start Pi

```bash
pi
```

You should see your system info followed by the loaded message:

```
  Apple M3 Pro (Apple Silicon)  |  macOS 14.6 Sonoma  |  TTS: Samantha
  Dictation loaded — /dictate, Ctrl+Shift+D, /voicemode, /conversation. Say 'hey' or Ctrl+Shift+C to silence Pi
```

### One-off dictation

Type `/dictate` and press Enter. You'll see `🎤 Listening... speak now`. Speak naturally, pause for 10 seconds, and your words are sent to Pi.

### Continuous voice mode

Type `/voicemode` and press Enter. Pi listens, you speak, Pi responds, then Pi listens again — continuous hands-free dictation. Read Pi's responses on screen.

To exit: say **"exit"**, **"stop"**, **"goodbye"**, **"bye"**, or **"end"**. Or type `/voicemode` again.

### Conversation mode

Type `/conversation` and press Enter. Pi **speaks its responses aloud** using the "Samantha" voice and listens simultaneously:

- **Speak anytime** — you don't need to wait for Pi to finish. Your speech interrupts it naturally.
- **Trigger words** — say **"hey"**, **"silence"**, **"quiet"**, **"shut up"**, **"hold on"**, **"wait"**, or **"pause"** to silence Pi without sending a message. Pi stays in conversation mode and listens for you.
- **Exit** — say **"stop"**, **"exit"**, **"quit"**, **"goodbye"**, **"bye"**, or **"end"**.
- **Silence shortcut** — `Ctrl+Shift+C` instantly silences Pi mid-sentence.

> 💡 **Tip:** Use headphones to prevent Pi from hearing its own speech through the microphone.

### Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+D` | Start dictation |
| `Ctrl+Shift+C` | Silence Pi's speech (conversation mode) |

### Let the LLM trigger it

Just say something like *"let me dictate my response"* — the LLM knows how to call the dictation tool.

---

## How it works (the short version)

1. The extension registers commands, shortcuts, and a tool inside Pi
2. When triggered, Pi spawns a tiny Swift program that uses Apple's `SFSpeechRecognizer`
3. The Swift helper shows partial transcription in real-time as you speak
4. After 10 seconds of silence (or 30 seconds max), it prints the final text
5. Pi reads the text and sends it as if you typed it
6. In `/conversation` mode, Pi also spawns macOS `say` to speak responses aloud — dictation runs in parallel so you can interrupt anytime

The Swift helper compiles once on first run (~10 seconds). After that it's instant.

## How it compares to other Pi voice extensions

Pi has **no built-in voice features** — everything is extensions. Here's how pi-dictation stacks up:

| Extension | STT | TTS | Conversation loop | Cloud-free |
|-----------|-----|-----|-------------------|------------|
| **picrophone** | Apple / WhisperKit | ✅ | `/voice` toggle | ✅ |
| **privateer-speak** | Pluggable | ✅ | `/talk loop on` | ✅ (with OS voices) |
| **pi-talk** | ❌ | ✅ (streaming) | ❌ | ❌ |
| **pi-voice-loop** | xAI | xAI | ✅ (WebSocket) | ❌ |
| **pi-dictation** (this) | Apple native | ✅ (`say`) | ✅ with trigger-word barge-in | ✅ **100% local, zero deps** |

**Key differentiator:** pi-dictation is the only extension with zero npm dependencies for speech — it uses only Apple's built-in `SFSpeechRecognizer` and `say`. No API keys, no cloud accounts, no internet required.

---

## Testing without Pi

To make sure dictation works standalone:

```bash
cd ~/pi-dictation
./test-dictation.sh
```

Speak a few words. You should see live transcription. Press `Ctrl+C` to quit.

---

## Customising

Speech recognition is **auto-configured** — pi-dictation detects your Mac (Apple Silicon → `silentTimeout: 3.0`, Intel → `4.0`). To override, create `~/.pi-dictation.json` (all keys optional):

```json
{
  "silentTimeout": 5.0,
  "timeoutSeconds": 30,
  "locale": "en-US",
  "onDevice": false
}
```

Omit keys to use the auto-detected defaults. `onDevice: true` uses on-device recognition (private, offline; macOS 13+ required).

### TTS voice

Edit `index.ts` and change the `TTS_VOICE` constant near the top:

```ts
const TTS_VOICE = "Samantha";
```

To find available voices on your Mac:

```bash
say -v '?'
```

Popular voices: `Samantha` (American), `Karen` (Australian), `Victoria` (American), `Tessa` (South African), `Moira` (Irish), `Veena` (Indian).

---

## Troubleshooting

### "Siri is disabled" error

→  > **System Settings > Siri > Enable Ask Siri**. On-device dictation requires Siri to be switched on at the system level.

### "Speech recognition not authorized"

→  > **System Settings > Privacy & Security > Speech Recognition** → enable for your terminal app.

### "Failed to start audio engine" / no mic

→  > **System Settings > Privacy & Security > Microphone** → enable for your terminal app.

### "Swift toolchain not found"

→ Run `xcode-select --install` in Terminal.

### Poor transcription quality

→  > **System Settings > Keyboard > Dictation** → turn ON and enable **"Use Enhanced Dictation"**. This downloads a local language model that improves accuracy significantly.

### Dictation hangs / does nothing

→ Make sure you're in an interactive terminal session (not SSH). Dictation needs direct microphone access.

### Microphone stays on after exiting voicemode

→ Fixed! Toggling `/voicemode` off now immediately kills the helper process. If you still see the orange dot, restart pi.

---

## Uninstalling

```bash
rm ~/.pi/agent/extensions/dictation
```

Or if you installed per-project:

```bash
rm .pi/extensions/dictation
```

---

## Platform-specific notes

| Feature | Apple Silicon (M1–M4) | Intel |
|---------|----------------------|-------|
| Dictation | ✅ Full support | ✅ Full support |
| TTS (`say`) | ✅ All voices | ✅ All voices |
| On-device recognition | ✅ Fast (Neural Engine) | ✅ Supported (slower) |
| Swift compilation | Native arm64 | Native x64 |

> **Monterey users (macOS 12):** On-device recognition requires macOS 13+. Keep `"onDevice": false` (the default) to use Apple's servers.

## Files in this package

```
pi-dictation/
├── index.ts                 # Pi extension (the brains)
├── dictation-helper/        # Swift speech recognizer
│   ├── Package.swift
│   └── Sources/
│       └── main.swift
├── package.json
├── install.sh               # One-command installer
├── test-dictation.sh        # Standalone mic test
├── README.md                # Project overview + comparison table
└── install/
    └── README.md            # ← this file (full installation + usage guide)
```
