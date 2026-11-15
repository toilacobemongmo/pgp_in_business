import docx, os, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
files = ['Bao_cao_Ky_su_3_Nguyen_The_Duong.docx',
         'Bao_cao_OpenPGP_Packet_Inspector.docx',
         'BAO_CAO_WOT.docx',
         'minhquan-csattt-btl/minhquan-csattt.docx']
for f in files:
    if not os.path.exists(f):
        print('MISSING', f); continue
    d = docx.Document(f)
    ps = [p.text.strip() for p in d.paragraphs if p.text.strip()]
    print('=' * 25, f, len(ps), 'paras', len(d.tables), 'tables')
    for p in ps:
        print('  |', p[:200])
    for ti, t in enumerate(d.tables):
        print('  --TABLE', ti)
        for r in t.rows:
            print('    ', ' ~ '.join(c.text.strip()[:80] for c in r.cells))
