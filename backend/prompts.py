DEFAULT_STUDIO_PROMPT = """Create a professional e-commerce catalog photograph of this furniture piece in a strict 1:1 square aspect ratio.
- Framing: Cleanly centered with balanced negative space so the product feels neither cropped nor floating, ready for website grids, marketplaces, print, and social media.
- Product Integrity: Keep the original furniture piece 100% untouched—no change in dimensions, proportions, scale, colour, polish, material, cane/rattan pattern, or wood grain.
- Photoshoot Look: Realistic studio lighting with natural floor shadows and proper grounding; zero AI artifacts or distortions.
- Background: Minimal, premium catalog-ready setting with a neutral or warm textured wall and clean wooden or neutral flooring.
- Consistency: Maintain a cohesive visual language across the entire furniture collection."""

FRONT_ANGLE_SUFFIX = (
    "\n\nCamera angle: Straight-on FRONT perspective, eye-level, "
    "cleanly centered in a 1:1 square frame."
)

SIDE_ANGLE_SUFFIX = (
    "\n\nCamera angle: Clean 45-degree or 90-degree SIDE profile perspective "
    "showing depth, side profile, and joinery, cleanly centered in a 1:1 square frame."
)


def build_grouping_prompt(num_images: int) -> str:
    return (
        f"You are organizing {num_images} raw workshop furniture photos (indexed 0 to {num_images - 1}). "
        "Each photo is labeled with its 0-based index immediately before the image.\n\n"
        "Step 1 (`image_tags`): For EVERY image 0 to "
        f"{num_images - 1}, identify its exact `furniture_type` (e.g., Cane-panel Bed, Spindle-footboard Bed, "
        "Striped Armchair, Floral-back Armchair, Bobbin-leg Console Table, White Fluted Nightstand, Cane-drawer Nightstand) "
        "and its `distinctive_traits` (wood color, upholstery fabric, footboard/headboard design, leg style, drawer count).\n\n"
        "Step 2 (`groups`): Cluster the images so that each group contains ALL photos of the EXACT SAME physical furniture piece "
        "(front, side, back, or slightly different angles/duplicate shots of the same piece).\n"
        "CRITICAL RULES:\n"
        "- NEVER mix different furniture types in the same group (e.g., never group a bed with a chair, or a table with a nightstand).\n"
        "- NEVER mix two different designs of the same type (e.g., a bed with a solid cane footboard is DIFFERENT from a bed with vertical wooden spindles on the footboard; a white fluted nightstand is DIFFERENT from a cane-drawer nightstand).\n"
        "- DO group all photos of the same exact piece together even if there are 4, 5, or more shots of it—do NOT split the same piece into duplicate groups.\n"
        f"- Every index from 0 to {num_images - 1} must appear in exactly one group, with no duplicates and no omissions."
    )


def build_metadata_prompt(forbidden_first_words: list[str]) -> str:
    forbidden_str = ", ".join(sorted(set(forbidden_first_words))) if forbidden_first_words else "None"
    return f"""Analyze this studio photograph of a handcrafted furniture piece and generate catalog metadata.

NAMING RULES:
- Provide TWO distinct name options (`name_option_1` and `name_option_2`).
- Each name MUST follow the pattern: `<Evocative 1-word artisan name> <Material/Piece Type>` (e.g., "Ruma Rattan Sofa", "Nora Chair", "Kaya Side Table").
- Use short, evocative, memorable 1-word artisan names with an Indian or minimalist global feel (e.g., Aarav, Tara, Sona, Kavya, Mira, Zora, Luma, Ira, Devan, Kora, Vela, Oria, Prana, Tala, Maya, Bodhi, Alva,Surya, Nila, Riya).
- CRITICAL DEDUPLICATION RULE: Do NOT use any of these already-used first words for either `name_option_1` or `name_option_2`:
  [{forbidden_str}]
- `name_option_1` and `name_option_2` must also have DIFFERENT first words from each other.

DESCRIPTION (`short_description`) STYLE RULES:
- Write 2 to 3 warm, refined, inviting sentences.
- MUST start with `"The {{name_option_1}}..."` (using the exact `name_option_1` you chose).
- Highlight specific visual design details visible in the photo (wood grain, fluted/carved details, cane weave, silhouette, base/legs, upholstery, finish) and how it fits naturally into a home.
- Match this exact tone, warmth, and rhythm:
  "The Kaya Table brings a touch of playful elegance with its rounded wooden top and distinctive fluted edge. Its warm finish and simple pedestal base give it a relaxed, inviting character, making it a charming companion beside a sofa, armchair, or bed."

SPECIFICATION FIELDS:
- `category`: Clean catalog category (e.g., "Sofas", "Chairs", "Tables", "Side Tables", "Cabinets", "Benches", "Stools").
- `material`: Accurate materials visible in the piece (e.g., "Solid Teak Wood & Natural Cane").
- `finish`: Surface finish visible (e.g., "Matte Natural", "Satin Hand-Rubbed").
- `polish_color`: Polish/stain tone visible (e.g., "Warm Honey Teak", "Natural Walnut", "Raw Oak").
"""
