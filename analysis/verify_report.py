"""Verify Bao_cao_tong_hop_ATTT.docx structure."""
import sys
import os

try:
    from docx import Document
except ImportError:
    print("ERROR: python-docx not installed")
    sys.exit(1)

docx_path = "Bao_cao_tong_hop_ATTT.docx"

if not os.path.exists(docx_path):
    print(f"ERROR: File not found: {docx_path}")
    sys.exit(1)

file_size = os.path.getsize(docx_path)
print(f"File: {docx_path}")
print(f"Size: {file_size:,} bytes ({file_size/1024:.1f} KB)")

doc = Document(docx_path)

paragraphs = doc.paragraphs
tables = doc.tables

print(f"Paragraphs: {len(paragraphs)}")
print(f"Tables: {len(tables)}")

# Count headings
headings = [p for p in paragraphs if p.style.name.startswith('Heading')]
print(f"Headings: {len(headings)}")

print("\n--- HEADINGS ---")
for h in headings:
    level = h.style.name
    text = h.text.strip()
    if text:
        print(f"  [{level}] {text[:80]}")

print("\n--- TABLE SIZES ---")
for i, tbl in enumerate(tables):
    rows = len(tbl.rows)
    cols = len(tbl.columns) if tbl.rows else 0
    # Get first cell content as label
    label = ""
    if tbl.rows and tbl.rows[0].cells:
        label = tbl.rows[0].cells[0].text.strip()[:50]
    print(f"  Table {i+1}: {rows} rows x {cols} cols | first cell: '{label}'")

print("\n--- FIRST 5 NON-EMPTY PARAGRAPHS ---")
shown = 0
for p in paragraphs:
    text = p.text.strip()
    if text and shown < 5:
        print(f"  [{p.style.name}] {text[:100]}")
        shown += 1

print("\nVERIFICATION COMPLETE")
