# Furniture Catalog Bot

Full-stack local web application for transforming raw workshop furniture photos into a structured e-commerce catalog bundle:

1. **Upload & Auto-Group** — Upload a bulk batch of raw workshop photos (1–3 per piece). Gemini Vision (`gemini-2.5-flash`) automatically clusters them by furniture piece.
2. **Interactive Group Review** — Move, split into a new group, or remove misgrouped/blurry photos in the browser before generating.
3. **Studio Generation & Catalog Export** — Generates 2 studio-quality 1:1 square PNGs per piece (**Front** & **Side** perspectives via `gemini-2.5-flash-image`), 2 unique artisan name options, category, HTML product features, and 2–3 sentence editorial copy, then packages everything with `furniture_catalog.xlsx` (including embedded 180×180 front thumbnails) into `catalog_bundle.zip`.

---

## Project Structure

- `backend/` — FastAPI server, Gemini AI pipeline (`pipeline.py`), `openpyxl` Excel builder (`excel_builder.py`), ZIP packager, `requirements.txt`, and `.env.example`.
- `frontend/` — Next.js App Router + Tailwind CSS dashboard (`app/page.tsx` and modular components in `components/`).

---

## Local Setup & Run Commands

### 1. Backend (FastAPI)

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
# Edit backend\.env and set GEMINI_API_KEY=<your_key>
uvicorn main:app --reload --port 8000
```

### 2. Frontend (Next.js)

```powershell
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.
