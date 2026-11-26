from __future__ import annotations

import io
import json
import os
import re
import shutil
import threading
import time
import uuid
from pathlib import Path

from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from PIL import Image, ImageOps, UnidentifiedImageError

from models import (
    GenerateRequest,
    GenerateStartResponse,
    ImageInfo,
    JobStatusResponse,
    UploadAndGroupResponse,
)
from pipeline import get_gemini_client, group_uploaded_images, run_generation_pipeline
from prompts import DEFAULT_STUDIO_PROMPT

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent
JOBS_DIR = BASE_DIR / "jobs"
JOBS_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="Furniture Catalog Bot API", version="1.0.0")

_allowed_origins_raw = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000",
)
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in _allowed_origins_raw.split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/jobs", StaticFiles(directory=str(JOBS_DIR)), name="jobs")

_STATE_LOCK = threading.Lock()


def cleanup_old_jobs(max_age_hours: int | None = None) -> int:
    """Remove expired job directories under JOBS_DIR to keep disk usage bounded."""
    if max_age_hours is None:
        try:
            max_age_hours = int(os.getenv("JOB_TTL_HOURS", "24"))
        except ValueError:
            max_age_hours = 24
    if max_age_hours <= 0:
        return 0

    cutoff = time.time() - (max_age_hours * 3600)
    removed = 0
    for entry in JOBS_DIR.iterdir():
        if not entry.is_dir():
            continue
        try:
            if entry.stat().st_mtime < cutoff:
                shutil.rmtree(entry, ignore_errors=True)
                removed += 1
        except OSError:
            continue
    return removed


@app.on_event("startup")
def _on_startup() -> None:
    cleanup_old_jobs()


def _sanitize_filename(filename: str | None, idx: int) -> str:
    raw_name = Path(filename or f"photo_{idx}.jpg").name
    stem = re.sub(r"[^a-zA-Z0-9._-]+", "_", Path(raw_name).stem).strip("_") or f"photo_{idx}"
    ext = Path(raw_name).suffix.lower() or ".jpg"
    if ext not in {".jpg", ".jpeg", ".png", ".webp"}:
        ext = ".png"
    return f"{idx:03d}_{stem}{ext}"


def _write_status(job_dir: Path, status_data: JobStatusResponse) -> None:
    with _STATE_LOCK:
        (job_dir / "status.json").write_text(status_data.model_dump_json(indent=2), encoding="utf-8")


def _read_status(job_dir: Path) -> JobStatusResponse:
    status_file = job_dir / "status.json"
    if not status_file.exists():
        raise HTTPException(status_code=404, detail="Job not found.")
    with _STATE_LOCK:
        return JobStatusResponse.model_validate_json(status_file.read_text(encoding="utf-8"))


@app.get("/api/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/default-prompt")
def get_default_prompt() -> dict[str, str]:
    return {"prompt": DEFAULT_STUDIO_PROMPT}


@app.post("/api/upload-and-group", response_model=UploadAndGroupResponse)
async def upload_and_group(files: list[UploadFile] = File(...)) -> UploadAndGroupResponse:
    if not files:
        raise HTTPException(status_code=400, detail="Please upload at least one image file.")

    try:
        client = get_gemini_client()
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    cleanup_old_jobs()

    job_id = uuid.uuid4().hex[:12]
    job_dir = JOBS_DIR / job_id
    raw_dir = job_dir / "raw"
    thumbs_dir = job_dir / "thumbs"
    output_dir = job_dir / "output"
    raw_dir.mkdir(parents=True, exist_ok=True)
    thumbs_dir.mkdir(parents=True, exist_ok=True)
    output_dir.mkdir(parents=True, exist_ok=True)

    images_info: list[ImageInfo] = []
    thumb_paths: list[Path] = []
    manifest_raw: dict[str, str] = {}

    for idx, upload in enumerate(files):
        content = await upload.read()
        if not content:
            raise HTTPException(status_code=400, detail=f"Uploaded file '{upload.filename}' is empty.")

        safe_name = _sanitize_filename(upload.filename, idx)
        raw_path = raw_dir / safe_name

        try:
            with Image.open(io.BytesIO(content)) as img:
                transposed = ImageOps.exif_transpose(img)
                transposed.load()
                raw_path.write_bytes(content)

                thumb = transposed.convert("RGB")
                thumb.thumbnail((512, 512), Image.Resampling.LANCZOS)
                thumb_filename = f"{idx:03d}_thumb.jpg"
                thumb_path = thumbs_dir / thumb_filename
                thumb.save(thumb_path, format="JPEG", quality=85)
        except (UnidentifiedImageError, OSError) as exc:
            raise HTTPException(
                status_code=400,
                detail=f"File '{upload.filename}' is not a valid supported image.",
            ) from exc

        thumb_paths.append(thumb_path)
        manifest_raw[str(idx)] = str(raw_path)
        images_info.append(
            ImageInfo(
                id=idx,
                filename=upload.filename or safe_name,
                thumb_url=f"/jobs/{job_id}/thumbs/{thumb_filename}",
            )
        )

    (job_dir / "manifest.json").write_text(json.dumps(manifest_raw, indent=2), encoding="utf-8")

    try:
        groups = group_uploaded_images(client, thumb_paths)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Gemini Vision grouping failed: {exc}") from exc

    _write_status(
        job_dir,
        JobStatusResponse(
            status="grouped",
            completed=0,
            total=len(groups),
            message="Photos grouped and ready for review.",
            error=None,
            download_url=None,
        ),
    )

    return UploadAndGroupResponse(job_id=job_id, images=images_info, groups=groups)


def _background_generate(job_id: str, req: GenerateRequest) -> None:
    job_dir = JOBS_DIR / job_id
    manifest_path = job_dir / "manifest.json"
    if not manifest_path.exists():
        _write_status(
            job_dir,
            JobStatusResponse(
                status="error",
                completed=0,
                total=0,
                message="Job manifest missing.",
                error="Job manifest not found on disk.",
                download_url=None,
            ),
        )
        return

    raw_map = {int(k): Path(v) for k, v in json.loads(manifest_path.read_text(encoding="utf-8")).items()}
    total_steps = len([g for g in req.groups if g.image_ids]) + 1

    def _on_progress(completed: int, total: int, message: str) -> None:
        _write_status(
            job_dir,
            JobStatusResponse(
                status="processing",
                completed=completed,
                total=total,
                message=message,
                error=None,
                download_url=None,
            ),
        )

    try:
        run_generation_pipeline(
            job_dir=job_dir,
            image_id_to_raw=raw_map,
            groups=req.groups,
            studio_prompt=req.prompt,
            existing_names=req.existing_names,
            progress_callback=_on_progress,
        )
        _write_status(
            job_dir,
            JobStatusResponse(
                status="done",
                completed=total_steps,
                total=total_steps,
                message="Catalog ZIP is ready to download.",
                error=None,
                download_url=f"/api/download/{job_id}",
            ),
        )
    except Exception as exc:  # noqa: BLE001
        _write_status(
            job_dir,
            JobStatusResponse(
                status="error",
                completed=0,
                total=total_steps,
                message="Catalog generation failed.",
                error=str(exc),
                download_url=None,
            ),
        )


@app.post("/api/generate/{job_id}", response_model=GenerateStartResponse)
def start_generation(
    job_id: str,
    req: GenerateRequest,
    background_tasks: BackgroundTasks,
) -> GenerateStartResponse:
    job_dir = JOBS_DIR / job_id
    if not job_dir.exists():
        raise HTTPException(status_code=404, detail="Job not found.")

    active_groups = [g for g in req.groups if g.image_ids]
    if not active_groups:
        raise HTTPException(status_code=400, detail="At least one non-empty furniture group is required.")

    try:
        get_gemini_client()
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    total_steps = len(active_groups) + 1
    _write_status(
        job_dir,
        JobStatusResponse(
            status="processing",
            completed=0,
            total=total_steps,
            message="Starting studio photo generation...",
            error=None,
            download_url=None,
        ),
    )

    background_tasks.add_task(_background_generate, job_id, req)
    return GenerateStartResponse(status="started", job_id=job_id)


@app.get("/api/status/{job_id}", response_model=JobStatusResponse)
def get_job_status(job_id: str) -> JobStatusResponse:
    job_dir = JOBS_DIR / job_id
    if not job_dir.exists():
        raise HTTPException(status_code=404, detail="Job not found.")
    return _read_status(job_dir)


@app.get("/api/download/{job_id}")
def download_bundle(job_id: str) -> FileResponse:
    zip_path = JOBS_DIR / job_id / "output" / "catalog_bundle.zip"
    if not zip_path.exists():
        raise HTTPException(status_code=404, detail="Catalog ZIP is not ready yet.")
    return FileResponse(
        path=zip_path,
        media_type="application/zip",
        filename="catalog_bundle.zip",
    )
