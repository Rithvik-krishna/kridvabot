from __future__ import annotations

import io
import os
import random
import re
import threading
import time
import zipfile
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Callable, TypeVar

from google import genai
from google.genai import errors as genai_errors
from google.genai import types
from PIL import Image, ImageOps

from excel_builder import CatalogRowItem, build_catalog_excel
from models import GroupingResult, PhotoGroup, ProductMetadata
from prompts import (
    FRONT_ANGLE_SUFFIX,
    SIDE_ANGLE_SUFFIX,
    build_grouping_prompt,
    build_metadata_prompt,
)

T = TypeVar("T")

FALLBACK_ARTISAN_NAMES = [
    "Aarav",
    "Tara",
    "Sona",
    "Kavya",
    "Mira",
    "Zora",
    "Luma",
    "Ira",
    "Devan",
    "Kora",
    "Vela",
    "Oria",
    "Prana",
    "Tala",
    "Maya",
    "Bodhi",
    "Alva",
    "Nila",
    "Riya",
    "Surya",
    "Ananya",
    "Kiran",
    "Dara",
    "Nemi",
]


def get_gemini_client() -> genai.Client:
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key or api_key == "your_gemini_api_key_here":
        raise RuntimeError(
            "GEMINI_API_KEY is not set. Add a valid GEMINI_API_KEY to backend/.env and restart the server."
        )
    return genai.Client(api_key=api_key)


def _is_transient_error(exc: Exception) -> bool:
    if isinstance(exc, (OSError, TimeoutError, ConnectionError)):
        return True
    if isinstance(exc, genai_errors.APIError):
        return exc.code in {429, 500, 502, 503, 504}
    msg = str(exc).lower()
    return any(
        token in msg
        for token in (
            "429",
            "rate limit",
            "resource exhausted",
            "503",
            "500",
            "504",
            "timeout",
            "temporarily",
            "empty content",
            "did not contain image data",
            "no candidates",
            "getaddrinfo",
            "connecterror",
            "connection",
            "network",
            "ssl",
            "eof",
            "reset",
        )
    )


def retry_with_backoff(fn: Callable[[], T], max_attempts: int = 5, base_delay: float = 2.0) -> T:
    last_exc: Exception | None = None
    for attempt in range(1, max_attempts + 1):
        try:
            return fn()
        except Exception as exc:  # noqa: BLE001
            last_exc = exc
            if attempt == max_attempts or not _is_transient_error(exc):
                raise
            delay = base_delay * (2 ** (attempt - 1)) + random.uniform(0, 0.75)
            time.sleep(delay)
    assert last_exc is not None
    raise last_exc


def _image_to_part(image_path: Path, mime_type: str | None = None) -> types.Part:
    suffix = image_path.suffix.lower()
    if mime_type is None:
        if suffix in {".jpg", ".jpeg"}:
            mime_type = "image/jpeg"
        elif suffix == ".webp":
            mime_type = "image/webp"
        else:
            mime_type = "image/png"
    return types.Part.from_bytes(data=image_path.read_bytes(), mime_type=mime_type)


def _ensure_square_image(img: Image.Image) -> Image.Image:
    """Center-pad non-square images to 1:1 without cropping any part of the furniture."""
    rgb = img.convert("RGB")
    w, h = rgb.size
    if w == h:
        return rgb
    side = max(w, h)
    # Sample top-left corner pixel as neutral studio background fill
    bg_color = rgb.getpixel((0, 0))
    canvas = Image.new("RGB", (side, side), bg_color)
    offset = ((side - w) // 2, (side - h) // 2)
    canvas.paste(rgb, offset)
    return canvas


def _extract_image_from_response(response: types.GenerateContentResponse) -> Image.Image:
    if not response.candidates:
        raise RuntimeError("Gemini image generation returned no candidates.")
    candidate = response.candidates[0]
    content = getattr(candidate, "content", None)
    parts = getattr(content, "parts", None) if content is not None else None
    if not parts:
        finish_reason = getattr(candidate, "finish_reason", "unknown")
        raise RuntimeError(f"Gemini image generation returned empty content (finish_reason={finish_reason}).")
    for part in parts:
        if part.inline_data and part.inline_data.data:
            raw_bytes = part.inline_data.data
            with Image.open(io.BytesIO(raw_bytes)) as img:
                return _ensure_square_image(ImageOps.exif_transpose(img))
    raise RuntimeError("Gemini image generation response did not contain image data.")


def _slugify(text: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_")
    return slug or "furniture_piece"


def _first_word(name: str) -> str:
    parts = name.strip().split()
    return re.sub(r"[^a-z0-9]", "", parts[0].lower()) if parts else ""


def _replace_first_word(name: str, new_first: str) -> str:
    parts = name.strip().split()
    if len(parts) <= 1:
        return new_first
    return f"{new_first} {' '.join(parts[1:])}"


def _pick_unused_artisan_name(used_first_words: set[str]) -> str:
    for candidate in FALLBACK_ARTISAN_NAMES:
        if candidate.lower() not in used_first_words:
            return candidate
    idx = len(used_first_words) + 1
    return f"Atelier{idx}"


def group_uploaded_images(client: genai.Client, thumb_paths: list[Path]) -> list[PhotoGroup]:
    num_images = len(thumb_paths)
    if num_images == 0:
        return []
    if num_images == 1:
        return [PhotoGroup(id="group-1", image_ids=[0])]

    contents: list[object] = [build_grouping_prompt(num_images)]
    for idx, thumb_path in enumerate(thumb_paths):
        contents.append(f"Image {idx}:")
        contents.append(_image_to_part(thumb_path, mime_type="image/jpeg"))

    def _call() -> GroupingResult:
        resp = client.models.generate_content(
            model="gemini-3.8-flash",
            contents=contents,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=GroupingResult,
                temperature=0.1,
                thinking_config=types.ThinkingConfig(thinking_budget=1024),
            ),
        )
        if resp.parsed is not None and isinstance(resp.parsed, GroupingResult):
            return resp.parsed
        if resp.text:
            return GroupingResult.model_validate_json(resp.text)
        raise RuntimeError("Empty grouping response from Gemini Vision.")

    result = retry_with_backoff(_call)

    # Post-process: deduplicate indices, drop out-of-range indices, add missed indices as fallback groups
    seen: set[int] = set()
    cleaned_groups: list[list[int]] = []

    for cluster in result.groups:
        valid_ids: list[int] = []
        for idx in cluster.image_indices:
            if 0 <= idx < num_images and idx not in seen:
                seen.add(idx)
                valid_ids.append(idx)
        if valid_ids:
            cleaned_groups.append(valid_ids)

    for idx in range(num_images):
        if idx not in seen:
            cleaned_groups.append([idx])

    return [
        PhotoGroup(id=f"group-{i + 1}", image_ids=ids)
        for i, ids in enumerate(cleaned_groups)
    ]


def _generate_single_view(
    client: genai.Client,
    raw_paths: list[Path],
    full_prompt: str,
    dest_path: Path,
) -> Path:
    if dest_path.exists() and dest_path.stat().st_size > 10_000:
        return dest_path

    # Pass up to 6 evenly-spaced reference photos if a piece has many angles
    selected_paths = raw_paths
    if len(raw_paths) > 6:
        step = (len(raw_paths) - 1) / 5
        selected_paths = [raw_paths[round(i * step)] for i in range(6)]

    contents: list[object] = [full_prompt]
    for path in selected_paths:
        contents.append(_image_to_part(path))

    def _call_model(model_name: str) -> Image.Image:
        resp = client.models.generate_content(
            model=model_name,
            contents=contents,
            config=types.GenerateContentConfig(
                response_modalities=["IMAGE"],
                image_config=types.ImageConfig(aspect_ratio="1:1"),
            ),
        )
        return _extract_image_from_response(resp)

    try:
        square_img = retry_with_backoff(lambda: _call_model("gemini-2.5-flash-image"), max_attempts=3)
    except Exception:
        square_img = retry_with_backoff(lambda: _call_model("gemini-3.1-flash-image"), max_attempts=3)
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    square_img.save(dest_path, format="PNG")
    return dest_path


def _generate_product_metadata(
    client: genai.Client,
    front_image_path: Path,
    used_first_words: set[str],
) -> ProductMetadata:
    prompt = build_metadata_prompt(list(used_first_words))
    contents: list[object] = [prompt, _image_to_part(front_image_path, mime_type="image/png")]

    def _call() -> ProductMetadata:
        resp = client.models.generate_content(
            model="gemini-3.8-flash",
            contents=contents,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=ProductMetadata,
                temperature=0.4,
                thinking_config=types.ThinkingConfig(thinking_budget=0),
            ),
        )
        if resp.parsed is not None and isinstance(resp.parsed, ProductMetadata):
            return resp.parsed
        if resp.text:
            return ProductMetadata.model_validate_json(resp.text)
        raise RuntimeError("Empty metadata response from Gemini.")

    meta = retry_with_backoff(_call)

    # Enforce strict deduplication in Python as a safety net
    fw1 = _first_word(meta.name_option_1)
    if not fw1 or fw1 in used_first_words:
        new_fw1 = _pick_unused_artisan_name(used_first_words)
        old_name_1 = meta.name_option_1
        meta.name_option_1 = _replace_first_word(meta.name_option_1, new_fw1)
        if old_name_1 and old_name_1 in meta.short_description:
            meta.short_description = meta.short_description.replace(old_name_1, meta.name_option_1)
        fw1 = new_fw1.lower()
    used_first_words.add(fw1)

    fw2 = _first_word(meta.name_option_2)
    if not fw2 or fw2 in used_first_words:
        new_fw2 = _pick_unused_artisan_name(used_first_words)
        meta.name_option_2 = _replace_first_word(meta.name_option_2, new_fw2)
        fw2 = new_fw2.lower()
    used_first_words.add(fw2)

    if not meta.short_description.strip().startswith(f"The {meta.name_option_1}"):
        desc = meta.short_description.strip()
        if desc:
            meta.short_description = f"The {meta.name_option_1} {desc[0].lower()}{desc[1:]}"

    return meta


def run_generation_pipeline(
    job_dir: Path,
    image_id_to_raw: dict[int, Path],
    groups: list[PhotoGroup],
    studio_prompt: str,
    existing_names: list[str],
    progress_callback: Callable[[int, int, str], None],
) -> Path:
    client = get_gemini_client()
    output_dir = job_dir / "output"
    output_dir.mkdir(parents=True, exist_ok=True)

    active_groups = [g for g in groups if g.image_ids]
    total_pieces = len(active_groups)
    if total_pieces == 0:
        raise ValueError("No valid photo groups provided for generation.")

    # Total steps: 1 per piece for studio image rendering + 1 for metadata & packaging
    total_steps = total_pieces + 1
    completed_lock = threading.Lock()
    completed_count = 0

    progress_callback(0, total_steps, f"Rendering studio photos for {total_pieces} furniture pieces...")

    front_prompt = f"{studio_prompt.strip()}{FRONT_ANGLE_SUFFIX}"
    side_prompt = f"{studio_prompt.strip()}{SIDE_ANGLE_SUFFIX}"

    rendered_pieces: dict[int, tuple[Path, Path]] = {}

    def _render_piece(piece_idx: int, group: PhotoGroup) -> tuple[int, Path, Path]:
        raw_paths = [image_id_to_raw[img_id] for img_id in group.image_ids if img_id in image_id_to_raw]
        if not raw_paths:
            raise ValueError(f"Group {group.id} has no valid image files.")

        front_path = output_dir / f"piece_{piece_idx:02d}_front.png"
        side_path = output_dir / f"piece_{piece_idx:02d}_side.png"

        _generate_single_view(client, raw_paths, front_prompt, front_path)
        _generate_single_view(client, raw_paths, side_prompt, side_path)
        return piece_idx, front_path, side_path

    with ThreadPoolExecutor(max_workers=3) as executor:
        futures = {
            executor.submit(_render_piece, idx, grp): idx
            for idx, grp in enumerate(active_groups, start=1)
        }
        for future in as_completed(futures):
            piece_idx, front_path, side_path = future.result()
            rendered_pieces[piece_idx] = (front_path, side_path)
            with completed_lock:
                completed_count += 1
                progress_callback(
                    completed_count,
                    total_steps,
                    f"Rendered studio front & side views ({completed_count}/{total_pieces} pieces)...",
                )

    # Sequential naming & copy generation for strict deduplication
    progress_callback(
        completed_count,
        total_steps,
        "Generating unique product names, features, and editorial copy...",
    )

    used_first_words: set[str] = {
        _first_word(name) for name in existing_names if _first_word(name)
    }

    catalog_items: list[CatalogRowItem] = []
    zip_images: list[tuple[Path, str]] = []

    for piece_idx in range(1, total_pieces + 1):
        front_path, side_path = rendered_pieces[piece_idx]
        meta = _generate_product_metadata(client, front_path, used_first_words)
        catalog_items.append(CatalogRowItem(front_image_path=front_path, metadata=meta))

        slug = _slugify(meta.name_option_1)
        zip_images.append((front_path, f"images/{piece_idx:02d}_{slug}_front.png"))
        zip_images.append((side_path, f"images/{piece_idx:02d}_{slug}_side.png"))

    excel_path = output_dir / "furniture_catalog.xlsx"
    build_catalog_excel(catalog_items, excel_path)

    zip_path = output_dir / "catalog_bundle.zip"
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.write(excel_path, arcname="furniture_catalog.xlsx")
        for src_path, arcname in zip_images:
            zf.write(src_path, arcname=arcname)

    progress_callback(total_steps, total_steps, "Catalog bundle ready for download.")
    return zip_path
