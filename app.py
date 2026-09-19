import json
import csv
import io
import os
import sqlite3
from datetime import datetime
from urllib.parse import urlparse
from flask import Flask, render_template, request, jsonify, g, session, redirect, url_for, make_response

app = Flask(__name__)
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "change-me")
DATABASE = os.path.join(os.path.dirname(__file__), "aeaccessedu.db")
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")
ADMIN_ROLE = os.getenv("ADMIN_ROLE", "administrator")

# Add your deployed URLs in environment variables or edit these defaults.
ACCESSPATH_AI_URL = os.getenv("ACCESSPATH_AI_URL", "https://accesspath-three.vercel.app/")
ACADEMIC_BOT_URL = os.getenv("ACADEMIC_BOT_URL", "https://chatbot-ai-squad-24.vercel.app/")
ANNOUNCEMENTS_URL = os.getenv("ANNOUNCEMENTS_URL", "https://niviks20.github.io/announcement/")


def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DATABASE)
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(exception=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db():
    db = get_db()
    db.execute("""
        CREATE TABLE IF NOT EXISTS announcements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            body TEXT NOT NULL,
            link TEXT,
            created_at TEXT NOT NULL,
            event_date TEXT,
            category TEXT
        )
    """)
    columns = {row[1] for row in db.execute("PRAGMA table_info(announcements)").fetchall()}
    if "event_date" not in columns:
        db.execute("ALTER TABLE announcements ADD COLUMN event_date TEXT")
    if "category" not in columns:
        db.execute("ALTER TABLE announcements ADD COLUMN category TEXT")
    db.execute("""
        CREATE TABLE IF NOT EXISTS requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            request_type TEXT NOT NULL,
            payload TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'Submitted',
            created_at TEXT NOT NULL,
            source TEXT NOT NULL DEFAULT 'web',
            completion_mode TEXT NOT NULL DEFAULT 'voice'
        )
    """)
    request_columns = {row[1] for row in db.execute("PRAGMA table_info(requests)").fetchall()}
    if "source" not in request_columns:
        db.execute("ALTER TABLE requests ADD COLUMN source TEXT NOT NULL DEFAULT 'web'")
    if "completion_mode" not in request_columns:
        db.execute("ALTER TABLE requests ADD COLUMN completion_mode TEXT NOT NULL DEFAULT 'voice'")
    db.execute("""
        CREATE TABLE IF NOT EXISTS voice_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            page TEXT NOT NULL,
            transcript TEXT,
            confidence REAL,
            event_type TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    """)
    seeded_events = [
        (
            "Hackathon",
            "Campus innovation challenge for students. Registration and event details are available through the link.",
            "https://example.com/register",
            "2026-10-25",
            "Hackathon",
        ),
        (
            "Academic End Semester Exam Time Table",
            "The end semester examination timetable has been published. Please check your subjects, rooms, and reporting times.",
            None,
            "2026-11-15",
            "Academic",
        ),
    ]
    existing_titles = {
        row["title"] for row in db.execute("SELECT title FROM announcements").fetchall()
    }
    for title, body, link, event_date, category in seeded_events:
        if title not in existing_titles:
            db.execute(
                "INSERT INTO announcements (title, body, link, created_at, event_date, category) VALUES (?, ?, ?, ?, ?, ?)",
                (title, body, link, datetime.now().isoformat(timespec="minutes"), event_date, category),
            )
    db.commit()


def admin_required(view):
    def wrapped(*args, **kwargs):
        if not session.get("admin_logged_in") or session.get("admin_role") != ADMIN_ROLE:
            return redirect(url_for("admin_login"))
        return view(*args, **kwargs)

    wrapped.__name__ = view.__name__
    return wrapped


@app.route("/")
def index():
    return render_template(
        "index.html",
        accesspath_url=ACCESSPATH_AI_URL,
        academic_bot_url=ACADEMIC_BOT_URL,
        announcements_url=ANNOUNCEMENTS_URL,
    )


@app.get("/toolkit/outpass")
def outpass_tool():
    return render_template(
        "outpass.html",
        tool_name="Outpass",
        tool_icon="🚪",
        tool_description="Request permission to leave campus and track your outpass request.",
    )


@app.get("/toolkit/exam-booking")
def exam_booking_tool():
    return render_template(
        "exam_booking.html",
        tool_name="Exam Booking",
        tool_icon="🗓",
        tool_description="Reserve an accessible exam or counter slot with the support you need.",
    )


@app.get("/toolkit/food-ordering")
def food_ordering_tool():
    return render_template(
        "food_ordering.html",
        tool_name="Food Ordering",
        tool_icon="🍱",
        tool_description="Place a campus food order and request delivery or accessibility support.",
    )


@app.get("/toolkit/marketplace")
def marketplace_tool():
    return render_template(
        "marketplace.html",
        tool_name="Marketplace",
        tool_icon="📚",
        tool_description="Buy, sell, or exchange books, devices, and other campus essentials.",
    )


@app.route("/admin/login", methods=["GET", "POST"])
def admin_login():
    error = None
    if request.method == "POST":
        username = request.form.get("username", "")
        password = request.form.get("password", "")
        if username == ADMIN_USERNAME and password == ADMIN_PASSWORD:
            session["admin_logged_in"] = True
            session["admin_role"] = ADMIN_ROLE
            return redirect(url_for("admin_dashboard"))
        error = "Invalid username or password"
    response = make_response(render_template("admin_login.html", error=error))
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    return response


@app.route("/admin/logout")
def admin_logout():
    session.pop("admin_logged_in", None)
    return redirect(url_for("admin_login"))


@app.route("/admin/dashboard")
@admin_required
def admin_dashboard():
    db = get_db()
    rows = db.execute(
        "SELECT * FROM announcements ORDER BY id DESC"
    ).fetchall()
    request_type = request.args.get("feature", "").strip()
    status = request.args.get("status", "").strip()
    start_date = request.args.get("start", "").strip()
    end_date = request.args.get("end", "").strip()
    conditions = []
    values = []
    if request_type:
        conditions.append("request_type = ?")
        values.append(request_type)
    if status:
        conditions.append("status = ?")
        values.append(status)
    if start_date:
        conditions.append("date(created_at) >= date(?)")
        values.append(start_date)
    if end_date:
        conditions.append("date(created_at) <= date(?)")
        values.append(end_date)
    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    submission_rows = db.execute(
        f"SELECT * FROM requests {where} ORDER BY id DESC", values
    ).fetchall()
    submissions = []
    for row in submission_rows:
        item = dict(row)
        try:
            item["details"] = json.loads(item["payload"])
        except (TypeError, json.JSONDecodeError):
            item["details"] = {"raw": item["payload"]}
        submissions.append(item)
    all_submissions = db.execute("SELECT request_type, status, created_at FROM requests ORDER BY id DESC").fetchall()
    voice_logs = db.execute("SELECT * FROM voice_logs ORDER BY id DESC LIMIT 12").fetchall()
    feature_counts = {}
    daily_counts = {}
    for row in all_submissions:
        feature_counts[row["request_type"]] = feature_counts.get(row["request_type"], 0) + 1
        day = row["created_at"][:10]
        daily_counts[day] = daily_counts.get(day, 0) + 1
    response = make_response(render_template(
        "admin_dashboard.html",
        announcements=[dict(row) for row in rows],
        submissions=[dict(row) for row in submissions],
        feature_counts=feature_counts,
        daily_counts=dict(sorted(daily_counts.items(), reverse=True)[:7]),
        voice_logs=[dict(row) for row in voice_logs],
        filters={"feature": request_type, "status": status, "start": start_date, "end": end_date},
    ))
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    return response


@app.post("/admin/announcement")
@admin_required
def create_announcement():
    title = (request.form.get("title") or "").strip()
    body = (request.form.get("body") or "").strip()
    link = (request.form.get("link") or "").strip()
    event_date = (request.form.get("event_date") or "").strip()
    category = (request.form.get("category") or "").strip()
    categories = {"Hackathon", "Academic", "Cultural", "Sports", "Workshop", "Seminar"}
    errors = []
    if not title:
        errors.append("Event title is required.")
    if not body:
        errors.append("Event description is required.")
    if not event_date:
        errors.append("Event date is required.")
    if not category or category not in categories:
        errors.append("Choose a valid event category.")
    if link:
        parsed_link = urlparse(link)
        if parsed_link.scheme not in {"http", "https"} or not parsed_link.netloc:
            errors.append("Registration link must be a valid http:// or https:// URL.")
    if errors:
        rows = get_db().execute("SELECT * FROM announcements ORDER BY id DESC").fetchall()
        return render_template(
            "admin_dashboard.html",
            announcements=[dict(row) for row in rows],
            form_errors=errors,
            form_values=request.form,
            submissions=[],
            feature_counts={},
            daily_counts={},
            voice_logs=[],
            filters={"feature": "", "status": "", "start": "", "end": ""},
        ), 400

    db = get_db()
    db.execute(
        "INSERT INTO announcements (title, body, link, created_at, event_date, category) VALUES (?, ?, ?, ?, ?, ?)",
        (title, body, link or None, datetime.now().isoformat(timespec="minutes"), event_date, category),
    )
    db.commit()
    return redirect(url_for("admin_dashboard", posted=1))


@app.get("/api/announcements")
def announcements():
    rows = get_db().execute(
        "SELECT * FROM announcements ORDER BY id DESC LIMIT 10"
    ).fetchall()
    return jsonify([dict(row) for row in rows])


@app.post("/api/request")
def create_request():
    data = request.get_json(silent=True) or {}
    request_type = data.get("request_type", "General")
    payload = json.dumps(data, ensure_ascii=False)
    db = get_db()
    source = data.get("source", "Campus Toolkit")
    completion_mode = data.get("completion_mode", "voice")
    cursor = db.execute(
        "INSERT INTO requests (request_type, payload, created_at, source, completion_mode) VALUES (?, ?, ?, ?, ?)",
        (request_type, payload, datetime.now().isoformat(timespec="minutes"), source, completion_mode),
    )
    db.commit()
    return jsonify({"ok": True, "id": cursor.lastrowid, "status": "Submitted"})


@app.get("/admin/export.csv")
@admin_required
def export_requests_csv():
    rows = get_db().execute("SELECT * FROM requests ORDER BY id DESC").fetchall()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["id", "feature", "status", "created_at", "source", "completion_mode", "payload"])
    for row in rows:
        writer.writerow([row["id"], row["request_type"], row["status"], row["created_at"], row["source"], row["completion_mode"], row["payload"]])
    response = make_response(output.getvalue())
    response.headers["Content-Type"] = "text/csv; charset=utf-8"
    response.headers["Content-Disposition"] = "attachment; filename=accessedu-submissions.csv"
    return response


@app.get("/api/admin/submissions")
@admin_required
def admin_submissions_api():
    rows = get_db().execute("SELECT * FROM requests ORDER BY id DESC LIMIT 50").fetchall()
    return jsonify([dict(row) for row in rows])


@app.post("/api/voice-log")
def create_voice_log():
    data = request.get_json(silent=True) or {}
    get_db().execute(
        "INSERT INTO voice_logs (page, transcript, confidence, event_type, created_at) VALUES (?, ?, ?, ?, ?)",
        (data.get("page", "/"), data.get("transcript", ""), data.get("confidence"), data.get("event_type", "recognized"), datetime.now().isoformat(timespec="minutes")),
    )
    get_db().commit()
    return jsonify({"ok": True})


@app.post("/api/sos")
def sos():
    data = request.get_json(silent=True) or {}
    payload = json.dumps(data, ensure_ascii=False)
    db = get_db()
    cursor = db.execute(
        "INSERT INTO requests (request_type, payload, status, created_at) VALUES (?, ?, ?, ?)",
        ("SOS", payload, "Emergency Alert Created", datetime.now().isoformat(timespec="minutes")),
    )
    db.commit()
    return jsonify({
        "ok": True,
        "id": cursor.lastrowid,
        "message": "SOS request recorded. Connect this endpoint to your approved emergency notification service."
    })


with app.app_context():
    init_db()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 5000)), debug=True)
