import Speech
import Foundation

// MARK: - Configuration
// Defaults are overridden by command-line arguments passed by the Pi extension,
// which auto-detects the platform and merges user config from ~/.pi-dictation.json.
var timeoutSeconds: TimeInterval = 30.0
var silentTimeout: TimeInterval = 10.0
var locale = Locale(identifier: "en-US")
var onDevice = false

let rawArgs = CommandLine.arguments
var argIndex = 1
while argIndex < rawArgs.count {
    switch rawArgs[argIndex] {
    case "--silent-timeout":
        if argIndex + 1 < rawArgs.count, let v = Double(rawArgs[argIndex + 1]) { silentTimeout = v; argIndex += 1 }
    case "--timeout":
        if argIndex + 1 < rawArgs.count, let v = Double(rawArgs[argIndex + 1]) { timeoutSeconds = v; argIndex += 1 }
    case "--locale":
        if argIndex + 1 < rawArgs.count { locale = Locale(identifier: rawArgs[argIndex + 1]); argIndex += 1 }
    case "--on-device":
        onDevice = true
    case "--server":
        onDevice = false
    default:
        break
    }
    argIndex += 1
}

// Check authorization
let authStatus = SFSpeechRecognizer.authorizationStatus()
switch authStatus {
case .authorized:
    break
case .notDetermined:
    let semaphore = DispatchSemaphore(value: 0)
    var granted = false
    SFSpeechRecognizer.requestAuthorization { status in
        granted = (status == .authorized)
        semaphore.signal()
    }
    semaphore.wait()
    if !granted {
        fputs("Speech recognition not authorized. Grant permission in System Settings > Privacy & Security > Speech Recognition.\n", stderr)
        exit(1)
    }
case .denied, .restricted:
    fputs("Speech recognition not authorized. Grant permission in System Settings > Privacy & Security > Speech Recognition.\n", stderr)
    exit(1)
@unknown default:
    fputs("Unknown authorization status.\n", stderr)
    exit(1)
}

guard let recognizer = SFSpeechRecognizer(locale: locale) else {
    fputs("Speech recognizer not available for locale \(locale.identifier).\n", stderr)
    exit(1)
}

recognizer.defaultTaskHint = .dictation

// Set up audio engine
let audioEngine = AVAudioEngine()
let inputNode = audioEngine.inputNode
let recordingFormat = inputNode.outputFormat(forBus: 0)

// Create recognition request
let recognitionRequest = SFSpeechAudioBufferRecognitionRequest()
recognitionRequest.shouldReportPartialResults = true
recognitionRequest.requiresOnDeviceRecognition = onDevice
recognitionRequest.taskHint = .dictation

// Install tap — feed native audio directly to recognizer
inputNode.installTap(onBus: 0, bufferSize: 1024, format: recordingFormat) { buffer, _ in
    recognitionRequest.append(buffer)
}

// Track timing for silence detection
let startTime = Date()
var lastPartialTime = Date()
let lock = NSLock()
var latestPartial = ""
var finished = false

// Start recognition task BEFORE starting audio engine so it can consume buffers
let task = recognizer.recognitionTask(with: recognitionRequest) { result, error in
    lock.lock()
    defer { lock.unlock() }

    if let error = error {
        let nsError = error as NSError
        if nsError.domain == "kLSRErrorDomain" && nsError.code == 201 {
            fputs("\n⚠️  Siri is disabled. To use on-device dictation, enable it in:\n", stderr)
            fputs("   System Preferences > Siri > Enable Ask Siri\n", stderr)
            fputs("   Or run with --server (or set \"onDevice\": false in ~/.pi-dictation.json).\n", stderr)
        } else if nsError.domain == "kAFAssistantErrorDomain" && nsError.code == 203 {
            // Benign error that occurs when recognition finishes — ignore
        } else {
            fputs("\nRecognition error: \(error.localizedDescription)\n", stderr)
        }
    }

    if let result = result {
        let text = result.bestTranscription.formattedString.trimmingCharacters(in: .whitespacesAndNewlines)
        if !text.isEmpty {
            latestPartial = text
            lastPartialTime = Date()

            // Show partial results in real time on stderr
            fputs("\r→ \(text)", stderr)
            fflush(stderr)
        }
    }

    if error != nil || (result?.isFinal ?? false) {
        finished = true
    }
}

// Now start audio engine AFTER recognition task is ready
do {
    try audioEngine.start()
} catch {
    let msg = error.localizedDescription
    if msg.contains("microphone") || msg.contains("input") || msg.contains("permission") {
        fputs("🎤 Microphone access denied. Grant permission in System Settings > Privacy & Security > Microphone.\n", stderr)
    } else {
        fputs("Failed to start audio engine: \(msg)\n", stderr)
    }
    exit(1)
}

fputs("🎤 Listening... (speak now)\n", stderr)

// Clean shutdown on SIGTERM/SIGINT (e.g. user toggles voicemode off)
let cleanup = {
    audioEngine.stop()
    inputNode.removeTap(onBus: 0)
    recognitionRequest.endAudio()
    task.finish()
    finished = true
}
signal(SIGTERM) { _ in cleanup(); exit(0) }
signal(SIGINT) { _ in cleanup(); exit(0) }

// Poll for silence/timeout while pumping the run loop (required for SFSpeechRecognitionTask callbacks)
let pollInterval: TimeInterval = 0.15
while !finished {
    // Run the run loop to allow recognition callbacks to be delivered
    RunLoop.current.run(until: Date(timeIntervalSinceNow: pollInterval))

    lock.lock()
    let partial = latestPartial
    let lastTime = lastPartialTime
    lock.unlock()

    let elapsed = Date().timeIntervalSince(startTime)
    let silentFor = Date().timeIntervalSince(lastTime)

    if elapsed > timeoutSeconds {
        fputs("\n\n⏰ Timeout reached.\n", stderr)
        task.finish()
        break
    }

    // Only apply silence timeout if we have some text already
    if !partial.isEmpty && silentFor > silentTimeout {
        fputs("\n\n✅ Silence detected, finishing.\n", stderr)
        task.finish()
        break
    }
}

// Run loop a bit more for finalization
RunLoop.current.run(until: Date(timeIntervalSinceNow: 0.3))

// Stop audio
audioEngine.stop()
inputNode.removeTap(onBus: 0)

// Output final text
fputs("\n", stderr)
lock.lock()
let finalText = latestPartial
lock.unlock()

if !finalText.isEmpty {
    print(finalText)
} else {
    fputs("No speech detected.\n", stderr)
    exit(1)
}
