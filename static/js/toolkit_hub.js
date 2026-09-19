(() => {
  const status = document.getElementById("hubVoiceStatus");
  const live = document.getElementById("hubLiveRegion");
  let recognition = null;
  let listening = true;

  const speak = (message, done) => {
    live.textContent = message;
    if (!("speechSynthesis" in window)) { done?.(); return; }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.rate = 0.95;
    utterance.onend = () => done?.();
    window.speechSynthesis.speak(utterance);
  };

  const normalize = (value) => value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const choices = [
    { words: ["outpass", "out pass", "digital outpass", "digital pass"], url: "/toolkit/outpass", label: "Digital outpass" },
    { words: ["exam booking", "exam book", "exam slot", "counter booking"], url: "/toolkit/exam-booking", label: "Exam booking" },
    { words: ["food ordering", "food order", "canteen", "food"], url: "/toolkit/food-ordering", label: "Food ordering" },
    { words: ["marketplace", "market place", "market", "buy and sell"], url: "/toolkit/marketplace", label: "Marketplace" }
  ];

  const distance = (a, b) => {
    const row = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i += 1) {
      const next = [i];
      for (let j = 1; j <= b.length; j += 1) next[j] = Math.min(next[j - 1] + 1, row[j] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      row.splice(0, row.length, ...next);
    }
    return row[b.length];
  };

  const choose = (spoken) => {
    const text = normalize(spoken);
    const ranked = choices.map((choice) => ({ ...choice, score: Math.max(...choice.words.map((word) => {
      const alias = normalize(word);
      if (text.includes(alias)) return 1;
      const token = text.split(" ").find((part) => distance(part, alias) <= Math.max(1, Math.floor(alias.length * 0.3)));
      return token ? 0.72 : 0;
    })) })).sort((a, b) => b.score - a.score);
    return ranked[0]?.score >= 0.72 ? ranked[0] : null;
  };

  const listen = () => {
    if (!listening || recognition) return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { status.textContent = "Speech recognition is unavailable. Use a service link."; return; }
    recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.interimResults = false;
    recognition.continuous = true;
    recognition.onstart = () => { status.textContent = "Listening for a toolkit feature..."; };
    recognition.onresult = (event) => {
      const transcript = event.results[event.results.length - 1]?.[0]?.transcript || "";
      if (/\bhelp\b|what can i say|commands/.test(normalize(transcript))) {
        recognition.stop();
        speak("Say digital outpass, exam booking, food ordering, or marketplace.", listen);
        return;
      }
      const choice = choose(transcript);
      if (!choice) { recognition.stop(); speak("Please say digital outpass, exam booking, food ordering, or marketplace.", listen); return; }
      listening = false;
      recognition.stop();
      speak(`Opening ${choice.label}.`, () => window.open(choice.url, "_blank"));
    };
    recognition.onerror = () => { status.textContent = "Allow microphone access to choose a toolkit feature."; };
    recognition.onend = () => { recognition = null; if (listening) listen(); };
    try { recognition.start(); } catch { recognition = null; }
  };

  speak("What do we need to offer you?", listen);
})();
