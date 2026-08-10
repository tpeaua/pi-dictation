import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { execSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

// __filename/__dirname are provided by jiti
const EXT_DIR = __dirname;
const HELPER_DIR = join(EXT_DIR, "dictation-helper");

const COMPILED_BIN = join(HELPER_DIR, ".build/release/dictation-helper");

/**
 * Build the Swift helper if not already compiled.
 */
function ensureBuilt(): string {
  // Check for pre-compiled binary
  if (existsSync(COMPILED_BIN)) {
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
    const child = spawn(binPath, [], {
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
  let dictating = false; // prevent re-entrant dictation
  let currentAbortController: AbortController | null = null; // track running dictation for cancellation

  // Shared dictation logic — returns transcribed text or null on failure
  async function doDictation(signal: AbortSignal): Promise<string | null> {
    const binPath = ensureBuilt();
    const text = await runDictation(binPath, signal);
    return text || null;
  }

  // Check if the user said an exit phrase
  const EXIT_PHRASES = [
    "stop voice", "exit voice", "end voice", "quit voice",
    "stop dictation", "exit dictation", "end dictation", "quit dictation",
    "dictation stop", "dictation off", "dictation end",
    "voice stop", "voice off", "voice end",
    "stop listening", "listening off", "stop recording",
    "roger dictation stop",
    "turn off mic", "turn off microphone", "disable mic", "disable microphone",
    "stop mic", "mute mic", "kill mic",
    "privacy mode", "privacy",
    "shut down", "shut up",
  ];
  const EXIT_WORDS = ["stop", "exit", "quit", "goodbye", "bye", "end"];

  function isExitPhrase(text: string): boolean {
    const lower = text.toLowerCase().trim();

    // "roger dictation stop" — kill everything and exit
    if (lower.includes("roger dictation stop")) {
      killAllHelpers();
      return true;
    }

    // Exact single word match
    if (EXIT_WORDS.includes(lower)) return true;

    // Contains an exit phrase like "stop voice mode"
    if (EXIT_PHRASES.some((p) => lower.includes(p))) return true;

    // Starts with an exit word (e.g. "stop please", "exit voice mode")
    if (EXIT_WORDS.some((w) => lower.startsWith(w + " "))) return true;

    // Ends with an exit word (e.g. "please stop", "ok goodbye")
    if (EXIT_WORDS.some((w) => lower.endsWith(" " + w))) return true;

    return false;
  }

  // Stop any running dictation immediately (abort + killall)
  function abortDictation(): void {
    if (currentAbortController) {
      currentAbortController.abort();
      currentAbortController = null;
    }
    killAllHelpers();
  }

  // Nuke any lingering dictation-helper processes
  function killAllHelpers(): void {
    try {
      execSync("pkill -f dictation-helper", { stdio: "ignore" });
    } catch {
      // pkill returns non-zero if no processes matched — ignore
    }
  }

  // Dictation loop step — listens and sends as user message
  async function dictateAndSend(pi: ExtensionAPI, ctx: any): Promise<void> {
    if (dictating) return;
    dictating = true;

    // Create a fresh AbortController so we can cancel mid-dictation
    currentAbortController = new AbortController();
    try {
      ctx.ui.setStatus("dictation", "🎤 Listening... speak now");
      const text = await doDictation(currentAbortController.signal);
      if (text) {
        // Exit voice mode on these phrases
        if (isExitPhrase(text)) {
          voiceMode = false;
          ctx.ui.setStatus("dictation", undefined);
          ctx.ui.notify("🔇 Voice mode exited", "info");
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
        ctx.ui.setStatus("dictation", undefined);
        ctx.ui.notify("🔇 Voice mode cancelled", "info");
        return;
      }
      ctx.ui.setStatus("dictation", "🎤 Voice mode — speak again");
      ctx.ui.notify(`Dictation error: ${msg}`, "error");
    } finally {
      dictating = false;
      currentAbortController = null;
    }
  }

  // When Pi finishes responding, auto-dictate if in voice mode
  pi.on("agent_settled", async (_event, ctx) => {
    if (!voiceMode || dictating) return;
    // Small delay to let Pi's UI settle before starting dictation
    await new Promise((r) => setTimeout(r, 500));
    await dictateAndSend(pi, ctx);
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

  // Register command: /voicemode — continuous dictation loop
  pi.registerCommand("voicemode", {
    description: "Toggle continuous voice mode — Pi listens after each response",
    handler: async (_args, ctx) => {
      voiceMode = !voiceMode;
      if (voiceMode) {
        ctx.ui.notify("🔊 Voice mode ON — speak now. Say 'roger dictation stop' or 'stop' to leave.", "info");
        ctx.ui.setStatus("dictation", "🎤 Voice mode — listening...");
        await dictateAndSend(pi, ctx);
      } else {
        abortDictation();
        ctx.ui.setStatus("dictation", undefined);
        ctx.ui.notify("🔇 Voice mode OFF", "info");
      }
    },
  });

  // Register dictation tool for the LLM to call
  pi.registerTool({
    name: "dictate",
    label: "Dictate",
    description:
      "Listen to the user's speech via the microphone and return the transcribed text. Use this when the user wants to dictate instead of type, or says 'dictate', 'voice input', 'speech to text', etc. After a successful dictation, voice mode is automatically enabled so the conversation continues without the user needing to re-trigger dictation.",
    promptSnippet: "Capture speech input from the microphone and return transcribed text",
    promptGuidelines: [
      "Use dictate when the user wants to speak instead of type, mentions dictation, or says things like 'let me dictate' or 'voice input'.",
      "After a successful dictation, let the user know they can keep dictating — voice mode is on.",
      "If the user says 'roger dictation stop', 'exit', 'stop', 'goodbye', or 'end dictation', voice mode will stop.",
    ],
    parameters: Type.Object({}),
    async execute(_toolCallId, _params, signal, _onUpdate, ctx) {
      try {
        const binPath = ensureBuilt();
        const text = await runDictation(binPath, signal);

        // Exit voice mode on these phrases
        if (isExitPhrase(text)) {
          voiceMode = false;
          ctx.ui.setStatus("dictation", undefined);
          return {
            content: [
              {
                type: "text",
                text: `User dictated: "${text}". Voice mode has been exited.`,
              },
            ],
            details: { transcribedText: text, voiceModeExited: true },
          };
        }

        // Auto-enable voice mode so conversation continues
        if (!voiceMode) {
          voiceMode = true;
          ctx.ui.setStatus("dictation", "🎤 Voice mode — auto-continue");
        }

        return {
          content: [
            {
              type: "text",
              text: `User dictated: "${text}"`,
            },
          ],
          details: { transcribedText: text, voiceModeActive: true },
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

  // Notify on session start
  pi.on("session_start", async (_event, ctx) => {
    ctx.ui.notify(
      "Dictation loaded — /dictate, Ctrl+Shift+D, or /voicemode for continuous mode",
      "info",
    );
  });
}
