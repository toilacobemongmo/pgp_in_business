import docx, os, glob, zipfile

cands = [
    '.aKetqua/pgp.docx',
    'minhquan-csattt-btl/minhquan-csattt.docx',
    'Bao_cao_Ky_su_3_Nguyen_The_Duong.docx',
    'Bao_cao_tong_hop_ATTT.docx',
]
for f in cands:
    if not os.path.exists(f):
        print('MISSING', f); continue
    d = docx.Document(f)
    print('===', f, '| paras', len(d.paragraphs), '| tables', len(d.tables))
    sec = d.sections[0]
    print('   page', sec.page_width, sec.page_height, 'margins L/R/T/B',
          sec.left_margin, sec.right_margin, sec.top_margin, sec.bottom_margin)
    n = 0
    for p in d.paragraphs:
        t = p.text.strip()
        if not t: continue
        st = p.style.name
        al = p.paragraph_format.alignment
        print('   [%s|%s] %s' % (st, al, t[:100]))
        n += 1
        if n > 40: break
    with zipfile.ZipFile(f) as z:
        media = [n for n in z.namelist() if n.startswith('word/media')]
        print('   MEDIA:', media)
    print()

# search home for ACTIVE_DEFENSE
hits = []
for root in [r'c:\Users\ghaob\Desktop', r'c:\Users\ghaob\Documents', r'c:\Users\ghaob\Downloads',
             r'c:\Users\ghaob\OneDrive']:
    if os.path.isdir(root):
        for p in glob.glob(os.path.join(root, '**', 'ACTIVE_DEFENSE*'), recursive=True):
            hits.append(p)
print('ACTIVE_DEFENSE hits:', hits)
