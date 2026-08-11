# Pi Dictation 🎤

> Speak instead of type — native macOS speech-to-text and text-to-speech inside the [Pi coding agent](https://github.com/earendil-works/pi).

No cloud services, no API keys, no accounts. Everything runs locally using Apple's built-in speech recognition and `say` for TTS — the only truly zero-dependency voice extension for Pi.

---

## 🚀 Quick Install

```bash
git clone https://github.com/tpeaua/pi-dictation.git ~/pi-dictation
cd ~/pi-dictation
chmod +x install.sh
./install.sh
```

The installer checks your setup, symlinks the extension so Pi finds it, and builds the speech recognition helper (~10 seconds, one-time only).

## What you need

- **macOS 12 (Monterey)** or later (Apple Silicon or Intel)
- **Xcode Command Line Tools** — `xcode-select --install` if you don't have them
- **Pi** — `npm install -g --ignore-scripts @earendil-works/pi-coding-agent`
- **Siri enabled** — System Settings > Siri > Enable Ask Siri

## macOS Permissions (do this once)

On first use, macOS will ask for two permissions. **Allow both:**

1. **Microphone** → System Settings > Privacy & Security > Microphone → enable for your terminal app
2. **Speech Recognition** → System Settings > Privacy & Security > Speech Recognition → enable for your terminal app

## Usage

Run `pi` and you'll see:

```
Dictation loaded — /dictate, Ctrl+Shift+D, /voicemode, /conversation. Say 'hey' or Ctrl+Shift+C to silence Pi
```

### Commands & Shortcuts

| Method | How | What it does |
|--------|-----|--------------|
| `/dictate` | Type `/dictate` and speak | One-off dictation — transcribed text is sent as a message |
| `Ctrl+Shift+D` | Keyboard shortcut | Same as `/dictate` — quick access |
| `/voicemode` | Type `/voicemode` | Continuous voice input — Pi listens after each reply (no TTS) |
| `/conversation` | Type `/conversation` | **Full-duplex** — Pi speaks responses aloud and listens for you |

### Conversation Mode (`/conversation`)

Pi speaks its responses aloud using "Samantha" (female American natural voice) and listens simultaneously. You can interact naturally:

- **Speak normally** — Pi listens while it talks, and your speech interrupts it
- **Trigger words** — say `hey`, `silence`, `quiet`, `shut up`, `hold on`, `wait`, or `pause` to silence Pi without sending a message. Pi stays in conversation mode and listens for your next input.
- **Exit** — say `stop`, `exit`, `quit`, `goodbye`, `bye`, or `end` to leave conversation mode

### Leaving Voice or Conversation Mode

Say any of: **"stop"**, **"exit"**, **"quit"**, **"goodbye"**, **"bye"**, **"end"** — the microphone stops and the mode exits.

### Silencing Pi

While Pi is speaking in conversation mode:

| Method | What happens |
|--------|--------------|
| `Ctrl+Shift+C` | Instantly silences Pi, stays in conversation mode, listens for you |
| Say a trigger word | `hey`, `silence`, `quiet`, `shut up`, `hold on`, `wait`, `pause` |
| Say anything else | Pi is interrupted and your speech is sent as a message |

### Testing outside Pi

```bash
./test-dictation.sh
```

Speak a few words — you'll see live transcription. Press Ctrl+C to quit.

## Configuration

### Speech recognition

Edit `dictation-helper/Sources/main.swift`:

| Setting | Default | What it does |
|---------|---------|--------------|
| `timeoutSeconds` | `30` | Max recording seconds before auto-stop |
| `silentTimeout` | `3.0` | Seconds of silence before auto-finish |
| `locale` | `en-US` | Language (e.g. `fr-FR`, `de-DE`) |
| `requiresOnDeviceRecognition` | `false` | Use Apple's cloud servers (`false`) or on-device only (`true`) |

The helper recompiles automatically on next use.

### TTS Voice

Edit `index.ts` and change the `TTS_VOICE` constant near the top:

```ts
// TTS voice — female American natural voice
const TTS_VOICE = "Samantha";
```

To find available voices on your Mac:

```bash
say -v '?'
```

Popular female voices: `Samantha` (American), `Karen` (Australian), `Victoria` (American), `Tessa` (South African), `Moira` (Irish), `Veena` (Indian).

## Troubleshooting

**"Siri is disabled" error**
→ System Settings > Siri > Enable Ask Siri. On-device dictation requires Siri.

**"Speech recognition not authorized"**
→ System Settings > Privacy & Security > Speech Recognition → enable for your terminal app.

**"Failed to start audio engine"**
→ System Settings > Privacy & Security > Microphone → enable for your terminal app.

**Poor transcription quality**
→ System Settings > Keyboard > Dictation → turn ON, enable **"Use Enhanced Dictation"**.
→ Or set `requiresOnDeviceRecognition = false` in `main.swift` to use Apple's servers (needs internet).

**"Swift toolchain not found"**
→ Run `xcode-select --install` in Terminal.

**Dictation hangs**
→ Make sure you're in an interactive terminal session, not SSH.

**TTS audio bleeding into microphone**
→ Use headphones to prevent Pi from hearing its own speech and falsely interrupting.

## How pi-dictation compares to other voice extensions

Pi has **no built-in voice features** — everything is extensions. Before pi-dictation, several community extensions added voice to Pi:

| Extension | STT | TTS | Conversation loop | Cloud-free |
|-----------|-----|-----|-------------------|------------|
| **[picrophone](https://www.npmjs.com/package/picrophone)** | Apple / WhisperKit | ✅ | `/voice` toggle | ✅ (local) |
| **[privateer-speak](https://github.com/privateer-agent/privateer-speak)** | Pluggable providers | ✅ (OS voices) | `/talk loop on` with barge-in | ✅ (with OS voices) |
| **[@codexstar/pi-listen](https://www.npmjs.com/package/@codexstar/pi-listen)** | Deepgram / 19 local models | ✅ | Hold-to-talk | Partially |
| **[pi-talk](https://www.npmjs.com/package/@agustif/pi-talk)** | ❌ | ✅ (streaming) | ❌ | ❌ |
| **[pi-voice-loop](https://www.npmjs.com/package/pi-voice-loop)** | xAI WebSocket | xAI | ✅ (realtime WebSocket) | ❌ (cloud) |
| **pi-dictation** (this) | Apple native | ✅ (`say`) | ✅ (`/conversation`) with trigger-word barge-in | ✅ **100% local, zero deps** |

### What makes pi-dictation different

- **Zero dependencies** — no npm packages for STT, no API keys, no cloud accounts. Uses only `SFSpeechRecognizer` and `say`, both built into macOS.
- **All-local** — speech recognition runs on-device (or Apple's privacy-preserving servers if `requiresOnDeviceRecognition = false`). Nothing leaves your machine to a third party.
- **Trigger-word barge-in** — say "hey", "silence", "quiet", "shut up", "hold on", "wait", or "pause" to silence Pi mid-sentence without sending a message. Stays in conversation mode.
- **Full-duplex** — `/conversation` speaks and listens simultaneously. No push-to-talk required.
- **Native Swift helper** — compiled on your machine with a single `swift build`, no pre-built binaries needed.

## System detection

On startup, pi-dictation prints your detected system configuration so you know what's being used:

```
  M3 Pro (Apple Silicon)  |  macOS 14.6 Sonoma  |  TTS: Samantha
```

It detects:
- **Chip**: `Apple M1`, `Apple M2 Pro`, `Apple M3 Max`, `Intel Core i7`, etc.
- **Architecture**: `Apple Silicon` (arm64) or `Intel` (x64)
- **macOS version**: `12 Monterey`, `13 Ventura`, `14 Sonoma`, `15 Sequoia`, etc.

### Platform-specific behavior

| Feature | Apple Silicon (M1–M4) | Intel |
|---------|----------------------|-------|
| Dictation (SFSpeechRecognizer) | ✅ Full support | ✅ Full support |
| TTS (`say`) | ✅ All voices available | ✅ All voices available |
| On-device recognition | ✅ Fast (Neural Engine) | ✅ Supported (slower) |
| Swift compilation | Native arm64 binary | Native x64 binary |

> **Note:** On-device speech recognition (`requiresOnDeviceRecognition = true`) is only available on macOS 13+ (Ventura). On Monterey (macOS 12), you must use Apple's servers by setting `requiresOnDeviceRecognition = false` in `main.swift`.

## License

MIT
