# AccessEdu AI — Paavai Engineering College

An accessible, mobile-responsive campus assistance platform for students with disabilities.

## Folder structure

```text
aeaccessedu/
├── app.py
├── requirements.txt
├── README.md
├── aeaccessedu.db              # created automatically on first run
├── templates/
│   └── index.html
└── static/
    ├── css/
    │   └── styles.css
    └── js/
        └── app.js
```

## Setup

```bash
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
python app.py
```

Open `http://localhost:5000`.

## Campus toolkit pages

Each toolkit service has its own accessible page:

- `/toolkit/outpass`
- `/toolkit/exam-booking`
- `/toolkit/food-ordering`
- `/toolkit/marketplace`

On any toolkit page, select **Voice** and say `help` for the available commands. You can navigate between services, read the page, change text size or contrast, and submit the current form by voice. Browser speech recognition requires microphone permission and support from the browser.

## Voice-first flow

The home page speaks exactly `How can I help you?` after each reload, then starts listening after the greeting finishes. Say `campus toolkit` to hear `What feature would you like to use?`, then say `outpass`, `exam booking`, `food ordering`, or `marketplace`.

Toolkit pages ask permission before collecting answers. A voice answer is shown in the form and confirmed, questions are asked one at a time, and the complete response is read back before submission. Low-confidence results are logged and replayed with `I didn't catch that, could you repeat?`.

Toolkit submissions are stored as structured JSON in the local SQLite database (`aeaccessedu.db`). Admins can filter submissions, inspect every field, monitor recent voice recognition logs, use the live feed status, and export CSV from `/admin/dashboard`. Set `SECRET_KEY`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `ADMIN_ROLE` in production; the development defaults are only for local testing.

## High-accuracy server speech recognition

The app now defaults to the server Whisper backend for higher accuracy. Browser speech recognition remains available by setting `VOICE_ENGINE=browser`. The first Whisper request downloads the selected model from Hugging Face and can take time.

After changing this configuration, stop the old Flask process with `Ctrl+C` and start it again. Visit `/api/voice-config` to confirm that `engine` is `whisper` and `model` is `large-v3`. Keep the first voice request open while the model downloads and initializes; later requests use the cached warm model.

```powershell
python -m pip install -r requirements-voice.txt
$env:VOICE_ENGINE="whisper"
$env:WHISPER_MODEL="large-v3"
$env:WHISPER_DEVICE="cpu"
$env:WHISPER_COMPUTE_TYPE="int8"
$env:VOICE_MAX_SECONDS="15"
python app.py
```

Use `medium` or `large-v3` for higher accuracy when the machine has enough RAM/GPU; use `tiny` or `base` for lower latency. The server recorder captures up to 15 seconds by default, uses browser echo cancellation/noise suppression and automatic gain control, applies server-side VAD, and stops after sustained silence. Configure `VOICE_MAX_SECONDS` from 10 to 60 seconds and `VOICE_MIN_CONFIDENCE` for uncertainty handling.

The diagnostic endpoint is `/api/voice-config`. Recognition failures are categorized as `microphone-denied`, `no-speech`, `model-uncertainty`, `server-asr-disabled`, `model-unavailable`, `network-error`, or `transcription-error`, and are stored in the admin voice log. The visible form remains available as the final fallback. For production, put Whisper behind a worker queue, keep the model warm, use GPU batching where available, and enforce upload size/type limits at the reverse proxy.

## Connect deployed services

Set the deployed URLs before starting the app:

```bash
# Windows PowerShell
$env:ACCESSPATH_AI_URL="https://your-deployed-accesspath-url"
$env:ACADEMIC_BOT_URL="https://your-deployed-academic-bot-url"

# macOS/Linux
export ACCESSPATH_AI_URL="https://your-deployed-accesspath-url"
export ACADEMIC_BOT_URL="https://your-deployed-academic-bot-url"
```

The AccessPath AI and Academic Bot cards open in a new browser tab.

## Included accessibility features

- Responsive mobile-first layout
- Fixed bottom navigation on mobile
- Keyboard-operable controls
- Visible focus indicators
- Skip-to-content link
- Semantic landmarks and ARIA labels
- High-contrast mode
- Font-size controls
- Browser text-to-speech
- Browser speech recognition where supported
- Voice commands for module navigation and SOS
- Screen-reader-friendly announcement cards
- Minimum 48px interactive touch targets
- SQLite persistence for requests and announcements

## Voice command examples

- "Open AccessPath AI"
- "Open Academic Bot"
- "Tell me recent announcements"
- "Read announcements"
- "Open toolkit"
- "Open outpass"
- "Open food ordering"
- "Open marketplace"
- "Open exam booking"
- "SOS"

## Important implementation note

Browser speech recognition depends on browser and device support and may require permission. For production, connect the SOS endpoint to an approved emergency service, add authentication, role-based administration, secure audit logging, and a reliable server-side speech service.
