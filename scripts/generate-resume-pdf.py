"""Build the downloadable CV from the /resume Svelte page.

Run this script with Python packages lxml and reportlab installed. The PDF
follows the page content so the two do not drift.
"""

from html import escape
from pathlib import Path

from lxml import html
from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    HRFlowable,
    KeepTogether,
    ListFlowable,
    ListItem,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "src" / "routes" / "resume" / "+page.svelte"
OUTPUT = ROOT / "static" / "ben-bergenwall-cv.pdf"


def text(node):
    return " ".join(node.text_content().split())


def first(node, xpath):
    matches = node.xpath(xpath)
    if not matches:
        raise ValueError(f"CV source is missing {xpath}")
    return matches[0]


def paragraph(value, style):
    return Paragraph(escape(value), style)


def article_flowables(article, styles, content_width):
    name = text(first(article, "./div[contains(@class, 'entry-heading')]/heading"))
    date = text(first(article, "./div[contains(@class, 'entry-heading')]/span"))
    heading = Table(
        [[paragraph(name, styles["entry_name"]), paragraph(date, styles["date"])]],
        colWidths=[content_width * 0.64, content_width * 0.36],
        hAlign="LEFT",
    )
    heading.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    result = [heading]
    for role in article.xpath("./p[contains(@class, 'entry-role')]"):
        result.append(paragraph(text(role), styles["role"]))
    for description in article.xpath("./p[contains(@class, 'entry-description')]"):
        result.append(paragraph(text(description), styles["body"]))
    for list_node in article.xpath("./ul"):
        result.append(
            ListFlowable(
                [ListItem(paragraph(text(item), styles["body"]), leftIndent=0) for item in list_node.xpath("./li")],
                bulletType="bullet",
                start="circle",
                leftIndent=13,
                bulletFontName="Segoe",
                bulletFontSize=6,
                spaceBefore=2,
            )
        )
    result.append(Spacer(1, 6))
    return result


def main():
    if not SOURCE.exists():
        raise FileNotFoundError(f"Resume page is missing: {SOURCE}")

    font_dir = Path("C:/Windows/Fonts")
    pdfmetrics.registerFont(TTFont("Segoe", str(font_dir / "segoeui.ttf")))
    pdfmetrics.registerFont(TTFont("Segoe-Bold", str(font_dir / "segoeuib.ttf")))
    pdfmetrics.registerFontFamily("Segoe", normal="Segoe", bold="Segoe-Bold")

    ink = colors.HexColor("#1c2733")
    muted = colors.HexColor("#4d5b68")
    rule = colors.HexColor("#cfd7df")
    styles = {
        "name": ParagraphStyle("name", fontName="Segoe-Bold", fontSize=21, leading=25, textColor=ink, spaceAfter=4),
        "lead": ParagraphStyle("lead", fontName="Segoe", fontSize=10.5, leading=15, textColor=ink, spaceAfter=5),
        "link": ParagraphStyle("link", fontName="Segoe", fontSize=9, leading=13, textColor=muted),
        "section": ParagraphStyle("section", fontName="Segoe-Bold", fontSize=10, leading=14, textColor=ink, spaceBefore=4, spaceAfter=6),
        "entry_name": ParagraphStyle("entry-name", fontName="Segoe-Bold", fontSize=9.5, leading=13, textColor=ink),
        "date": ParagraphStyle("date", fontName="Segoe", fontSize=8.3, leading=12, alignment=TA_RIGHT, textColor=muted),
        "role": ParagraphStyle("role", fontName="Segoe", fontSize=8.8, leading=12, textColor=ink, spaceBefore=2, spaceAfter=2),
        "body": ParagraphStyle("body", fontName="Segoe", fontSize=8.8, leading=12, textColor=muted, spaceAfter=2),
        "skill_name": ParagraphStyle("skill-name", fontName="Segoe-Bold", fontSize=8.8, leading=12.5, textColor=ink),
    }

    document = SimpleDocTemplate(
        str(OUTPUT),
        pagesize=A4,
        leftMargin=46,
        rightMargin=46,
        topMargin=34,
        bottomMargin=30,
        title="Ben Bergenwall - CV",
        author="Ben Bergenwall",
    )
    content_width = A4[0] - document.leftMargin - document.rightMargin

    page = html.fromstring(SOURCE.read_text(encoding="utf-8"))
    resume = first(page, "//div[contains(concat(' ', normalize-space(@class), ' '), ' resume ')]")
    intro = first(resume, "./header")
    name = text(first(intro, "./heading"))
    lead = text(first(intro, "./text"))
    github = first(intro, ".//a[starts-with(@href, 'https://github.com/')]")

    story = [
        paragraph(name, styles["name"]),
        paragraph(lead, styles["lead"]),
        Paragraph(
            f'<link href="{escape(github.get("href"), quote=True)}">{escape(github.get("href").removeprefix("https://"))}</link>',
            styles["link"],
        ),
        Spacer(1, 12),
    ]

    for section in resume.xpath("./section"):
        title = text(first(section, "./heading"))
        section_start = [
            HRFlowable(width="100%", thickness=0.6, color=rule, spaceBefore=2, spaceAfter=4),
            paragraph(title, styles["section"]),
        ]
        articles = section.xpath("./div/article")
        if articles:
            story.append(KeepTogether(section_start + article_flowables(articles[0], styles, content_width)))
            for article in articles[1:]:
                story.append(KeepTogether(article_flowables(article, styles, content_width)))
        elif title == "Profile":
            profile = section.xpath("./div/text")
            story.append(KeepTogether(section_start + [paragraph(text(item), styles["body"]) for item in profile] + [Spacer(1, 2)]))
        elif title == "Technical skills":
            skill_cells = []
            for pair in section.xpath("./dl/div"):
                skill_cells.append(
                    [
                        paragraph(text(first(pair, "./dt")), styles["skill_name"]),
                        paragraph(text(first(pair, "./dd")), styles["body"]),
                    ]
                )
            skills = Table([skill_cells], colWidths=[content_width / 3] * 3, hAlign="LEFT")
            skills.setStyle(
                TableStyle(
                    [
                        ("VALIGN", (0, 0), (-1, -1), "TOP"),
                        ("LEFTPADDING", (0, 0), (-1, -1), 0),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                        ("TOPPADDING", (0, 0), (-1, -1), 0),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
                    ]
                )
            )
            story.append(KeepTogether(section_start + [skills]))
        else:
            raise ValueError(f"Unexpected resume section: {title}")

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    document.build(story)
    print(f"Generated {OUTPUT}")


if __name__ == "__main__":
    main()
