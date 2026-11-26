from __future__ import annotations

from typing import Literal
from pydantic import BaseModel, Field


class ImageInfo(BaseModel):
    id: int
    filename: str
    thumb_url: str


class PhotoGroup(BaseModel):
    id: str
    image_ids: list[int]


class UploadAndGroupResponse(BaseModel):
    job_id: str
    images: list[ImageInfo]
    groups: list[PhotoGroup]


class GenerateRequest(BaseModel):
    groups: list[PhotoGroup]
    prompt: str
    existing_names: list[str] = Field(default_factory=list)


class GenerateStartResponse(BaseModel):
    status: Literal["started"]
    job_id: str


class JobStatusResponse(BaseModel):
    status: Literal["grouped", "processing", "done", "error"]
    completed: int
    total: int
    message: str
    error: str | None = None
    download_url: str | None = None


# --- Gemini Structured Output Schemas ---


class GeminiImageTag(BaseModel):
    index: int = Field(description="0-based image index.")
    furniture_type: str = Field(
        description="Specific furniture category, e.g. 'Cane-panel Bed', 'Spindle-footboard Bed', 'Upholstered Armchair', 'Console Table', 'Nightstand'."
    )
    distinctive_traits: str = Field(
        description="Key visual details: upholstery/fabric, wood tone, leg shape, cane/fluted details, background cues."
    )


class GeminiGroupCluster(BaseModel):
    label: str = Field(description="Short label describing this exact furniture piece.")
    image_indices: list[int] = Field(
        description="0-based indices of all images showing this exact same physical furniture piece."
    )


class GroupingResult(BaseModel):
    image_tags: list[GeminiImageTag] = Field(
        description="Visual identification for every input image from 0 to N-1."
    )
    groups: list[GeminiGroupCluster] = Field(
        description="List of furniture piece clusters. Every input image index must appear in exactly one group."
    )


class ProductMetadata(BaseModel):
    name_option_1: str = Field(
        description="First evocative 1-word artisan name + material/piece type, e.g. 'Ruma Rattan Sofa' or 'Nora Chair'."
    )
    name_option_2: str = Field(
        description="Second distinct evocative 1-word artisan name + material/piece type."
    )
    category: str = Field(
        description="Concise furniture category, e.g. 'Sofas', 'Chairs', 'Side Tables', 'Dining Tables', 'Cabinets', 'Benches'."
    )
    material: str = Field(
        description="Primary materials visible, e.g. 'Solid Teak Wood & Natural Cane Rattan'."
    )
    finish: str = Field(
        description="Surface finish visible, e.g. 'Matte Natural Hand-Rubbed'."
    )
    polish_color: str = Field(
        description="Polish or stain color visible, e.g. 'Warm Honey Teak'."
    )
    short_description: str = Field(
        description="2 to 3 warm, refined, inviting sentences starting with 'The {name_option_1}...'."
    )
