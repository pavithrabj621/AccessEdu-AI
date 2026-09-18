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
