(() => {
  class ServerVoiceRecorder {
    constructor({ maxSeconds = 15, onTranscript, onStatus, onError }) {
      this.maxSeconds = maxSeconds;
      this.onTranscript = onTranscript;
      this.onStatus = onStatus;
      this.onError = onError;
      this.recorder = null;
      this.chunks = [];
      this.stream = null;
      this.audioContext = null;
      this.analyser = null;
      this.raf = null;
      this.startedAt = 0;
      this.abortController = null;
      this.cancelled = false;
    }

    async start() {
      if (this.recorder) return;
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
        this.onError("browser-audio-unavailable", "Audio recording is unavailable in this browser.");
        return;
      }
      try {
        this.cancelled = false;
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
        const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((type) => MediaRecorder.isTypeSupported(type)) || "";
        this.recorder = new MediaRecorder(this.stream, mimeType ? { mimeType } : undefined);
        this.chunks = [];
        this.recorder.ondataavailable = (event) => { if (event.data.size) this.chunks.push(event.data); };
        this.recorder.onstop = () => this.finish();
        this.recorder.start(250);
        this.startedAt = Date.now();
        this.onStatus(`Listening for up to ${this.maxSeconds} seconds...`);
        this.startVad();
      } catch (error) {
        this.cleanup();
        this.onError(error.name === "NotAllowedError" ? "microphone-denied" : "recording-error", "Microphone permission is required. You can use the typed form instead.");
      }
    }

    startVad() {
      try {
        this.audioContext = new AudioContext();
        const source = this.audioContext.createMediaStreamSource(this.stream);
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 512;
        source.connect(this.analyser);
        const data = new Uint8Array(this.analyser.fftSize);
        let speechSeen = false;
        let quietSince = Date.now();
        const monitor = () => {
          if (!this.recorder) return;
          this.analyser.getByteTimeDomainData(data);
          let energy = 0;
          for (const value of data) energy += Math.abs(value - 128);
          const averageEnergy = energy / data.length;
          if (averageEnergy > 4) { speechSeen = true; quietSince = Date.now(); }
          if (speechSeen && Date.now() - quietSince > 2200) this.stop();
          if (Date.now() - this.startedAt >= this.maxSeconds * 1000) this.stop();
          this.raf = requestAnimationFrame(monitor);
        };
        monitor();
      } catch {
        // Server VAD still applies; recording continues until maxSeconds.
      }
    }

    stop() {
      if (this.recorder && this.recorder.state !== "inactive") this.recorder.stop();
    }

    async finish() {
      if (this.cancelled) return;
      const blob = new Blob(this.chunks, { type: this.recorder?.mimeType || "audio/webm" });
      const extension = blob.type.includes("mp4") ? "m4a" : "webm";
      this.onStatus("Analyzing with Whisper...");
      const formData = new FormData();
      formData.append("audio", blob, `voice.${extension}`);
      this.abortController = new AbortController();
      try {
        const response = await fetch("/api/transcribe", { method: "POST", body: formData, signal: this.abortController.signal });
        const result = await response.json();
        if (result.ok && result.transcript) this.onTranscript(result.transcript, result.confidence);
        else this.onError(result.reason || "transcription-error", result.message || "Speech could not be recognized. Try again or type your answer.");
      } catch (error) {
        if (error.name === "AbortError" || this.cancelled) return;
        this.onError("network-error", "The speech service could not be reached. Use the typed form instead.");
      } finally {
        this.cleanup();
      }
    }

    cleanup() {
      cancelAnimationFrame(this.raf);
      this.stream?.getTracks().forEach((track) => track.stop());
      this.audioContext?.close().catch(() => {});
      this.stream = null;
      this.recorder = null;
      this.audioContext = null;
      this.analyser = null;
      this.abortController = null;
    }

    cancel() {
      this.cancelled = true;
      this.abortController?.abort();
      if (this.recorder && this.recorder.state !== "inactive") {
        this.recorder.onstop = null;
        this.recorder.stop();
      }
      this.cleanup();
    }
  }

  window.ServerVoiceRecorder = ServerVoiceRecorder;

  class StopListener {
    constructor(onStop) {
      this.onStop = onStop;
      this.recognition = null;
      this.enabled = false;
    }

    start() {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition || this.enabled) return;
      this.enabled = true;
      this.recognition = new SpeechRecognition();
      this.recognition.lang = "en-IN";
      this.recognition.continuous = true;
      this.recognition.interimResults = false;
      this.recognition.onresult = (event) => {
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const text = event.results[index][0]?.transcript?.toLowerCase() || "";
          if (/\bstop\b|stop speaking|stop listening|be quiet/.test(text)) {
            this.onStop();
            return;
          }
        }
      };
      this.recognition.onend = () => {
        this.recognition = null;
        if (this.enabled) {
          try { this.start(); } catch { /* Browser may reject rapid restarts. */ }
        }
      };
      try { this.recognition.start(); } catch { this.recognition = null; }
    }

    stop() {
      this.enabled = false;
      if (this.recognition) {
        this.recognition.onend = null;
        this.recognition.stop();
        this.recognition = null;
      }
    }
  }

  window.StopListener = StopListener;
})();
