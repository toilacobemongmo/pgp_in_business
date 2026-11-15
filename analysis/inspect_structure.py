import docx

d = docx.Document('ACTIVE_DEFENSE.docx')
print("Total tables:", len(d.tables))
for i in range(min(5, len(d.tables))):
    t = d.tables[i]
    print(f"\n--- TABLE {i} ({len(t.rows)} rows x {len(t.columns)} cols) ---")
    for r in t.rows[:4]:
        cells = [c.text.strip().replace('\n', ' ') for c in r.cells]
        print("  | ".join(cells))

headings = []
for p in d.paragraphs:
    if p.style and p.style.name.startswith('Heading'):
        headings.append((p.style.name, p.text.strip()))
    elif p.text.strip().startswith('CHƯƠNG') or p.text.strip().startswith('Chương'):
        headings.append(('Chương', p.text.strip()))

print("\n--- HEADINGS FOUND ---")
for h in headings[:30]:
    print(h)
