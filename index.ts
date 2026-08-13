import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { execSync, spawn, type ChildProcess } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import os from "node:os";

// __filename/__dirname are provided by jiti
const EXT_DIR = __dirname;
const HELPER_DIR = join(EXT_DIR, "dictation-helper");

const COMPILED_BIN = join(HELPER_DIR, ".build/release/dictation-helper");

// TTS voice — female American natural voice
const TTS_VOICE = "Samantha";

// ── System detection ────────────────────────────────────────────────

interface SystemInfo {
  chipName: string;       // e.g. "Apple M3 Pro" or "Intel Core i7"
  architecture: string;   // "Apple Silicon" or "Intel"
  archCode: string;       // "arm64" or "x64"
  macOSVersion: string;   // e.g. "14.6"
  macOSName: string;      // e.g. "Sonoma"
}

// Darwin major version → macOS marketing name
const DARWIN_TO_MACOS: Record<number, string> = {
  20: "Big Sur",
  21: "Monterey",
  22: "Ventura",
  23: "Sonoma",
  24: "Sequoia",
  25: "macOS 16",
};

let _systemInfo: SystemInfo | null = null;

function detectSystem(): SystemInfo {
  if (_systemInfo) return _systemInfo;

  const archCode = os.arch(); // "arm64" or "x64"
  const architecture = archCode === "arm64" ? "Apple Silicon" : "Intel";

  // Get CPU brand string
  let chipName = architecture;
  try {
    chipName = execSync("sysctl -n machdep.cpu.brand_string", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "ignore"],
    }).trim();
    // Clean up Intel branding
    if (archCode === "x64") {
      chipName = chipName.replace(/\s+\(R\)/g, "").replace(/\s+CPU\s+@.*$/, "");
      chipName = chipName.replace(/Intel\(R\)/, "Intel");
    }
  } catch { /* fall back to architecture string */ }

  // Get macOS version
  let macOSVersion = "unknown";
  try {
    macOSVersion = execSync("sw_vers -productVersion", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "ignore"],
    }).trim();
  } catch { /* fall back */ }

  // Derive marketing name from Darwin kernel version
  const darwinMajor = parseInt(os.release().split(".")[0], 10);
  const macOSName = DARWIN_TO_MACOS[darwinMajor] ?? `Darwin ${darwinMajor}`;

  _systemInfo = { chipName, architecture, archCode, macOSVersion, macOSName };
  return _systemInfo;
}

function systemInfo(): SystemInfo {
  return _systemInfo ?? detectSystem();
}

// ── Settings: platform auto-detection + user overrides ────────────────

interface DictationSettings {
  silentTimeout: number;   // seconds of silence before auto-finish
  timeoutSeconds: number;  // max recording seconds
  locale: string;          // speech recognition locale
  onDevice: boolean;       // true = on-device, false = Apple servers
}

const CONFIG_PATH = join(os.homedir(), ".pi-dictation.json");

let _settings: DictationSettings | null = null;

/** Read optional user overrides from ~/.pi-dictation.json. */
function loadConfig(): Partial<DictationSettings> {
  try {
    const parsed = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
    const out: Partial<DictationSettings> = {};
    if (typeof parsed.silentTimeout === "number") out.silentTimeout = parsed.silentTimeout;
    if (typeof parsed.timeoutSeconds === "number") out.timeoutSeconds = parsed.timeoutSeconds;
    if (typeof parsed.locale === "string") out.locale = parsed.locale;
    if (typeof parsed.onDevice === "boolean") out.onDevice = parsed.onDevice;
    return out;
  } catch {
    return {}; // no config file, or unreadable/invalid JSON
  }
}

/**
 * Resolve effective settings = platform auto-detection + user overrides.
 * Cached for the session.
 */
function resolveSettings(): DictationSettings {
  if (_settings) return _settings;

  const sys = systemInfo();
  const isIntel = sys.architecture === "Intel";

  const defaults: DictationSettings = {
    // Intel recognition is slower → longer silence grace before auto-finish.
    silentTimeout: isIntel ? 4.0 : 3.0,
    timeoutSeconds: 30.0,
    locale: "en-US",
    // Server-based by default (consistent, works on macOS 12+).
    // Apple Silicon + macOS 13+ users can set "onDevice": true for fully-local.
    onDevice: false,
  };

  _settings = { ...defaults, ...loadConfig() };
  return _settings;
}

/** CLI arguments passed to the Swift helper. */
function dictationArgs(): string[] {
  const s = resolveSettings();
  return [
    "--silent-timeout", String(s.silentTimeout),
    "--timeout", String(s.timeoutSeconds),
    "--locale", s.locale,
    s.onDevice ? "--on-device" : "--server",
  ];
}

/**
 * Build the Swift helper if not already compiled.
 */
function ensureBuilt(): string {
  // Rebuild if the binary is missing OR the Swift source changed since the
  // binary was built. (swift build won't re-run unless we ask it to.)
  const swiftSrc = join(HELPER_DIR, "Sources", "main.swift");
  const isFresh = existsSync(COMPILED_BIN)
    && (!existsSync(swiftSrc) || statSync(swiftSrc).mtimeMs <= statSync(COMPILED_BIN).mtimeMs);
  if (isFresh) {
    return COMPILED_BIN;
  }

  // Check if we have swift available
  try {
    execSync("which swift", { stdio: "pipe" });
  } catch {
    throw new Error(
      "Swift toolchain not found. Install Xcode Command Line Tools:\n  xcode-select --install",
    );
  }

  // Build the helper
  try {
    execSync("swift build -c release --disable-sandbox", {
      cwd: HELPER_DIR,
      stdio: "inherit",
      timeout: 120_000,
    });
  } catch (e) {
    throw new Error(
      `Failed to build dictation helper: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  if (!existsSync(COMPILED_BIN)) {
    throw new Error(`Build succeeded but binary not found at: ${COMPILED_BIN}`);
  }

  return COMPILED_BIN;
}

/**
 * Run dictation and return transcribed text (async, non-blocking).
 */
async function runDictation(binPath: string, signal?: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(binPath, dictationArgs(), {
      stdio: ["inherit", "pipe", "inherit"], // stdin=inherit, stdout=pipe, stderr=inherit
      signal,
    });

    let stdout = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    child.on("error", (err) => {
      if (signal?.aborted) {
        reject(new Error("Dictation cancelled"));
      } else {
        reject(new Error(`Dictation failed: ${err.message}`));
      }
    });

    child.on("close", (code) => {
      if (signal?.aborted) {
        reject(new Error("Dictation cancelled"));
        return;
      }
      if (code !== 0) {
        reject(new Error(`Dictation failed with exit code ${code}`));
        return;
      }
      const text = stdout.trim();
      if (!text) {
        reject(new Error("No speech detected"));
        return;
      }
      resolve(text);
    });
  });
}

export default function (pi: ExtensionAPI) {
  // Voice mode state
  let voiceMode = false;
  let conversationMode = false;
  let dictating = false; // prevent re-entrant dictation
  let lastAssistantText = ""; // accumulated assistant text for TTS
  let currentSayProcess: ChildProcess | null = null; // track TTS process for manual interrupt

  // -------------------------------------------------------------------------
  // Voice-mode safety: while speech input is active, Pi is limited to
  // read-only tools so a misheard command can't modify files or run shell.
  // Fail closed — anything not listed here is blocked.
  // -------------------------------------------------------------------------
  const READONLY_TOOLS = new Set([
    "read",
    "websearch",
    "webfetch",
    "web_search",
    "source_check",
    "fetch_content",
    "get_search_content",
    "dictate",
  ]);
  const voiceActive = () => voiceMode || conversationMode;

  // Block mutating/dangerous tools while voice input is active.
  pi.on("tool_call", async (event) => {
    if (!voiceActive() || READONLY_TOOLS.has(event.toolName)) return;
    return {
      block: true,
      reason:
        `Tool "${event.toolName}" is blocked while voice mode is active (read-only tools only). ` +
        `Ask the user to say "exit" (or type /voicemode or /conversation) to leave voice mode first.`,
    };
  });

  // Prime the model so it avoids mutating tools during voice input.
  pi.on("before_agent_start", async (event) => {
    if (!voiceActive()) return;
    return {
      systemPrompt:
        event.systemPrompt +
        "\n\n[Voice mode] You are receiving speech-to-text input, which can be mis-transcribed. " +
        "Use ONLY read-only tools (read, web search, fetch). Do not modify files or run shell commands. " +
        "If the user requests an action that changes files or runs commands, explain what you would do and ask them to type it instead (or say 'exit' to leave voice mode).",
    };
  });

  // Block typed `!command` shell escapes while voice mode is active.
  pi.on("user_bash", async () => {
    if (!voiceActive()) return;
    return {
      result: {
        output: "Blocked: voice mode is read-only. Type /voicemode or /conversation to leave voice mode first.",
        exitCode: 1,
        cancelled: false,
        truncated: false,
      },
    };
  });

  // Spoken trigger words that silence Pi without sending a message
  const INTERRUPT_TRIGGERS = ["hey", "silence", "quiet", "shut up", "hold on", "wait", "pause"];

  function isInterruptTrigger(text: string): boolean {
    const lower = text.toLowerCase().trim();
    return INTERRUPT_TRIGGERS.some(t => lower === t || lower.startsWith(t + " ") || lower.endsWith(" " + t));
  }

  // Spoken exit words that leave voice/conversation mode.
  const EXIT_WORDS = new Set(["exit", "quit", "stop", "goodbye", "bye", "end"]);

  // Only treat a SHORT utterance containing an exit word as a real exit
  // command. This prevents false exits when the mic picks up Pi's own TTS,
  // which often says "exit"/"stop" inside a longer sentence.
  function isExitCommand(text: string): boolean {
    const tokens = text.toLowerCase().trim().split(/[^a-z]+/).filter(Boolean);
    if (tokens.length === 0 || tokens.length > 4) return false;
    return tokens.some((t) => EXIT_WORDS.has(t));
  }

  // Shared dictation logic — returns transcribed text or null on failure
  async function doDictation(ctx: any): Promise<string | null> {
    const binPath = ensureBuilt();
    const text = await runDictation(binPath, ctx.signal);
    return text || null;
  }

  /**
   * Kill the currently running TTS process (if any).
   */
  function silencePi(): boolean {
    if (currentSayProcess && currentSayProcess.exitCode === null) {
      currentSayProcess.kill("SIGTERM");
      currentSayProcess = null;
      return true;
    }
    return false;
  }

  /**
   * Speak text aloud using macOS built-in `say` command (NSSpeechSynthesizer).
   * Returns the child process so it can be killed for interruption.
   */
  function speakText(text: string, signal?: AbortSignal) {
    const child = spawn("say", ["-v", TTS_VOICE, text], { signal });
    currentSayProcess = child;
    const promise = new Promise<void>((resolve, reject) => {
      child.on("close", (code) => {
        currentSayProcess = null;
        if (code === 0 || signal?.aborted) resolve();
        else reject(new Error(`say exited with code ${code}`));
      });
      child.on("error", (err) => {
        currentSayProcess = null;
        if (signal?.aborted) resolve();
        else reject(err);
      });
    });
    return { process: child, promise };
  }

  // Dictation loop step — listens and sends as user message
  async function dictateAndSend(pi: ExtensionAPI, ctx: any): Promise<void> {
    if (dictating) return;
    dictating = true;
    try {
      ctx.ui.setStatus("dictation", "🎤 Listening... speak now");
      const text = await doDictation(ctx);
      if (text) {
        // Exit voice/conversation mode only on a short, explicit exit command.
        if (isExitCommand(text)) {
          const wasConversation = conversationMode;
          voiceMode = false;
          conversationMode = false;
          ctx.ui.setStatus("dictation", undefined);
          ctx.ui.notify(wasConversation ? "🔇 Conversation mode exited" : "🔇 Voice mode exited", "info");
          return;
        }
        ctx.ui.notify(`📝 Dictated: "${text.slice(0, 80)}${text.length > 80 ? "..." : ""}"`, "info");
        pi.sendUserMessage(text);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Don't stop voice mode on transient errors
      if (msg.includes("cancelled") || msg.includes("aborted")) {
        voiceMode = false;
        conversationMode = false;
        ctx.ui.setStatus("dictation", undefined);
        ctx.ui.notify("🔇 Voice mode cancelled", "info");
        return;
      }
      ctx.ui.setStatus("dictation", "🎤 Voice mode — speak again");
      ctx.ui.notify(`Dictation error: ${msg}`, "error");
    } finally {
      dictating = false;
    }
  }

  // Track assistant text for TTS — clear at turn start, accumulate on message_end
  pi.on("agent_start", async () => {
    lastAssistantText = "";
  });

  pi.on("message_end", async (event) => {
    if (event.message.role === "assistant") {
      const textBlocks = (event.message.content as any[])
        .filter((c: any) => c.type === "text")
        .map((c: any) => c.text)
        .join("\n");
      if (textBlocks) {
        lastAssistantText = textBlocks;
      }
    }
  });

  // When Pi finishes responding, speak + auto-dictate if in conversation mode,
  // or just auto-dictate if in voice mode
  pi.on("agent_settled", async (_event, ctx) => {
    if (dictating) return;

    if (conversationMode && lastAssistantText) {
      const textToSpeak = lastAssistantText;
      lastAssistantText = "";

      // Start speaking and listening simultaneously so the user can interrupt
      ctx.ui.setStatus("dictation", "🔊 Speaking... (speak to interrupt)");

      const { process: sayProcess, promise: sayPromise } = speakText(textToSpeak, ctx.signal);

      // Start dictation in parallel
      let interruptText: string | null = null;
      const dictationPromise = (async () => {
        try {
          const binPath = ensureBuilt();
          interruptText = await runDictation(binPath, ctx.signal);
        } catch {
          // Dictation error — ignore, we'll try again after say finishes
        }
      })();

      // Race: did the user speak before TTS finished?
      let sayFinished = false;
      const sayDone = sayPromise.then(() => { sayFinished = true; }).catch(() => { sayFinished = true; });

      // Poll until either say finishes or dictation gets speech
      while (!sayFinished && interruptText === null) {
        await new Promise(r => setTimeout(r, 150));
        if (sayProcess.exitCode !== null) sayFinished = true;
      }

      if (interruptText !== null && !sayFinished) {
        // User interrupted! Kill TTS and process their speech
        silencePi();
        ctx.ui.setStatus("dictation", undefined);

        const text = interruptText.trim();

        if (isInterruptTrigger(text)) {
          // Trigger word — just silence Pi, stay in conversation mode
          ctx.ui.notify(`🔇 Silenced (trigger: "${text}") — listening...`, "info");
          ctx.ui.setStatus("dictation", "🎤 Conversation — listening...");
          await dictateAndSend(pi, ctx);
        } else if (isExitCommand(text)) {
          conversationMode = false;
          voiceMode = false;
          ctx.ui.notify("🔇 Conversation mode exited", "info");
        } else {
          ctx.ui.notify("⏹️ Interrupted — processing your speech...", "info");
          pi.sendUserMessage(text);
        }
      } else {
        // TTS finished naturally — wait for dictation to complete (if still running)
        // or start a fresh dictation
        if (interruptText !== null) {
          // Dictation also finished during TTS — treat as user input
          const text = interruptText.trim();

          if (isInterruptTrigger(text)) {
            ctx.ui.notify(`🔇 Silenced (trigger: "${text}") — listening...`, "info");
            ctx.ui.setStatus("dictation", "🎤 Conversation — listening...");
            await dictateAndSend(pi, ctx);
          } else if (isExitCommand(text)) {
            conversationMode = false;
            voiceMode = false;
            ctx.ui.notify("🔇 Conversation mode exited", "info");
          } else {
            pi.sendUserMessage(text);
          }
        } else {
          // TTS finished, dictation still listening — let it continue naturally
          // The dictationPromise will eventually resolve and we handle it below
          await dictationPromise;
          if (interruptText) {
            const text = interruptText.trim();

            if (isInterruptTrigger(text)) {
              ctx.ui.setStatus("dictation", undefined);
              ctx.ui.notify(`🔇 Silenced (trigger: "${text}") — listening...`, "info");
              ctx.ui.setStatus("dictation", "🎤 Conversation — listening...");
              await dictateAndSend(pi, ctx);
            } else if (isExitCommand(text)) {
              conversationMode = false;
              voiceMode = false;
              ctx.ui.setStatus("dictation", undefined);
              ctx.ui.notify("🔇 Conversation mode exited", "info");
            } else {
              ctx.ui.setStatus("dictation", undefined);
              pi.sendUserMessage(text);
            }
          } else {
            // Dictation timed out — go again
            ctx.ui.setStatus("dictation", "🎤 Conversation — listening...");
            await dictateAndSend(pi, ctx);
          }
        }
      }
    } else if (voiceMode) {
      await dictateAndSend(pi, ctx);
    }
  });

  // Register command: /dictate
  pi.registerCommand("dictate", {
    description: "Start speech dictation and send transcribed text as input",
    handler: async (_args, ctx) => {
      try {
        ctx.ui.setStatus("dictation", "🎤 Building dictation helper...");
        const binPath = ensureBuilt();

        ctx.ui.setStatus("dictation", "🎤 Listening... speak now");

        const text = await runDictation(binPath, ctx.signal);

        if (text) {
          ctx.ui.notify(`📝 Dictated: "${text.slice(0, 80)}${text.length > 80 ? "..." : ""}"`, "info");
          pi.sendUserMessage(text);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        ctx.ui.notify(msg, "error");
      } finally {
        ctx.ui.setStatus("dictation", undefined);
      }
    },
  });

  // Register command: /voicemode — continuous dictation loop (input only)
  pi.registerCommand("voicemode", {
    description: "Toggle continuous voice mode — Pi listens after each response",
    handler: async (_args, ctx) => {
      conversationMode = false;
      voiceMode = !voiceMode;
      if (voiceMode) {
        ctx.ui.notify("🔊 Voice mode ON — speak now (read-only tools while active). Say 'exit' or 'stop' to leave.", "info");
        ctx.ui.setStatus("dictation", "🎤 Voice mode — listening...");
        await dictateAndSend(pi, ctx);
      } else {
        ctx.ui.setStatus("dictation", undefined);
        ctx.ui.notify("🔇 Voice mode OFF", "info");
      }
    },
  });

  // Register command: /conversation — full-duplex voice with TTS spoken responses
  pi.registerCommand("conversation", {
    description: "Toggle full voice conversation — Pi speaks responses aloud and listens for you",
    handler: async (_args, ctx) => {
      voiceMode = false;
      conversationMode = !conversationMode;
      if (conversationMode) {
        ctx.ui.notify("🔊 Conversation mode ON — Pi will speak aloud (read-only tools while active). Say 'exit' to stop.", "info");
        ctx.ui.setStatus("dictation", "🎤 Conversation — listening...");
        await dictateAndSend(pi, ctx);
      } else {
        ctx.ui.setStatus("dictation", undefined);
        ctx.ui.notify("🔇 Conversation mode OFF", "info");
      }
    },
  });

  // Register dictation tool for the LLM to call
  pi.registerTool({
    name: "dictate",
    label: "Dictate",
    description:
      "Listen to the user's speech via the microphone and return the transcribed text. Use this when the user wants to dictate instead of type, or says 'dictate', 'voice input', 'speech to text', etc.",
    promptSnippet: "Capture speech input from the microphone and return transcribed text",
    promptGuidelines: [
      "Use dictate when the user wants to speak instead of type, mentions dictation, or says things like 'let me dictate' or 'voice input'.",
    ],
    parameters: Type.Object({}),
    async execute(_toolCallId, _params, signal, _onUpdate, ctx) {
      try {
        const binPath = ensureBuilt();
        const text = await runDictation(binPath, signal);

        return {
          content: [
            {
              type: "text",
              text: `User dictated: "${text}"`,
            },
          ],
          details: { transcribedText: text },
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          content: [{ type: "text", text: `Dictation failed: ${msg}` }],
          details: { error: msg },
          isError: true,
        };
      }
    },
  });

  // Register keyboard shortcut (Ctrl+Shift+C) — silence Pi in conversation mode
  pi.registerShortcut("ctrl+shift+c", {
    description: "Silence Pi's speech",
    handler: async (ctx) => {
      if (silencePi()) {
        ctx.ui.notify("🔇 Silenced — listening...", "info");
        ctx.ui.setStatus("dictation", "🎤 Conversation — listening...");
        // Restart dictation loop
        await dictateAndSend(pi, ctx);
      } else {
        ctx.ui.notify("Nothing to silence — Pi is not speaking", "info");
      }
    },
  });

  // Register keyboard shortcut (Ctrl+Shift+D)
  pi.registerShortcut("ctrl+shift+d", {
    description: "Start dictation",
    handler: async (ctx) => {
      // Reuse the command handler logic
      try {
        ctx.ui.setStatus("dictation", "🎤 Building dictation helper...");
        const binPath = ensureBuilt();

        ctx.ui.setStatus("dictation", "🎤 Listening... speak now");

        const text = await runDictation(binPath, ctx.signal);

        if (text) {
          ctx.ui.notify(`📝 Dictated: "${text.slice(0, 80)}${text.length > 80 ? "..." : ""}"`, "info");
          pi.sendUserMessage(text);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        ctx.ui.notify(msg, "error");
      } finally {
        ctx.ui.setStatus("dictation", undefined);
      }
    },
  });

  // Detect system on load
  const sys = detectSystem();

  // Notify on session start
  pi.on("session_start", async (_event, ctx) => {
    ctx.ui.notify(
      `${sys.chipName} (${sys.architecture})  |  macOS ${sys.macOSVersion} ${sys.macOSName}  |  TTS: ${TTS_VOICE}`,
      "info",
    );
    ctx.ui.notify(
      "Dictation loaded — /dictate, Ctrl+Shift+D, /voicemode, /conversation. Say 'hey' or Ctrl+Shift+C to silence Pi",
      "info",
    );
  });

}
