(() => {
  const root = document.documentElement;
  const body = document.body;
  const form = document.getElementById("toolForm");
  const result = document.getElementById("toolResult");
  const voiceStatus = document.getElementById("voiceStatus");
  const liveRegion = document.getElementById("liveRegion");
  const pageName = body.dataset.toolPage;
  let fontScale = 1;
  let recognition = null;

  const announce = (message) => {
    liveRegion.textContent = message;
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(message);
      utterance.rate = 0.95;
      window.speechSynthesis.speak(utterance);
    }
  };

  const normalize = (value = "") => value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const includesAny = (text, phrases) => phrases.some((phrase) => text.includes(phrase));
  const go = (path, message) => {
    announce(message);
    window.location.href = path;
  };

  document.getElementById("contrastBtn").addEventListener("click", () => {
    body.classList.toggle("high-contrast");
    announce(body.classList.contains("high-contrast") ? "High contrast enabled" : "High contrast disabled");
  });
  document.getElementById("fontUp").addEventListener("click", () => {
    fontScale = Math.min(1.3, +(fontScale + 0.1).toFixed(1));
    root.style.setProperty("--font-scale", fontScale);
    announce("Text size increased");
  });
  document.getElementById("fontDown").addEventListener("click", () => {
    fontScale = Math.max(0.9, +(fontScale - 0.1).toFixed(1));
    root.style.setProperty("--font-scale", fontScale);
    announce("Text size decreased");
  });
  document.getElementById("readPageBtn").addEventListener("click", () => announce(document.querySelector("main").innerText));

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    result.textContent = "Submitting your request...";
    try {
      const response = await fetch("/api/request", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ request_type: form.dataset.requestType, source: "Campus Toolkit", ...data })
      });
      const request = await response.json();
      result.textContent = `${form.dataset.requestType} request created. Reference #${request.id}. Status: ${request.status}.`;
      announce(result.textContent);
    } catch {
      result.textContent = "The request could not be submitted. Please try again.";
      announce(result.textContent);
    }
  });

  const runCommand = (command) => {
    const text = normalize(command);
    if (includesAny(text, ["help", "what can i say", "commands"])) {
      announce("You can say read page, submit request, go home, go to outpass, exam booking, food ordering, or marketplace. You can also say increase text or high contrast.");
      return;
    }
    if (includesAny(text, ["submit", "send request", "complete request"])) {
      form.requestSubmit();
      return;
    }
    if (includesAny(text, ["read page", "read this", "read form"])) {
      announce(document.querySelector("main").innerText);
      return;
    }
    if (includesAny(text, ["high contrast", "contrast mode"])) {
      document.getElementById("contrastBtn").click();
      return;
    }
    if (includesAny(text, ["increase text", "bigger text", "larger text"])) {
      document.getElementById("fontUp").click();
      return;
    }
    if (includesAny(text, ["decrease text", "smaller text"])) {
      document.getElementById("fontDown").click();
      return;
    }
    if (includesAny(text, ["go home", "open home", "main page"])) {
      go("/", "Opening the AccessEdu home page");
      return;
    }
    if (includesAny(text, ["outpass", "out pass"])) {
      go("/toolkit/outpass", "Opening Outpass");
      return;
    }
    if (includesAny(text, ["exam booking", "exam", "counter slot"])) {
      go("/toolkit/exam-booking", "Opening Exam Booking");
      return;
    }
    if (includesAny(text, ["food ordering", "food order", "canteen", "food"])) {
      go("/toolkit/food-ordering", "Opening Food Ordering");
      return;
    }
    if (includesAny(text, ["marketplace", "market place", "buy and sell"])) {
      go("/toolkit/marketplace", "Opening Marketplace");
      return;
    }
    announce("Command not recognized. Say help for available voice commands.");
  };

  const startVoice = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      voiceStatus.textContent = "Speech recognition is not supported in this browser. Use the Read button for voice output.";
      announce(voiceStatus.textContent);
      return;
    }
    if (recognition) {
      recognition.stop();
      recognition = null;
      voiceStatus.textContent = "Voice assistant stopped.";
      announce("Voice assistant stopped");
      return;
    }
    recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.interimResults = false;
    recognition.continuous = true;
    recognition.onstart = () => {
      voiceStatus.textContent = "Listening. Say help for commands.";
      announce("Listening");
    };
    recognition.onresult = (event) => {
      const resultItem = event.results[event.results.length - 1];
      const transcript = resultItem?.[0]?.transcript?.trim();
      if (transcript) {
        voiceStatus.textContent = `Heard: ${transcript}`;
        runCommand(transcript);
      }
    };
    recognition.onerror = () => {
      voiceStatus.textContent = "Voice input ended. Check microphone permission.";
    };
    recognition.onend = () => {
      recognition = null;
      voiceStatus.textContent = "Voice assistant ready. Select Voice to listen again.";
    };
    recognition.start();
  };

  document.getElementById("voiceBtn").addEventListener("click", startVoice);
  announce(`${pageName} page ready. Say help for voice commands.`);
})();
