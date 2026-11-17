from __future__ import annotations

from app.schemas.models import CaptionSegment


def format_ass_time(seconds: float) -> str:
    if seconds < 0:
        seconds = 0
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = seconds % 60
    return f"{hours:d}:{minutes:02d}:{secs:05.2f}"


def generate_ass(captions: list[CaptionSegment], style: dict | None = None) -> str:
    style = style or {}
    font_name = style.get("font_name", "Noto Sans Ethiopic")
    font_size = style.get("font_size", 48)
    primary = style.get("primary_color", "&H00FFFFFF")
    outline = style.get("outline_color", "&H00000000")
    header = f"""[Script Info]
Title: YeneCut AI Captions
ScriptType: v4.00+
WrapStyle: 0
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,{font_name},{font_size},{primary},&H000000FF,{outline},&H00000000,0,0,0,0,100,100,0,0,1,2,1,2,40,40,40,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    events = []
    for caption in captions:
        text = caption.text.replace("\n", "\\N")
        events.append(
            f"Dialogue: 0,{format_ass_time(caption.start)},{format_ass_time(caption.end)},Default,,0,0,0,,{text}"
        )
    return header + "\n".join(events) + "\n"
