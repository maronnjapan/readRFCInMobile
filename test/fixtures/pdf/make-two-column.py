# 2 段組の論文風 PDF (しおり・タグなし) を作る、テスト用データの生成スクリプト。
#   pip install reportlab pyphen
#   python3 make-two-column.py two-column.pdf
#   node ../../../scripts/pdf-extract.mjs two-column.pdf > two-column.json
# 本文の段落は PARAS に置き、テストでは出力の段落と突き合わせる (段の読み順・ハイフンの処理の確認)。
import json, sys
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_JUSTIFY, TA_CENTER, TA_LEFT
from reportlab.lib import colors
from reportlab.platypus import BaseDocTemplate, Frame, PageTemplate, Paragraph, Spacer, Table, TableStyle, Preformatted, NextPageTemplate, FrameBreak
from reportlab.graphics.shapes import Drawing, Rect, String, Line

W, H = letter
M = 54
GAP = 18
COLW = (W - 2 * M - GAP) / 2

body = ParagraphStyle('body', fontName='Times-Roman', fontSize=10, leading=12, alignment=TA_JUSTIFY, firstLineIndent=12, hyphenationLang='en_US', embeddedHyphenation=1, uriWasteReduce=0.3)
body0 = ParagraphStyle('body0', parent=body, firstLineIndent=0)
h1 = ParagraphStyle('h1', fontName='Times-Bold', fontSize=12, leading=14, spaceBefore=8, spaceAfter=4)
h2 = ParagraphStyle('h2', fontName='Times-Bold', fontSize=10, leading=12, spaceBefore=6, spaceAfter=2)
title = ParagraphStyle('title', fontName='Times-Bold', fontSize=20, leading=24, alignment=TA_CENTER, spaceAfter=10)
author = ParagraphStyle('author', fontName='Times-Roman', fontSize=11, leading=14, alignment=TA_CENTER)
cap = ParagraphStyle('cap', fontName='Times-Roman', fontSize=9, leading=11, alignment=TA_JUSTIFY, spaceBefore=4, spaceAfter=8)
ref = ParagraphStyle('ref', fontName='Times-Roman', fontSize=8, leading=9.5, leftIndent=14, firstLineIndent=-14, alignment=TA_LEFT, spaceAfter=2)
bullet = ParagraphStyle('bullet', parent=body0, leftIndent=12, bulletIndent=2)
code = ParagraphStyle('code', fontName='Courier', fontSize=8, leading=10)

PARAS = {
    'abstract': 'Mobile readers struggle with documents that were typeset for paper. Two-column layouts, running headers, and hyphenated line breaks make the text hard to follow on a narrow screen. We present a reconstruction technique that recovers the reading order of scholarly documents from the positions of their glyphs and reflows the text so that it can be read comfortably on a telephone.',
    'intro1': 'Scholarly publishing still revolves around the portable document format. Conference proceedings, technical reports, and standards documents are distributed as fixed layouts that faithfully reproduce the printed page. This fidelity comes at a price: on a small display the reader must zoom, pan, and scroll in two dimensions to follow a single sentence across a column boundary, which interrupts concentration and makes careful reading of long specifications exhausting.',
    'intro2': 'Our approach treats the document as a collection of positioned words rather than as an image. By grouping words into lines, lines into columns, and columns into a reading sequence, the system recovers the logical flow of the text. Figures, tables, and displayed equations are preserved as cropped images of the original page, because their meaning depends on the arrangement that the author chose.',
    'design1': 'The first stage collects every text fragment together with its baseline, font size, and horizontal extent. Fragments that share a baseline are merged into lines, and superscripts such as footnote markers are attached to the line they decorate. A vertical gap that remains empty across most of the page reveals the boundary between the two columns, even when a wide title or a figure spanning both columns crosses it.',
    'design2': 'The second stage decides where paragraphs begin. Typeset documents signal a new paragraph either with additional vertical space or with an indented first line. Both cues are measured relative to the typical line spacing of the body text, so the method adapts to documents with different typographic conventions without manual configuration.',
    'lines1': 'Running headers and page numbers repeat on every page and carry no information for the reader. They are recognized by comparing the text near the top and bottom margins across pages, ignoring the digits that change from one page to the next. Hyphenated words at the end of a line are rejoined unless the same hyphenated form appears elsewhere in the document, which preserves compound words such as state-of-the-art techniques while repairing words that were merely broken for justification.',
    'eval1': 'We evaluated the reconstruction on a collection of conference papers and technical reports. For each document we compared the recovered paragraphs with the source text and counted the paragraphs whose words appeared in the correct order. The comparison was strict: a single misplaced fragment caused the entire paragraph to be counted as incorrect.',
    'eval2': 'The results in Table 1 show that the reading order was recovered for nearly every paragraph. The remaining errors were concentrated in documents that place marginal notes beside the main text, a layout that the current implementation does not attempt to handle.',
    'concl': 'Reflowing fixed layouts is an old problem, but the combination of glyph positions, font metrics, and simple statistics about the page is sufficient for the documents that researchers read most often. The resulting text adapts to the reader instead of forcing the reader to adapt to the page.',
}

def onpage(canvas, doc):
    canvas.saveState()
    canvas.setFont('Times-Italic', 8)
    canvas.drawString(M, H - 34, 'Synthetic Paper for Testing — Preprint')
    canvas.drawRightString(W - M, H - 34, 'Reading Order Reconstruction')
    canvas.setFont('Times-Roman', 9)
    canvas.drawCentredString(W / 2, 30, str(doc.page))
    if doc.page == 1:
        canvas.setFont('Times-Roman', 8)
        canvas.line(M, 92, M + 60, 92)
        canvas.drawString(M, 82, '1 Work done while the author was visiting the Example Laboratory for Document')
        canvas.drawString(M, 72, 'Engineering, which provided the test collection used in this study.')
    canvas.restoreState()

doc = BaseDocTemplate(sys.argv[1], pagesize=letter, leftMargin=M, rightMargin=M, topMargin=54, bottomMargin=54, title='', author='')
top = Frame(M, H - 54 - 190, W - 2 * M, 190, id='top', showBoundary=0)
c1 = Frame(M, 100, COLW, H - 54 - 190 - 100, id='c1')
c2 = Frame(M + COLW + GAP, 100, COLW, H - 54 - 190 - 100, id='c2')
d1 = Frame(M, 54, COLW, H - 108, id='d1')
d2 = Frame(M + COLW + GAP, 54, COLW, H - 108, id='d2')
doc.addPageTemplates([PageTemplate(id='first', frames=[top, c1, c2], onPage=onpage), PageTemplate(id='rest', frames=[d1, d2], onPage=onpage)])

fig = Drawing(COLW, 110)
fig.add(Rect(10, 60, 70, 30, fillColor=colors.lightblue))
fig.add(String(20, 72, 'Glyphs', fontName='Helvetica', fontSize=8))
fig.add(Rect(100, 60, 70, 30, fillColor=colors.lightgreen))
fig.add(String(115, 72, 'Lines', fontName='Helvetica', fontSize=8))
fig.add(Rect(55, 10, 90, 30, fillColor=colors.lightyellow))
fig.add(String(70, 22, 'Paragraphs', fontName='Helvetica', fontSize=8))
fig.add(Line(80, 75, 100, 75))
fig.add(Line(135, 60, 100, 40))

table = Table([['Corpus', 'Docs', 'Correct'], ['Conference papers', '120', '98.3%'], ['Technical reports', '45', '96.1%'], ['Standards', '30', '99.0%']], colWidths=[90, 40, 50])
table.setStyle(TableStyle([('FONT', (0, 0), (-1, -1), 'Helvetica', 7.5), ('LINEABOVE', (0, 0), (-1, 0), 0.8, colors.black), ('LINEBELOW', (0, 0), (-1, 0), 0.5, colors.black), ('LINEBELOW', (0, -1), (-1, -1), 0.8, colors.black)]))

eq = Table([['S = Σ  w · d(x, y) + λ', '(1)']], colWidths=[COLW - 30, 30])
eq.setStyle(TableStyle([('FONT', (0, 0), (-1, -1), 'Times-Italic', 10), ('ALIGN', (0, 0), (0, 0), 'CENTER'), ('ALIGN', (1, 0), (1, 0), 'RIGHT')]))

story = [
    Paragraph('Reading Order Reconstruction for Mobile Document Readers', title),
    Paragraph('Alice Example<super>1</super> and Bob Sample', author),
    Paragraph('Example University', author),
    Spacer(1, 8),
    Paragraph('<b>Abstract</b>', ParagraphStyle('ab', parent=h2, alignment=TA_CENTER)),
    Paragraph(PARAS['abstract'], ParagraphStyle('abs', parent=body0, leftIndent=40, rightIndent=40)),
    NextPageTemplate('rest'),
    FrameBreak(),
    Paragraph('1 Introduction', h1),
    Paragraph(PARAS['intro1'], body0),
    Paragraph(PARAS['intro2'], body),
    Paragraph('The contributions of this paper are:', body0),
    Paragraph('a reading order algorithm that handles two-column pages and full-width titles;', bullet, bulletText='•'),
    Paragraph('a paragraph segmentation rule based on indentation and spacing.', bullet, bulletText='•'),
    Paragraph('2 Design', h1),
    Paragraph(PARAS['design1'], body0),
    fig,
    Paragraph('Figure 1: The three stages of the reconstruction pipeline.', cap),
    Paragraph(PARAS['design2'], body),
    Paragraph('The score of a candidate column boundary is computed as follows:', body0),
    eq,
    Paragraph('2.1 Running Headers and Hyphenation', h2),
    Paragraph(PARAS['lines1'], body0),
    Paragraph('The detection itself is a short function:', body0),
    Preformatted('function isHeader(line, pages) {\n  const key = normalize(line.text);\n  return count(key, pages) >= 3;\n}', code),
    Paragraph('Listing 1: Detecting running headers.', cap),
    Paragraph('3 Evaluation', h1),
    Paragraph(PARAS['eval1'], body0),
    Paragraph('Table 1: Paragraphs whose reading order was recovered.', cap),
    table,
    Spacer(1, 6),
    Paragraph(PARAS['eval2'], body0),
    Paragraph('4 Conclusion', h1),
    Paragraph(PARAS['concl'], body0),
    Paragraph('References', h1),
    Paragraph('[1] T. M. Breuel. Two geometric algorithms for layout analysis. In Document Analysis Systems, pages 188–199. Springer, 2002.', ref),
    Paragraph('[2] R. Smith. Hybrid page layout analysis via tab-stop detection. In International Conference on Document Analysis and Recognition, pages 241–245, 2009. https://research.example.org/papers/hybrid-page-layout-analysis-tab-stops.pdf', ref),
    Paragraph('[3] Mozilla. PDF.js: a general-purpose, web standards-based platform for parsing and rendering PDFs, 2024.', ref),
]
doc.build(story)
json.dump(PARAS, open(sys.argv[1].replace('.pdf', '.paras.json'), 'w'), ensure_ascii=False, indent=1)
