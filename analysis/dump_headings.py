import docx, os, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
files = ['Bao_cao_Ky_su_3_Nguyen_The_Duong.docx',
         'Bao_cao_OpenPGP_Packet_Inspector.docx',
         'BAO_CAO_WOT.docx',
         'minhquan-csattt-btl/minhquan-csattt.docx']
for f in files:
    d = docx.Document(f)
    print('=' * 25, f)
    for p in d.paragraphs:
        t = p.text.strip()
        if not t:
            continue
        st = (p.style.name or '')
        if st.startswith('Heading') or st.startswith('Title'):
            print('  [%s] %s' % (st, t))
