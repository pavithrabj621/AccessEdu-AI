(() => {
  let recognition = null;
  let enabled = true;

  const stop = () => {
    enabled = false;
    if (recognition) {
      recognition.onend = null;
      recognition.stop();
      recognition = null;
    }
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  };

  const start = () => {
    if (!enabled || recognition || document.visibilityState !== "visible") return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = event.results[event.results.length - 1]?.[0]?.transcript || "";
      const text = transcript.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
      if (/\bgo\s+home\b|\bopen\s+home\b|\bhome\s+page\b|\bmain\s+page\b|\breturn\s+home\b|\bback\s+home\b/.test(text)) {
        stop();
        window.location.href = "/";
      }
    };
    recognition.onerror = () => {};
    recognition.onend = () => {
      recognition = null;
      if (enabled && document.visibilityState === "visible") start();
    };
    try { recognition.start(); } catch { recognition = null; }
  };

  window.addEventListener("pagehide", stop);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") stop();
    else { enabled = true; start(); }
  });
  start();
})();
