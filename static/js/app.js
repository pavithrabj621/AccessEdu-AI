(() => {
  const root = document.documentElement;
  const body = document.body;
  const voiceStatus = document.getElementById("voiceStatus");
  const liveRegion = document.getElementById("liveRegion");

  let recognition = null;
  let voiceEnabled = false;
  let restartTimer = null;
  let serverRecorder = null;
  let serverAsrFailed = false;
  let serverRetryCount = 0;
  let interruptListener = null;

  const stopVoiceSession = () => {
    voiceEnabled = false;
    clearTimeout(restartTimer);
    if (recognition) {
      recognition.onend = null;
      recognition.stop();
      recognition = null;
    }
    serverRecorder?.cancel();
    serverRecorder = null;
    interruptListener?.stop();
    interruptListener = null;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  };

  const interruptCurrentTurn = () => {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    serverRecorder?.cancel();
    serverRecorder = null;
    recognition?.stop();
    recognition = null;
    voiceEnabled = true;
    voiceStatus.textContent = "Stopped. Listening...";
    announce("Okay.", () => startVoice(true));
  };

  window.addEventListener("pagehide", stopVoiceSession);

  const resumeHomeVoice = () => {
    if (document.visibilityState !== "visible") return;
    voiceStatus.textContent = "Preparing voice assistant...";
    announce("How can I help you?", () => startVoice(true));
  };

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      stopVoiceSession();
      voiceStatus.textContent = "Voice paused while this tab is hidden.";
      return;
    }
    resumeHomeVoice();
  });

  const announce = (message, onDone = null) => {
    liveRegion.textContent = message;
    if (recognition) {
      recognition.onend = null;
      recognition.stop();
      recognition = null;
    }
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(message);
      utterance.rate = window.APP_CONFIG?.ttsRate || 0.95;
      utterance.pitch = window.APP_CONFIG?.ttsPitch || 1;
      utterance.onend = () => {
        onDone?.();
        if (!onDone && voiceEnabled && !recognition) startVoice(true);
      };
      window.speechSynthesis.speak(utterance);
    } else {
      onDone?.();
      if (!onDone && voiceEnabled && !recognition) startVoice(true);
    }
  };

  const openAnnouncementWindow = () => {
    stopVoiceSession();
    const url = window.APP_CONFIG?.announcementsUrl || "https://niviks20.github.io/announcement/";
    if (window.__accesseduAnnouncementsTab && !window.__accesseduAnnouncementsTab.closed) {
      window.__accesseduAnnouncementsTab.location.href = url;
      window.__accesseduAnnouncementsTab.focus();
      return;
    }

    window.__accesseduAnnouncementsTab = window.open(url, "accesseduAnnouncements");
    if (!window.__accesseduAnnouncementsTab) {
      window.location.href = url;
    }
  };

  const openPanel = (id) => {
    const panel = document.getElementById(id);
    if (!panel) return;
    panel.classList.add("open");
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const closePanel = (id) => {
    const panel = document.getElementById(id);
    if (panel) panel.classList.remove("open");
  };

  const toolkitPages = {
    outpass: "/toolkit/outpass",
    "out pass": "/toolkit/outpass",
    exam: "/toolkit/exam-booking",
    "exam booking": "/toolkit/exam-booking",
    "counter slot": "/toolkit/exam-booking",
    food: "/toolkit/food-ordering",
    "food ordering": "/toolkit/food-ordering",
    canteen: "/toolkit/food-ordering",
    marketplace: "/toolkit/marketplace",
    "market place": "/toolkit/marketplace"
  };

  const openToolkitPage = (text) => {
    const match = Object.entries(toolkitPages).find(([phrase]) => text.includes(phrase));
    if (match) {
      stopVoiceSession();
      window.location.href = match[1];
      announce(`Opening ${match[0]}`);
      return true;
    }
    return false;
  };

  document.querySelectorAll("[data-scroll]").forEach((button) => {
    button.addEventListener("click", () => {
      document.getElementById(button.dataset.scroll)?.scrollIntoView({ behavior: "smooth" });
    });
  });

  document.querySelectorAll("[data-panel]").forEach((button) => {
    const panelId = button.dataset.panel;
    button.addEventListener("click", () => {
      if (panelId === "announcementsPanel") {
        openAnnouncementWindow();
        announce("Opening recent announcements");
        return;
      }
      openPanel(panelId);
    });
  });

  document.querySelectorAll("[data-close]").forEach((button) => {
    button.addEventListener("click", () => closePanel(button.dataset.close));
  });

  document.getElementById("contrastBtn").addEventListener("click", () => {
    body.classList.toggle("high-contrast");
    announce(body.classList.contains("high-contrast") ? "High contrast enabled" : "High contrast disabled");
  });

  let fontScale = 1;
  document.getElementById("fontUp").addEventListener("click", () => {
    fontScale = Math.min(1.3, +(fontScale + 0.1).toFixed(1));
    root.style.setProperty("--font-scale", fontScale);
  });
  document.getElementById("fontDown").addEventListener("click", () => {
    fontScale = Math.max(0.9, +(fontScale - 0.1).toFixed(1));
    root.style.setProperty("--font-scale", fontScale);
  });

  document.getElementById("readPageBtn").addEventListener("click", () => {
    const text = document.querySelector("main").innerText;
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
      announce("Reading page content");
    } else {
      announce("Text to speech is not supported in this browser");
    }
  });

  document.getElementById("adminBtn").addEventListener("click", () => {
    window.location.href = "/admin/login";
    announce("Opening admin login");
  });

  async function loadAnnouncements() {
    const list = document.getElementById("announcementList");
    try {
      const response = await fetch("/api/announcements");
      const announcements = await response.json();
      list.innerHTML = announcements.map((item) => `
        <article class="announcement">
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.body)}</p>
          <time datetime="${escapeHtml(item.created_at)}">${escapeHtml(item.created_at)}</time>
          ${item.link ? `<p><a href="${escapeHtml(item.link)}" target="_blank" rel="noopener">Register / open link ↗</a></p>` : ""}
        </article>
      `).join("") || "<p>No announcements available.</p>";
    } catch {
      list.innerHTML = "<p>Announcements could not be loaded right now.</p>";
    }
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    }[char]));
  }

  document.querySelectorAll(".announcement-card").forEach((card) => {
    card.addEventListener("click", () => {
      openAnnouncementWindow();
      announce("Opening recent announcements");
    });
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openAnnouncementWindow();
        announce("Opening recent announcements");
      }
    });
  });

  document.querySelectorAll("[data-tool]").forEach((button) => {
    button.addEventListener("click", async () => {
      const type = button.dataset.tool;
      const status = document.getElementById("toolkitStatus");
      const response = await fetch("/api/request", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ request_type: type, source: "Campus Toolkit" })
      });
      const result = await response.json();
      status.textContent = `${type} request created. Reference #${result.id}. Status: ${result.status}.`;
      announce(status.textContent);
    });
  });

  async function activateSOS() {
    let location = null;
    if ("geolocation" in navigator) {
      try {
        location = await new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (position) => resolve({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude
            }),
            () => resolve(null),
            { enableHighAccuracy: true, timeout: 5000 }
          );
        });
      } catch { location = null; }
    }

    const response = await fetch("/api/sos", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({ location, source: "Voice/UI SOS" })
    });
    const result = await response.json();
    announce(result.message || "SOS request recorded");
  }

  document.getElementById("sosBtn").addEventListener("click", activateSOS);

  const normalizeSpeechText = (value = "") => value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const hasAnyPhrase = (text, phrases) => phrases.some((phrase) => text.includes(phrase));

  const featureIntents = [
    {
      id: "accesspath",
      label: "AccessPath AI",
      aliases: ["accesspath", "access path", "access path ai", "campus path", "campus map", "navigation", "navigate"]
    },
    {
      id: "academic-bot",
      label: "Academic Bot",
      aliases: ["academic bot", "academic", "study bot", "study help", "course bot", "chatbot"]
    },
    {
      id: "sos",
      label: "SOS",
      aliases: ["sos", "emergency", "urgent help", "danger", "accident", "help me"]
    },
    {
      id: "announcements",
      label: "Announcements",
      aliases: ["announcements", "announcement", "announcment", "annoubncements", "annuncemnt", "news", "notices", "updates"]
    },
    {
      id: "campus-toolkit",
      label: "Campus Toolkit",
      aliases: ["campus toolkit", "campus tools", "toolkit", "tools", "student services", "campus services", "malkr"]
    }
  ];

  const editDistance = (left, right) => {
    const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
    for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
      const current = [leftIndex];
      for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
        current[rightIndex] = Math.min(
          current[rightIndex - 1] + 1,
          previous[rightIndex] + 1,
          previous[rightIndex - 1] + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1)
        );
      }
      previous.splice(0, previous.length, ...current);
    }
    return previous[right.length];
  };

  const wordSimilarity = (spokenWord, aliasWord) => {
    if (spokenWord === aliasWord) return 1;
    if (spokenWord.length >= 4 && (spokenWord.startsWith(aliasWord) || aliasWord.startsWith(spokenWord))) return 0.9;
    const distance = editDistance(spokenWord, aliasWord);
    return 1 - distance / Math.max(spokenWord.length, aliasWord.length, 1);
  };

  const scoreAlias = (words, alias) => {
    const aliasWords = normalizeSpeechText(alias).split(" ").filter(Boolean);
    const matches = aliasWords.map((aliasWord) => Math.max(...words.map((word) => wordSimilarity(word, aliasWord)), 0));
    const matchedWords = matches.filter((score) => score >= 0.62).length;
    if (matchedWords !== aliasWords.length) return 0;
    const average = matches.reduce((sum, score) => sum + score, 0) / matches.length;
    const phraseBonus = normalizeSpeechText(words.join(" ")).includes(aliasWords.join(" ")) ? 0.12 : 0;
    return Math.min(1, average + phraseBonus);
  };

  const parseFeatureIntent = (command) => {
    const words = normalizeSpeechText(command).split(" ").filter(Boolean);
    if (!words.length) return { type: "none" };
    const ranked = featureIntents.map((feature) => ({
      ...feature,
      score: Math.max(...feature.aliases.map((alias) => scoreAlias(words, alias)), 0)
    })).sort((left, right) => right.score - left.score);
    const best = ranked[0];
    const second = ranked[1];
    if (!best || best.score < 0.62) return { type: "none" };
    if (second && second.score >= 0.62 && best.score - second.score < 0.08) {
      return { type: "ambiguous", options: [best.label, second.label] };
    }
    return { type: "match", feature: best };
  };

  const openFeature = (feature) => {
    if (feature.id === "accesspath") {
      stopVoiceSession();
      window.location.href = window.APP_CONFIG.accesspathUrl;
    } else if (feature.id === "academic-bot") {
      stopVoiceSession();
      window.location.href = window.APP_CONFIG.academicBotUrl;
    } else if (feature.id === "sos") {
      activateSOS();
    } else if (feature.id === "announcements") {
      stopVoiceSession();
      window.location.href = window.APP_CONFIG.announcementsUrl;
    } else if (feature.id === "campus-toolkit") {
      toolkitChoicePending = true;
      announce("What feature would you like to use?");
      return;
    }
    announce(`Opening ${feature.label}.`);
  };

  function runVoiceCommand(command) {
    const text = normalizeSpeechText(command);

    if (hasAnyPhrase(text, ["stop", "stop speaking", "stop listening", "be quiet"])) {
      interruptCurrentTurn();
      return;
    }

    const intent = parseFeatureIntent(command);
    if (intent.type === "ambiguous") {
      announce(`Did you mean ${intent.options[0]} or ${intent.options[1]}?`);
      return;
    }
    if (intent.type === "match") {
      openFeature(intent.feature);
      return;
    }

    if (hasAnyPhrase(text, ["close app", "close website", "exit app", "exit website", "goodbye", "bye", "close"])) {
      stopVoiceSession();
      voiceStatus.textContent = "Closing AccessEdu AI.";
      announce("Goodbye. Closing AccessEdu AI.");
      setTimeout(() => {
        try {
          window.close();
        } catch (error) {
          window.location.href = "about:blank";
        }
      }, 1200);
      return;
    }

    if (hasAnyPhrase(text, ["sos", "emergency", "help me", "danger", "accident"])) {
      activateSOS();
      return;
    }

    if (toolkitChoicePending) {
      if (openToolkitPage(text)) {
        toolkitChoicePending = false;
        return;
      }
      announce("Please say outpass, exam booking, food ordering, or marketplace.");
      return;
    }

    if (hasAnyPhrase(text, ["access path ai", "accesspath ai", "open access path", "access path", "accesspath", "navigate", "route", "campus map", "find path"])) {
      stopVoiceSession();
      window.open(window.APP_CONFIG.accesspathUrl, "_blank", "noopener");
      announce("Opening AccessPath AI");
      return;
    }

    if (hasAnyPhrase(text, ["admin", "admin login", "login as admin", "open admin"])) {
      stopVoiceSession();
      window.location.href = "/admin/login";
      announce("Opening admin login");
      return;
    }

    if (hasAnyPhrase(text, ["academic bot", "open bot", "academic", "study help", "ask question", "chatbot", "bot"])) {
      stopVoiceSession();
      window.open(window.APP_CONFIG.academicBotUrl, "_blank", "noopener");
      announce("Opening Academic Bot");
      return;
    }

    if (hasAnyPhrase(text, ["announcement", "announcements", "news", "notice", "latest updates"])) {
      openAnnouncementWindow();
      announce("Opening recent announcements");
      return;
    }

    if (openToolkitPage(text)) {
      return;
    }

    if (hasAnyPhrase(text, ["toolkit", "tools", "campus toolkit"])) {
      toolkitChoicePending = true;
      announce("What feature would you like to use?");
      return;
    }

    if (hasAnyPhrase(text, ["welcome", "hello", "hi", "good morning", "good evening"])) {
      announce("Welcome to AccessEdu AI platform. Tell me what you need.");
      return;
    }

    announce("I could not identify a feature. Say AccessPath, Academic Bot, SOS, announcements, or campus toolkit.");
  }

  let lastCommand = "";
  let lastCommandAt = 0;
  let toolkitChoicePending = false;

  const logVoiceEvent = (transcript, confidence, eventType) => {
    fetch("/api/voice-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page: window.location.pathname, transcript, confidence, event_type: eventType })
    }).catch(() => {});
  };

  const createRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      voiceStatus.textContent = "Speech recognition is not supported in this browser.";
      return null;
    }
    recognition = new SpeechRecognition();
    const languageCodes = {
      English: "en-IN",
      "தமிழ்": "ta-IN",
      "हिन्दी": "hi-IN",
      "മലയാളം": "ml-IN"
    };
    const selectedLanguage = document.getElementById("languageSelect")?.value || "English";
    recognition.lang = languageCodes[selectedLanguage] || "en-IN";
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 5;
    recognition.onstart = () => {
      voiceStatus.textContent = "Listening… speak a command.";
      document.getElementById("voiceBtn")?.setAttribute("aria-pressed", "true");
    };
    recognition.onresult = (event) => {
      let interimTranscript = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const speechResult = event.results[index];
        const transcript = speechResult[0]?.transcript?.trim() || "";
        if (!transcript) continue;
        if (speechResult.isFinal) {
          const now = Date.now();
          const normalized = normalizeSpeechText(transcript);
          const confidence = speechResult[0]?.confidence ?? 1;
          logVoiceEvent(transcript, confidence, confidence < 0.45 ? "low-confidence" : "recognized");
          if (normalized && (normalized !== lastCommand || now - lastCommandAt > 1500)) {
            lastCommand = normalized;
            lastCommandAt = now;
            runVoiceCommand(transcript);
          }
        } else {
          interimTranscript = "";
        }
      }
      voiceStatus.textContent = "Listening...";
    };
    recognition.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        voiceEnabled = false;
        voiceStatus.textContent = "Allow microphone access, then press the microphone button.";
      } else if (event.error === "audio-capture") {
        voiceStatus.textContent = "No microphone was found.";
      } else if (event.error === "network") {
        voiceStatus.textContent = "Browser speech service is unavailable.";
      }
    };
    recognition.onend = () => {
      recognition = null;
      if (voiceEnabled && document.visibilityState === "visible") {
        clearTimeout(restartTimer);
        restartTimer = setTimeout(() => startVoice(true), 250);
      } else {
        document.getElementById("voiceBtn")?.setAttribute("aria-pressed", "false");
      }
    };
    return recognition;
  };

  const startVoice = (autoStart = false) => {
    if (recognition) return;
    voiceEnabled = true;
    const activeRecognition = createRecognition();
    if (!activeRecognition) {
      voiceEnabled = false;
      announce(voiceStatus.textContent);
      return;
    }
    try {
      activeRecognition.start();
      if (!autoStart) announce("Voice assistant enabled. I am listening continuously.");
    } catch {
      voiceStatus.textContent = "Voice assistant could not start. Check microphone permission.";
      document.getElementById("voiceBtn")?.setAttribute("aria-pressed", "false");
    }
  };

  const stopVoice = () => {
    stopVoiceSession();
    voiceStatus.textContent = "Voice assistant paused. Select the microphone to resume.";
    document.getElementById("voiceBtn")?.setAttribute("aria-pressed", "false");
    announce("Voice assistant paused");
  };

  const toggleVoice = () => {
    if (voiceEnabled) stopVoice();
    else startVoice(false);
  };

  document.getElementById("voiceBtn").addEventListener("click", toggleVoice);
  document.getElementById("heroVoiceBtn").addEventListener("click", toggleVoice);
  document.getElementById("languageSelect")?.addEventListener("change", () => {
    if (voiceEnabled) {
      stopVoice();
      startVoice(true);
    }
  });

  const handleBottomNavAction = (action) => {
    document.querySelectorAll(".bottom-item").forEach((el) => el.classList.remove("active"));
    const activeItem = document.querySelector(`.bottom-item[data-action="${action}"]`);
    if (activeItem) activeItem.classList.add("active");

    if (action === "academic-bot") {
      stopVoiceSession();
      window.open(window.APP_CONFIG.academicBotUrl, "_blank", "noopener");
      announce("Opening Academic Bot");
      return;
    }

    if (action === "accesspath-ai") {
      stopVoiceSession();
      window.open(window.APP_CONFIG.accesspathUrl, "_blank", "noopener");
      announce("Opening AccessPath AI");
      return;
    }

    if (action === "sos") {
      activateSOS();
      return;
    }

    if (action === "announcements") {
      openAnnouncementWindow();
      announce("Opening recent announcements");
      return;
    }

    if (action === "toolkit") {
      openPanel("toolkitPanel");
      announce("Opening campus toolkit");
    }
  };

  document.querySelectorAll(".bottom-item").forEach((item) => {
    item.addEventListener("click", () => handleBottomNavAction(item.dataset.action));
  });

  voiceStatus.textContent = "Listening. Say a command.";
  resumeHomeVoice();
})();
