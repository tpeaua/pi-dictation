# Pi Dictation 🎤

Speech-to-text dictation extension for [Pi](https://github.com/earendil-works/pi-mono) on macOS. Speak naturally and Pi will transcribe your speech and use it as input.

## 🚀 Quick Install (one command)

```bash
chmod +x install.sh && ./install.sh
```

Then grant macOS permissions when prompted (Microphone + Speech Recognition for your terminal app, plus enable Siri).

That's it. Run `pi`, type `/dictate` and start speaking.

---

## Features

- **`/dictate` command** — type `/dictate` in Pi to start dictation
- **`/voicemode` command** — continuous voice conversation mode; Pi listens after each response
- **`Ctrl+Shift+D` shortcut** — quick keyboard shortcut to trigger dictation
- **`dictate` tool** — the LLM can call dictation itself (e.g., "let me dictate my response")
- **Native macOS Speech recognition** — uses Apple's `SFSpeechRecognizer` for high-quality transcription
- **Real-time feedback** — see partial transcription live as you speak
- **Auto-finish** — stops automatically after 3 seconds of silence
- **Instant abort** — toggling voicemode off immediately kills the mic (no lingering orange dot)

## Requirements

- macOS 12 (Monterey) or later (Apple Silicon or Intel)
- Xcode Command Line Tools (`xcode-select --install`)
- Siri enabled (System Settings > Siri)
- Pi coding agent (`npm install -g --ignore-scripts @earendil-works/pi-coding-agent`)

## Manual Install

### Option 1: Global (all projects)

```bash
ln -s "$(pwd)" ~/.pi/agent/extensions/dictation
```

### Option 2: Per-project

```bash
mkdir -p .pi/extensions
ln -s /path/to/pi-dictation .pi/extensions/dictation
```

## macOS Permissions

On first use, grant in **System Settings > Privacy & Security**:
- **Microphone** → enable for your terminal app
- **Speech Recognition** → enable for your terminal app
- **Siri** → enable Ask Siri (required for on-device dictation)

## Usage

| Method | How | Best for |
|--------|-----|----------|
| `/dictate` | Type `/dictate` in the Pi editor | One-off dictation |
| `Ctrl+Shift+D` | Press the keyboard shortcut | Quick access without typing |
| `/voicemode` | Type `/voicemode` | Continuous conversation |
| Ask the LLM | Say "let me dictate" or "voice input" | Hands-free trigger |

Say **"exit"**, **"stop"**, or **"goodbye"** to leave voice mode.

## Project Structure

```
PI_Dictation/
├── index.ts              # Pi extension (registers /dictate, dictation tool, shortcut)
├── dictation-helper/     # Swift speech-to-text helper
│   ├── Package.swift     # Swift package manifest
│   └── Sources/
│       └── main.swift    # Speech recognition using SFSpeechRecognizer
├── package.json          # Pi package metadata
├── test-dictation.sh     # Test dictation standalone (outside Pi)
└── README.md
```

## Testing Outside Pi

```bash
./test-dictation.sh
```

Speak a few words and the transcribed text will be printed to stdout.

## Configuration

Edit `dictation-helper/Sources/main.swift` to customize:

| Setting | Default | Description |
|---------|---------|-------------|
| `timeoutSeconds` | `30` | Max recording duration |
| `silentTimeout` | `3.0` | Seconds of silence before auto-finishing |
| `locale` | `en-US` | Speech recognition locale (change for other languages) |

## How It Works

1. Pi extension registers `/dictate` command, `/voicemode` command, `Ctrl+Shift+D` shortcut, and `dictate` tool
2. When triggered, it spawns a Swift helper binary that:
   - Requests microphone access (if not already granted)
   - Starts `SFSpeechRecognizer` with the `.dictation` task hint
   - Streams partial results to stderr in real-time
   - Detects silence and auto-finishes
   - Prints final transcription to stdout
3. The extension reads the transcribed text and sends it to Pi via `pi.sendUserMessage()`

## Development Status

### Completed

- [x] Swift speech-to-text helper using native `SFSpeechRecognizer`
- [x] Auto-build on first use via `swift build`
- [x] Real-time partial transcription on stderr
- [x] Silence detection — auto-finishes after 3 seconds of silence
- [x] Timeout — stops recording after 30 seconds
- [x] `/dictate` slash command for triggering from Pi
- [x] `Ctrl+Shift+D` keyboard shortcut
- [x] `dictate` tool callable by the LLM
- [x] Standalone testing script (`test-dictation.sh`)
- [x] Error handling for missing permissions, unavailable microphone, no speech
- [x] Status bar UX — shows "Building..." then "Listening..." during dictation (fixed 2025-08-11)
- [x] Abort signal support — Esc cancels in-progress dictation
- [x] `/voicemode` — continuous voice conversation with auto-listen after each response (2025-08-11)
- [x] Run loop fix — SFSpeechRecognitionTask callbacks now delivered correctly (2025-08-11)
- [x] Audio format conversion — native Float32 converted to 16kHz Int16 for reliable recognition (2025-08-11)

### In Progress / Planned

- [ ] Pre-compiled binary distribution (skip Swift build on first use)
- [ ] Configurable locale from Pi settings (currently hardcoded to `en-US`)
- [ ] Configurable timeout and silence duration from extension config
- [ ] Audio level indicator in the status bar while listening
- [ ] Support for additional languages/locales at runtime
- [ ] Fix /voicemode reliability issues (timing, missed speech, getting stuck)
- [ ] CI/CD pipeline for automated builds

### Known Limitations

- **macOS only** — relies on `SFSpeechRecognizer` and `AVAudioEngine`
- **First-use latency** — Swift compilation takes ~5 seconds if the helper hasn't been built yet
- **Single locale** — currently hardcoded to `en-US`; changing it requires editing `main.swift`
- **Pi TUI only** — dictation requires an interactive terminal session
- ⚠️ **/voicemode is flaky** — the continuous conversation loop has timing issues and needs work; one-off `/dictate` is the reliable path for now

### Recent Changes

**2025-08-11** — Major fixes and new features:
- **Run loop fix**: The polling loop used `usleep()` which blocked the main run loop, preventing `SFSpeechRecognitionTask` callbacks from being delivered. Fixed by using `RunLoop.current.run(until:)`.
- **Task ordering**: Recognition task is now created before the audio engine starts, so buffers are consumed from the beginning.
- **Audio format conversion**: Added `AVAudioConverter` to convert from native Float32 non-interleaved to 16kHz mono Int16 for reliable speech recognition.
- **`/voicemode`**: New continuous voice conversation mode. Pi auto-listens after each response until you say "exit" or "stop".
- **Silence timeout**: Adjusted from 2s to 3s for more natural pauses.
- **Better error messages**: Clear guidance when Siri is disabled or permissions are missing.

## Troubleshooting

**"Siri is disabled" (kLSRErrorDomain error 201)**
→ Enable Siri: **System Preferences > Siri > Enable Ask Siri**. On-device dictation requires Siri to be enabled at the system level.

**Poor transcription quality**
→ Enable Enhanced Dictation: **System Preferences > Keyboard > Dictation > On**, and check **"Use Enhanced Dictation"**. This downloads a local language model that improves accuracy.
→ Alternatively, set `requiresOnDeviceRecognition = false` in `main.swift` to use Apple's cloud servers (requires internet).

**"Speech recognition not authorized"**
→ Go to System Settings > Privacy & Security > Speech Recognition and enable for your terminal app.

**"Failed to start audio engine"**
→ Ensure microphone access is granted in System Settings > Privacy & Security > Microphone.

**"Swift toolchain not found"**
→ Install Xcode Command Line Tools: `xcode-select --install`

**Dictation hangs / no output**
→ Make sure you're running in an interactive terminal (Pi TUI mode). Dictation requires microphone access which may not be available in SSH or background sessions.

## License

MIT
