"""Spot-check TOC content and risk matrix rows."""
from docx import Document

doc = Document("Bao_cao_tong_hop_ATTT.docx")
paras = doc.paragraphs

# Find MUC LUC and show following 25 paragraphs
idx = None
for i, p in enumerate(paras):
    if p.text.strip().upper().startswith("MỤC LỤC"):
        idx = i
        break

out = []
out.append(f"MUC LUC paragraph index: {idx}")
if idx is not None:
    for p in paras[idx: idx + 26]:
        t = p.text.strip()
        style = p.style.name
        # detect TOC field presence
        xml = p._p.xml
        has_field = "fldChar" in xml or "instrText" in xml
        out.append(f"  [{style}]{' <FIELD>' if has_field else ''} {t[:90]!r}")

# Risk matrix = last table starting with 'Mức'
out.append("")
out.append("--- RISK MATRIX (table with first cell 'Mức') ---")
for ti, tbl in enumerate(doc.tables):
    if tbl.rows and tbl.rows[0].cells[0].text.strip() == "Mức":
        out.append(f"Table #{ti+1}: {len(tbl.rows)} rows")
        for r in tbl.rows:
            cells = [c.text.strip().replace("\n", " ") for c in r.cells]
            out.append("  | " + " || ".join(c[:60] for c in cells))
        break

# Test summary table (first cell 'Phân hệ' with 11 rows)
out.append("")
out.append("--- TEST SUMMARY (11-row table) ---")
for ti, tbl in enumerate(doc.tables):
    if len(tbl.rows) == 11 and tbl.rows[0].cells[0].text.strip() == "Phân hệ":
        out.append(f"Table #{ti+1}")
        for r in tbl.rows:
            cells = [c.text.strip().replace("\n", " ") for c in r.cells]
            out.append("  | " + " || ".join(c[:50] for c in cells))
        break

with open("analysis/_verify_out2.txt", "w", encoding="utf-8") as f:
    f.write("\n".join(out))
print("done")
