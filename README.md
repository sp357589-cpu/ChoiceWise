# ChoiceWise (Decision Maker)

Static frontend (root `index.html`) + Flask backend (`backend/app.py`) suitable for **Render**.

## Run locally (Windows / PowerShell)

```powershell
cd C:\Decision_Maker
python -m venv .venv
.\.venv\Scripts\python -m pip install -r .\requirements.txt
$env:PORT=5055
.\.venv\Scripts\python .\backend\app.py
```

Open `http://127.0.0.1:5055/`.

## API endpoints used by the frontend

- `GET /api/health`
- `POST /api/decisions`
- `GET /api/decisions`
- `GET /api/decisions/<id>`
- `POST /api/decisions/<id>/share`
- `GET /api/decisions/share/<share_code>`
- `POST /api/auth/signup`
- `POST /api/auth/login`

## Deploy on Render (recommended setup)

### 1) Create a Web Service

- **Environment**: Python
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: (Render will use `Procfile`)  
  `gunicorn backend.app:app --bind 0.0.0.0:$PORT`

### 2) Configure Firebase (Firestore) on Render

In Render, set these **environment variables**:

- `FIRESTORE_PROJECT_ID` = your Firebase / GCP project id
- `FIREBASE_SERVICE_ACCOUNT_JSON` = the full Service Account JSON (as a single-line JSON string)

Notes:

- Do **not** commit `credentials.json` to the repo.
- The app will write the service account JSON to a temp file at runtime and set `GOOGLE_APPLICATION_CREDENTIALS` automatically.

### 3) Verify after deploy

- Visit `/api/health`
- Create a decision in the UI, then click **Load All Decisions**
- Click **Share** and open the generated `share.html?code=...` link

