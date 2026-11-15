import docx, zipfile, os, re
from docx.shared import Emu

f = 'ACTIVE_DEFENSE.docx'
d = docx.Document(f)
s = d.sections[0]
print('SECTIONS', len(d.sections))
for i, sec in enumerate(d.sections):
    print(' sec%d page %s x %s (%.2fcm x %.2fcm) margins L%.2f R%.2f T%.2f B%.2f' % (
        i, sec.page_width, sec.page_height, sec.page_width.cm, sec.page_height.cm,
        sec.left_margin.cm, sec.right_margin.cm, sec.top_margin.cm, sec.bottom_margin.cm))

print('\n--- STYLES ---')
for st in d.styles:
    try:
        if st.type is not None and st.name in ('Normal','Heading 1','Heading 2','Heading 3','Title','Caption','List Bullet','List Paragraph'):
            f2 = st.font
            print(' ', st.name, '| font=', f2.name, '| size=', f2.size, '| bold=', f2.bold, '| italic=', f2.italic)
            pf = st.paragraph_format
            print('      align=', pf.alignment, '| spacing=', pf.line_spacing, pf.space_after, '| first_indent=', pf.first_line_indent)
    except Exception as e:
        pass

print('\n--- PARAGRAPHS (first 70) ---')
for i, p in enumerate(d.paragraphs[:70]):
    t = p.text.strip()
    if not t: continue
    pf = p.paragraph_format
    runs = p.runs
    fname = runs[0].font.name if runs else None
    fsize = runs[0].font.size if runs else None
    print('[%d] style=%s align=%s font=%s size=%s bold=%s ital=%s | %s' % (
        i, p.style.name, pf.alignment, fname, fsize,
        runs[0].bold if runs else None, runs[0].italic if runs else None, t[:95]))

print('\n--- TABLES ---')
for i, t in enumerate(d.tables):
    print(' table%d rows=%d cols=%d style=%s' % (i, len(t.rows), len(t.columns), t.style.name if t.style else None))
    for r in t.rows[:4]:
        print('    ', ' | '.join(c.text.strip()[:38] for c in r.cells))

with zipfile.ZipFile(f) as z:
    media = [n for n in z.namelist() if n.startswith('word/media')]
    print('\nMEDIA:', media)
    names = z.namelist()
    print('has toc field:', any(b'TOC' in z.read(n) for n in names if n.endswith('.xml') and 'document' in n))
