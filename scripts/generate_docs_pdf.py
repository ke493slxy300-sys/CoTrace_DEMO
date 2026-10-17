"""Generate preset PDFs from public/docs/sources/*.md into public/docs/."""

from __future__ import annotations

from pathlib import Path

from fpdf import FPDF

ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / "public" / "docs" / "sources"
OUT_DIR = ROOT / "public" / "docs"
FONT = ROOT / "public" / "fonts" / "Noto_Sans_SC" / "static" / "NotoSansSC-Regular.ttf"

DOCS = [
    ("ai-consensus-protocol.md", "ai-consensus-protocol.pdf"),
    ("se-course-requirements.md", "se-course-requirements.pdf"),
    ("role-review-guide.md", "role-review-guide.pdf"),
]


def md_to_plain_lines(text: str) -> list[tuple[str, str]]:
    """Return list of (kind, text) where kind is title|heading|body|bullet."""
    lines: list[tuple[str, str]] = []
    for raw in text.splitlines():
        line = raw.rstrip()
        if not line.strip():
            lines.append(("blank", ""))
            continue
        if line.startswith("# "):
            lines.append(("title", line[2:].strip()))
        elif line.startswith("## "):
            lines.append(("heading", line[3:].strip()))
        elif line.startswith("- "):
            lines.append(("bullet", line[2:].strip()))
        else:
            lines.append(("body", line.strip()))
    return lines


def write_pdf(md_path: Path, pdf_path: Path) -> None:
    content = md_path.read_text(encoding="utf-8")
    blocks = md_to_plain_lines(content)

    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=18)
    pdf.add_page()
    pdf.add_font("Noto", "", str(FONT))
    pdf.set_margins(16, 16, 16)
    width = pdf.epw

    for kind, text in blocks:
        if kind == "blank":
            pdf.ln(4)
            continue
        if kind == "title":
            pdf.set_font("Noto", size=16)
            pdf.multi_cell(width, 10, text)
            pdf.ln(2)
        elif kind == "heading":
            pdf.ln(2)
            pdf.set_font("Noto", size=13)
            pdf.multi_cell(width, 8, text)
            pdf.ln(1)
        elif kind == "bullet":
            pdf.set_font("Noto", size=11)
            pdf.multi_cell(width, 7, f"• {text}")
        else:
            pdf.set_font("Noto", size=11)
            pdf.multi_cell(width, 7, text)

    pdf_path.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(pdf_path))
    print(f"wrote {pdf_path.relative_to(ROOT)} ({pdf_path.stat().st_size} bytes)")


def main() -> None:
    if not FONT.exists():
        raise SystemExit(f"Missing font: {FONT}")
    for src_name, out_name in DOCS:
        write_pdf(SOURCES / src_name, OUT_DIR / out_name)
    test = OUT_DIR / "_test.pdf"
    if test.exists():
        test.unlink()


if __name__ == "__main__":
    main()
