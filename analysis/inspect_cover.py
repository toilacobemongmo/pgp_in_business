import docx

d = docx.Document('ACTIVE_DEFENSE.docx')
print("Total paragraphs:", len(d.paragraphs))
print("Total tables:", len(d.tables))
print("Total sections:", len(d.sections))

for i, p in enumerate(d.paragraphs[:30]):
    t = p.text.strip()
    has_img = 'graphic' in p._p.xml
    runs = [(r.text, r.font.name, r.font.size.pt if r.font.size else None, r.bold) for r in p.runs if r.text.strip()]
    print(f"P{i:02d} [align={p.alignment}, img={has_img}]: text='{t}' | runs={runs}")

print("\n--- COVER TABLES ---")
if d.tables:
    t0 = d.tables[0]
    print(f"Table 0: {len(t0.rows)} rows x {len(t0.columns)} cols")
    for r_idx, r in enumerate(t0.rows):
        cells = [c.text.strip().replace('\n', ' / ') for c in r.cells]
        print(f"  Row {r_idx}: {cells}")
