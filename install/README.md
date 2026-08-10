# 🎤 Pi Dictation — Installation & User Guide

> Speak instead of type. Native macOS speech-to-text inside Pi.

---

## What is this?

A dictation extension for the [Pi coding agent](https://github.com/earendil-works/pi-mono). It lets you talk to Pi using your Mac's built-in speech recognition — no cloud services, no accounts, no internet required. Everything runs locally on your machine.

You can dictate one-off messages or enter **voice mode** where Pi listens after every response, so you can have a full conversation without touching the keyboard.

---

## What you get

| Feature | How |
|---------|-----|
| `/dictate` | One-shot dictation — speak, it transcribes, sends to Pi |
| `/voicemode` | Continuous conversation — Pi re-listens after each reply |
| `Ctrl+Shift+D` | Keyboard shortcut to start dictating instantly |
| "let me dictate" | Just tell the LLM you want to dictate and it triggers for you |

Say **"exit"**, **"stop"**, or **"goodbye"** any time to leave voice mode. The microphone stops immediately — no lingering orange dot.

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

You should see this on startup:

```
Dictation loaded — /dictate, Ctrl+Shift+D, or /voicemode for continuous mode
```

### One-off dictation

Type `/dictate` and press Enter. You'll see `🎤 Listening... speak now`. Speak naturally, pause for 3 seconds, and your words are sent to Pi.

### Continuous voice mode

Type `/voicemode` and press Enter. Pi listens, you speak, Pi responds, then Pi listens again — hands-free conversation.

To exit voice mode: say **"exit"**, **"stop"**, or **"goodbye"**. Or type `/voicemode` again. The mic stops instantly.

### Keyboard shortcut

Press `Ctrl+Shift+D` anytime to start dictating.

### Let the LLM trigger it

Just say something like *"let me dictate my response"* — the LLM knows how to call the dictation tool.

---

## How it works (the short version)

1. The extension registers commands, shortcuts, and a tool inside Pi
2. When triggered, Pi spawns a tiny Swift program that uses Apple's `SFSpeechRecognizer`
3. The Swift helper shows partial transcription in real-time as you speak
4. After 3 seconds of silence (or 30 seconds max), it prints the final text
5. Pi reads that text and sends it as if you typed it

The Swift helper compiles once on first run (~10 seconds). After that it's instant.

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

Edit `dictation-helper/Sources/main.swift`:

| Setting | Default | What it does |
|---------|---------|--------------|
| `timeoutSeconds` | `30` | Max recording seconds before auto-stop |
| `silentTimeout` | `3.0` | Seconds of silence before auto-finish |
| `locale` | `en-US` | Speech recognition language (e.g. `fr-FR`, `de-DE`) |

Changes take effect next time you dictate — no rebuild needed, it recompiles automatically.

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
├── README.md                # Quick reference
└── install/
    └── README.md            # ← this file (full guide)
```
