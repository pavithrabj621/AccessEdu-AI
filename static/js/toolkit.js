(() => {
  const root = document.documentElement;
  const body = document.body;
  const form = document.getElementById("toolForm");
  const result = document.getElementById("toolResult");
  const voiceStatus = document.getElementById("voiceStatus");
  const liveRegion = document.getElementById("liveRegion");
  let fontScale = 1;
  let recognition = null;
  let voiceEnabled = false;
  let restartTimer = null;
  let state = "consent";
  let questionIndex = 0;
  let pendingAnswer = "";

  const announce = (message) => {
    liveRegion.textContent = message;
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.rate = 0.9;
    utterance.onend = () => { if (voiceEnabled && !recognition) startRecognition(); };
    window.speechSynthesis.speak(utterance);
  };
  const normalize = (value = "") => value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const isYes = (text) => /^(yes|yeah|yep|correct|right|sure|okay|ok|submit|confirm)\b/.test(normalize(text));
  const isNo = (text) => /^(no|nope|wrong|incorrect|change|edit|again)\b/.test(normalize(text));
  const logVoiceEvent = (transcript, confidence, eventType) => {
    fetch("/api/voice-log", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ page: window.location.pathname, transcript, confidence, event_type: eventType }) }).catch(() => {});
  };
  const fields = () => Array.from(form.querySelectorAll("input, select, textarea"));
  const fieldLabel = (field) => form.querySelector(`label[for="${field.id}"]`)?.textContent.trim() || field.name;
  const fieldValue = (field) => field.value.trim();
  const currentQuestion = () => fields()[questionIndex];

  const askCurrentQuestion = () => {
    const field = currentQuestion();
    if (!field) {
      state = "review";
      const summary = fields().map((item) => `${fieldLabel(item)}: ${fieldValue(item) || "not provided"}`).join(". ");
      announce(`Here are the details you provided: ${summary}. Is everything correct?`);
      return;
    }
    state = "answer";
    field.focus();
    announce(`${fieldLabel(field)}. Please answer.`);
  };

  const submitForm = async () => {
    const data = Object.fromEntries(new FormData(form).entries());
    result.textContent = "Submitting...";
    try {
      const response = await fetch("/api/request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ request_type: form.dataset.requestType, source: "Campus Toolkit Voice", completion_mode: "voice", ...data }) });
      const saved = await response.json();
      state = "done";
      result.textContent = `${form.dataset.requestType} submitted. Reference #${saved.id}.`;
      announce(`Submitted. Reference number ${saved.id}.`);
    } catch {
      state = "review";
      result.textContent = "Submission failed. Say submit again.";
      announce("Submission failed. Say submit again.");
    }
  };

  const handleAnswer = (transcript) => {
    if (state === "consent") {
      if (isYes(transcript)) { questionIndex = 0; askCurrentQuestion(); }
      else if (isNo(transcript)) { state = "manual"; announce("Okay. You can complete the form manually."); }
      else announce("Please say yes or no.");
      return;
    }
    if (state === "answer") {
      pendingAnswer = transcript.trim();
      const field = currentQuestion();
      if (field.tagName === "SELECT") {
        const option = Array.from(field.options).find((item) => normalize(item.textContent) === normalize(pendingAnswer) || normalize(item.value) === normalize(pendingAnswer));
        if (option) pendingAnswer = option.value;
      }
      field.value = pendingAnswer;
      state = "confirm-answer";
      announce(`I heard ${pendingAnswer}. Is that correct?`);
      return;
    }
    if (state === "confirm-answer") {
      if (isYes(transcript)) { questionIndex += 1; askCurrentQuestion(); }
      else if (isNo(transcript)) askCurrentQuestion();
      else announce("Please say yes or no.");
      return;
    }
    if (state === "review") {
      if (isYes(transcript)) submitForm();
      else announce("Please say yes to submit or no to stop.");
    }
  };

  const stopRecognition = () => {
    clearTimeout(restartTimer);
    if (recognition) { recognition.onend = null; recognition.stop(); recognition = null; }
  };
  const startRecognition = () => {
    if (!voiceEnabled || recognition) return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { voiceStatus.textContent = "Speech recognition is unavailable. Use the visible form."; return; }
    recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 5;
    recognition.onstart = () => { voiceStatus.textContent = "Listening"; };
    recognition.onresult = (event) => {
      let interim = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const item = event.results[index];
        const transcript = item[0]?.transcript?.trim() || "";
        if (!transcript) continue;
        if (!item.isFinal) { interim += `${transcript} `; continue; }
        const confidence = item[0]?.confidence ?? 1;
        logVoiceEvent(transcript, confidence, confidence < 0.45 ? "low-confidence" : "recognized");
        if (confidence < 0.45) { announce("I didn't catch that, could you repeat?"); continue; }
        voiceStatus.textContent = `Heard: ${transcript}`;
        handleAnswer(transcript);
      }
      if (interim.trim()) voiceStatus.textContent = `Listening: ${interim.trim()}`;
    };
    recognition.onerror = () => { voiceStatus.textContent = "Listening paused. Check microphone permission."; };
    recognition.onend = () => { recognition = null; if (voiceEnabled) restartTimer = setTimeout(startRecognition, 250); };
    try { recognition.start(); } catch { recognition = null; }
  };

  document.getElementById("contrastBtn").addEventListener("click", () => { body.classList.toggle("high-contrast"); announce(body.classList.contains("high-contrast") ? "High contrast enabled" : "High contrast disabled"); });
  document.getElementById("fontUp").addEventListener("click", () => { fontScale = Math.min(1.3, +(fontScale + 0.1).toFixed(1)); root.style.setProperty("--font-scale", fontScale); });
  document.getElementById("fontDown").addEventListener("click", () => { fontScale = Math.max(0.9, +(fontScale - 0.1).toFixed(1)); root.style.setProperty("--font-scale", fontScale); });
  document.getElementById("readPageBtn").addEventListener("click", () => announce(document.querySelector("main").innerText));
  document.getElementById("voiceBtn").addEventListener("click", () => { voiceEnabled = !voiceEnabled; if (voiceEnabled) { announce("Voice enabled"); startRecognition(); } else { stopRecognition(); announce("Voice paused"); } });
  form.addEventListener("submit", (event) => { event.preventDefault(); submitForm(); });

  voiceEnabled = true;
  announce("There are some basic questions. Would you like to answer them?");
})();
