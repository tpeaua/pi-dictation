# Pi Dictation 🎤

> Speak instead of type — native macOS speech-to-text inside the [Pi coding agent](https://github.com/earendil-works/pi-mono).

No cloud services, no accounts needed. Everything runs locally on your Mac using Apple's built-in speech recognition.

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
Dictation loaded — /dictate, Ctrl+Shift+D, or /voicemode for continuous mode
```

| Method | How | Best for |
|--------|-----|----------|
| `/dictate` | Type `/dictate` and speak | One-off dictation |
| `Ctrl+Shift+D` | Press the keyboard shortcut | Quick access |
| `/voicemode` | Type `/voicemode` | Continuous conversation — Pi re-listens after each reply |
| "let me dictate" | Tell the LLM you want to speak | Hands-free trigger |

### Leaving voice mode

Say any of: **"stop"**, **"exit"**, **"goodbye"**, **"end dictation"** — the microphone stops immediately.

Or say **"roger dictation stop"** to force-kill everything.

### Testing outside Pi

```bash
./test-dictation.sh
```

Speak a few words — you'll see live transcription. Press Ctrl+C to quit.

## Configuration

Edit `dictation-helper/Sources/main.swift`:

| Setting | Default | What it does |
|---------|---------|--------------|
| `timeoutSeconds` | `30` | Max recording seconds before auto-stop |
| `silentTimeout` | `3.0` | Seconds of silence before auto-finish |
| `locale` | `en-US` | Language (e.g. `fr-FR`, `de-DE`) |
| `requiresOnDeviceRecognition` | `false` | Use Apple's cloud servers (`false`) or on-device only (`true`) |

The helper recompiles automatically on next use.

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

## License

MIT
