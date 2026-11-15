import docx

d = docx.Document('ACTIVE_DEFENSE.docx')
headings = []
for p in d.paragraphs:
    if p.style and p.style.name.startswith('Heading'):
        headings.append((p.style.name, p.text.strip()))
    elif p.text.strip().startswith('CHƯƠNG') or p.text.strip().startswith('Chương') or p.text.strip() in ('TÀI LIỆU THAM KHẢO', 'PHỤ LỤC'):
        headings.append(('Chương', p.text.strip()))

for h in headings[25:]:
    print(h)
