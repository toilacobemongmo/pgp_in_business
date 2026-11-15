import docx
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
import os, win32com.client

doc = docx.Document()
p = doc.add_paragraph()
p.add_run('Testing TOC')

p_toc = doc.add_paragraph()
r = p_toc.add_run()._r
f1 = OxmlElement('w:fldChar')
f1.set(qn('w:fldCharType'), 'begin')
it = OxmlElement('w:instrText')
it.set(qn('xml:space'), 'preserve')
it.text = r'TOC \o "1-3" \h \z \u'
f2 = OxmlElement('w:fldChar')
f2.set(qn('w:fldCharType'), 'separate')
f3 = OxmlElement('w:fldChar')
f3.set(qn('w:fldCharType'), 'end')
r.append(f1)
r.append(it)
r.append(f2)
r.append(f3)

doc.add_page_break()
doc.add_heading('CHƯƠNG 1: THỬ NGHIỆM', level=1)
doc.add_paragraph('Nội dung chương 1')
doc.add_page_break()
doc.add_heading('CHƯƠNG 2: THỬ NGHIỆM 2', level=1)
doc.add_paragraph('Nội dung chương 2')

test_path = os.path.abspath('analysis/test_toc.docx')
doc.save(test_path)

word = win32com.client.Dispatch('Word.Application')
word.Visible = False
wdoc = word.Documents.Open(test_path)
try:
    for toc in wdoc.TablesOfContents:
        toc.Update()
    wdoc.Fields.Update()
    wdoc.Save()
    pdf_path = os.path.abspath('analysis/test_toc.pdf')
    wdoc.ExportAsFixedFormat(pdf_path, 17) # 17 = wdExportFormatPDF
    print('PDF exported successfully! File size:', os.path.getsize(pdf_path))
finally:
    wdoc.Close(False)
    word.Quit()
