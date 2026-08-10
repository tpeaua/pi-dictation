# Pi Dictation — Installation Guide for Mac 🎤

How to install the Pi dictation extension on Apple Silicon and Intel Macs.

## Prerequisites

This extension is built for macOS 12 (Monterey) or later. Works on M1/M2/M3/M4 and Intel Macs.

**What you'll need:**

| Requirement | How to get it |
|-------------|--------------|
| **macOS 12 (Monterey) or later** | System Settings > Software Update |
| **Node.js + npm** | `brew install node` (Homebrew) **or** `sudo port install nodejs` (MacPorts) |
| **Pi coding agent** | `npm install -g --ignore-scripts @earendil-works/pi-coding-agent` |
| **Xcode Command Line Tools** | `xcode-select --install` |
| **Siri enabled** (for on-device dictation) | System Settings > Siri > Enable |

> **Package manager:** M1/M2/M3 MacBooks typically use [Homebrew](https://brew.sh) (`brew`). Some iMac setups use [MacPorts](https://www.macports.org) (`port`). Adjust the Node.js install command to match. If you already have Node.js from either manager, skip that step.

To verify everything is ready:

```bash
# Check Pi is installed
pi --version

# Check Swift toolchain
swift --version
# Should show: swift-driver version: 1.x.x Apple Swift version 5.x.x
```

---

## Step 1: Get the extension

**Option A — Clone from git (recommended):**

```bash
git clone <repo-url> ~/pi-dictation
```

**Option B — Download and extract a zip:**

Unzip the extension to a location of your choice, e.g., `~/pi-dictation`.

**Option C — Copy from an existing install:**

```bash
cp -r /path/to/PI_Dictation ~/pi-dictation
```

---

## Step 2: Install for one project (local)

Inside your project directory, create a symlink:

```bash
cd ~/my-project
mkdir -p .pi/extensions
ln -s ~/pi-dictation .pi/extensions/dictation
```

Or copy the extension directly:

```bash
cp -r ~/pi-dictation .pi/extensions/dictation
```

---

## Step 3 (alternative): Install globally (all projects)

```bash
mkdir -p ~/.pi/agent/extensions
ln -s ~/pi-dictation ~/.pi/agent/extensions/dictation
```

---

## Step 4: Grant macOS permissions

On **first use**, macOS will prompt for two permissions. You must grant both:

1. **Microphone Access** — so the Swift helper can capture your voice
2. **Speech Recognition** — so Apple's `SFSpeechRecognizer` can transcribe

If you miss the prompts, go to **System Settings > Privacy & Security**:
- **Microphone** → enable for your terminal app (Terminal.app, iTerm, Warp, etc.)
- **Speech Recognition** → enable for your terminal app

> **Important:** Siri must be enabled for on-device dictation to work. Go to **System Settings > Siri > Enable Ask Siri**. Without this, you'll get a "Siri is disabled" error.

---

## Step 5: Verify it works

Test the Swift helper standalone:

```bash
cd ~/pi-dictation
./test-dictation.sh
```

Speak a few words — you should see real-time transcription on screen. Press Ctrl+C to exit.

---

## Step 6: Launch Pi with the extension

If you installed locally (Step 2):

```bash
cd ~/my-project
pi
```

If you installed globally (Step 3), just run `pi` from anywhere.

On startup, you should see:

```
Dictation loaded — /dictate, Ctrl+Shift+D, or /voicemode for continuous mode
```

---

## Step 7: Start dictating

Inside Pi, you have four ways to trigger dictation:

| Method | How | Best for |
|--------|-----|----------|
| `/dictate` | Type `/dictate` in the Pi editor | One-off dictation |
| `Ctrl+Shift+D` | Press the keyboard shortcut | Quick access without typing |
| `/voicemode` | Type `/voicemode` | Continuous conversation ⚠️ *experimental* |
| Ask the LLM | Say "let me dictate" or "voice input" | Hands-free trigger |

**How it works:**

1. The Swift helper compiles automatically on first use (~5 seconds)
2. You'll see `🎤 Listening... (speak now)` on screen
3. Speak naturally — partial transcription appears in real-time
4. Stop speaking for 3 seconds — dictation auto-finishes
5. Your transcribed text is sent to Pi as if you typed it

> **First-use note:** The Swift helper compiles from source on first run (~5 seconds). Subsequent uses are instant since the binary is cached at `dictation-helper/.build/release/dictation-helper`.

### `/voicemode` caveats

For `/voicemode`, Pi will keep listening after each response. Say **"exit"**, **"stop"**, or **"goodbye"** to leave voice mode.

> ⚠️ **/voicemode is experimental.** The continuous conversation loop is not working perfectly — it can have timing issues, may miss speech, or get stuck waiting. Use `/dictate` for reliable one-off dictation while `/voicemode` is being improved.

---

## Configuration

Edit `dictation-helper/Sources/main.swift` to customize:

| Setting | Default | Description |
|---------|---------|-------------|
| `timeoutSeconds` | `30` | Max recording duration |
| `silentTimeout` | `3.0` | Seconds of silence before auto-finishing |
| `locale` | `en-US` | Speech recognition locale (change for other languages) |

---

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

---

## Project Structure (for reference)

```
PI_Dictation/
├── index.ts              # Pi extension (registers /dictate, voicemode, shortcut, tool)
├── dictation-helper/     # Swift speech-to-text helper
│   ├── Package.swift     # Swift package manifest
│   └── Sources/
│       └── main.swift    # Speech recognition using SFSpeechRecognizer
├── package.json          # Pi package metadata
├── test-dictation.sh     # Test dictation standalone (outside Pi)
└── README.md
```
