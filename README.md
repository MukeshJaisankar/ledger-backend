# The Ledger — Personal Expense Tracker

A Neo-Newspaper / Brutalist Finance personal expense tracker built with **FastAPI + React + MongoDB**, with bank statement upload (CSV/Excel), auto-categorisation, budgets, recurring detection, charts, CSV/PDF export, and AI re-categorisation via Claude Sonnet 4.5.

---

## Stack
- **Backend**: FastAPI · Motor (async MongoDB) · Pandas · openpyxl · ReportLab · emergentintegrations (LLM)
- **Frontend**: React 19 (CRA + CRACO) · Tailwind CSS · shadcn/ui · Recharts · iconoir-react · sonner · react-fast-marquee
- **Fonts**: Cabinet Grotesk (Fontshare CDN) + IBM Plex Sans/Mono (@fontsource)
- **DB**: MongoDB 6+

---

## Project structure
```
.
├── backend/
│   ├── server.py            # All API routes
│   ├── requirements.txt
│   └── .env                 # MONGO_URL, DB_NAME, CORS_ORIGINS, EMERGENT_LLM_KEY
├── frontend/
│   ├── package.json
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── craco.config.js
│   ├── .env                 # REACT_APP_BACKEND_URL
│   ├── public/
│   └── src/
│       ├── index.js
│       ├── index.css
│       ├── App.js
│       ├── App.css
│       ├── lib/api.js
│       └── components/
│           ├── Masthead.jsx
│           ├── Tabs.jsx
│           ├── Overview.jsx
│           ├── Transactions.jsx
│           ├── Upload.jsx
│           ├── Budgets.jsx
│           ├── Recurring.jsx
│           └── Export.jsx
└── README.md
```

---

## Local setup

### Prerequisites
- Python 3.11+
- Node 18+ and Yarn 1.22+
- MongoDB running locally on `mongodb://localhost:27017`

### 1. Backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
# Optional: install emergentintegrations for AI re-categorisation
pip install emergentintegrations --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/
cp .env.example .env  # then edit
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

`backend/.env`:
```
MONGO_URL=mongodb://localhost:27017
DB_NAME=ledger
CORS_ORIGINS=*
EMERGENT_LLM_KEY=<your-emergent-universal-key>
```
> If you don't have an Emergent universal key, leave `EMERGENT_LLM_KEY` blank — only the AI Re-categorise button will fail; everything else works.

### 2. Frontend
```bash
cd frontend
yarn install
cp .env.example .env  # then edit
yarn start
```

`frontend/.env`:
```
REACT_APP_BACKEND_URL=http://localhost:8001
WDS_SOCKET_PORT=443
```

### 3. Open the app
Visit `http://localhost:3000` and click **"Load Demo Data"** to seed 3 months of Indian-bank-style transactions.

---

## API reference (all prefixed with `/api`)

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/upload-statement` | Upload CSV/XLSX bank statement (multipart) |
| `GET` | `/transactions` | List with optional `search`, `category`, `type`, `start`, `end` |
| `PATCH` | `/transactions/{id}` | Update category/merchant/description |
| `DELETE` | `/transactions/{id}` | Delete one |
| `DELETE` | `/transactions` | Clear all |
| `GET` | `/dashboard` | Totals, by-category, monthly, top merchants |
| `GET` | `/categories` | Available categories |
| `GET`/`POST`/`DELETE` | `/budgets` | Manage monthly budgets |
| `GET` | `/recurring` | Detected recurring charges |
| `GET` | `/export/csv` · `/export/pdf` | Download statement |
| `POST` | `/recategorize` | AI re-categorise "Other" txns (Claude Sonnet 4.5) |
| `POST` | `/seed-demo` | Seed 3 months of demo data |

---

## Deployment

### Option A — Vercel (frontend) + Render/Railway (backend) + MongoDB Atlas
1. Push this repo to GitHub.
2. **Backend** — deploy `/backend` to Render or Railway with a `Procfile`:
   ```
   web: uvicorn server:app --host 0.0.0.0 --port $PORT
   ```
   Set env vars: `MONGO_URL` (Atlas URI), `DB_NAME`, `CORS_ORIGINS=https://your-frontend.vercel.app`, `EMERGENT_LLM_KEY`.
3. **Frontend** — deploy `/frontend` to Vercel. Set env var `REACT_APP_BACKEND_URL=https://your-backend.example.com`.

### Option B — Single VPS with Docker Compose
Create a `docker-compose.yml` with three services: `mongo`, `backend` (uvicorn), `frontend` (nginx serving `yarn build`). Reverse-proxy `/api` to backend.

---

## Tips for first-time users

1. Click **Load Demo Data** to feel the app instantly.
2. **Upload Section → Download Sample CSV** shows the column format.
3. Most Indian banks (HDFC / SBI / ICICI / Axis / Kotak) export with `Date, Narration, Debit, Credit` columns — these are auto-detected.
4. **Edit category** by clicking the category badge in the transactions table.
5. **AI Re-categorise** button cleans up anything stuck in "Other".

---

## License
MIT
