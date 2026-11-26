from __future__ import annotations

import io
from dataclasses import dataclass
from pathlib import Path

from openpyxl import Workbook
from openpyxl.drawing.image import Image as XLImage
from openpyxl.styles import Alignment, Font
from PIL import Image as PILImage

from models import ProductMetadata


@dataclass
class CatalogRowItem:
    front_image_path: Path
    metadata: ProductMetadata


def _build_features_html(meta: ProductMetadata) -> str:
    return (
        "<p><strong>Product Features</strong></p>\n"
        '<ul class="ps-3">\n'
        f"<li>Material – {meta.material}</li>\n"
        f"<li>Finish – {meta.finish}</li>\n"
        f"<li>Polish colour – {meta.polish_color} (Customisable on request)</li>\n"
        '<li>Dimensions: Height: TBD" | Width: TBD" | Depth: TBD"</li>\n'
        "<li>Handcrafted from natural timber; subtle grain and colour variations make every piece one of a kind.</li>\n"
        "<li>Actual tones may vary slightly depending on screen calibration and lighting.</li>\n"
        "</ul>\n"
        '<p class="mt-3"><a href="/pages/product-understanding" class="text-uppercase">'
        "<u><b>Product Understanding & Care Instructions</b></u></a></p>"
    )


def build_catalog_excel(items: list[CatalogRowItem], output_xlsx_path: Path) -> None:
    wb = Workbook()
    ws = wb.active
    ws.title = "Catalog"

    headers = ["NAME", "SIZE AND FEATURES", "PRICE", "Category", "CONTENT"]
    ws.append(headers)

    header_font = Font(bold=True)
    header_alignment = Alignment(vertical="center", horizontal="left")
    for col_idx in range(1, len(headers) + 1):
        cell = ws.cell(row=1, column=col_idx)
        cell.font = header_font
        cell.alignment = header_alignment
    ws.row_dimensions[1].height = 24

    column_widths = {
        "A": 32,
        "B": 65,
        "C": 14,
        "D": 18,
        "E": 55,
    }
    for col_letter, width in column_widths.items():
        ws.column_dimensions[col_letter].width = width

    # Keep BytesIO buffers alive until wb.save() completes
    image_buffers: list[io.BytesIO] = []

    for idx, item in enumerate(items, start=2):
        meta = item.metadata
        ws.row_dimensions[idx].height = 175

        # Column A: 180x180 front-view thumbnail anchored at top-left + name options at bottom
        with PILImage.open(item.front_image_path) as img:
            thumb = img.convert("RGB").resize((180, 180), PILImage.Resampling.LANCZOS)
            buf = io.BytesIO()
            thumb.save(buf, format="PNG")
            buf.seek(0)
            image_buffers.append(buf)

        xl_img = XLImage(buf)
        xl_img.width = 180
        xl_img.height = 180
        ws.add_image(xl_img, f"A{idx}")

        name_cell = ws.cell(
            row=idx,
            column=1,
            value=f"Option 1: {meta.name_option_1}\nOption 2: {meta.name_option_2}",
        )
        name_cell.alignment = Alignment(vertical="bottom", horizontal="left", wrap_text=True)

        # Column B: SIZE AND FEATURES
        features_cell = ws.cell(row=idx, column=2, value=_build_features_html(meta))
        features_cell.alignment = Alignment(vertical="top", horizontal="left", wrap_text=True)

        # Column C: PRICE (left empty for manual entry)
        ws.cell(row=idx, column=3, value=None)

        # Column D: Category
        cat_cell = ws.cell(row=idx, column=4, value=meta.category)
        cat_cell.alignment = Alignment(vertical="top", horizontal="left", wrap_text=True)

        # Column E: CONTENT
        content_cell = ws.cell(row=idx, column=5, value=f"<p>{meta.short_description}</p>")
        content_cell.alignment = Alignment(vertical="top", horizontal="left", wrap_text=True)

    output_xlsx_path.parent.mkdir(parents=True, exist_ok=True)
    wb.save(output_xlsx_path)
