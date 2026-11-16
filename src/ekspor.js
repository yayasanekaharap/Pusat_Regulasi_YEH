"use strict";
/*
 * Ekspor tanda dan catatan ke berkas Word (.docx).
 *
 * Dimuat lewat import() dinamis dari app.js, sehingga pustaka docx hanya
 * diunduh ketika tombol ekspor ditekan — tidak menambah berat pembukaan web.
 * Berkasnya disusun sepenuhnya di peramban; tidak ada yang dikirim ke server.
 */
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle } from 'docx';

const WARNA_HEX = { 1: 'FFF3A3', 2: 'C8F0D2', 3: 'CDE3FF', 4: 'FFD3DE' };

/**
 * kelompok: [{ judul, item: [{ alamat, jenis, label, warna, cuplikan, catatan, periksa }] }]
 */
export async function eksporWord({ nama, kelompok, saringan }) {
  const tgl = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  const isi = [
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun('Tanda dan Catatan')] }),
    new Paragraph({ children: [new TextRun({ text: nama + ' · ' + tgl, color: '555555' })] }),
    new Paragraph({ children: [new TextRun({ text: 'Diekspor dari Pusat Referensi Regulasi YEH' + (saringan ? ' · ' + saringan : '') + '. Catatan ini milik pribadi pengguna.', italics: true, size: 18, color: '777777' })] })
  ];
  for (const g of kelompok) {
    isi.push(new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 360 }, children: [new TextRun(g.judul)] }));
    for (const x of g.item) {
      isi.push(new Paragraph({ heading: HeadingLevel.HEADING_3, spacing: { before: 200 },
        children: [new TextRun(x.alamat || 'Bagian awal'), new TextRun({ text: '   ' + x.jenis + (x.label ? ' · ' + x.label : ''), size: 18, color: '777777', bold: false })] }));
      if (x.periksa) isi.push(new Paragraph({ children: [new TextRun({ text: 'Perlu dicek: teks pasal sudah berubah sejak tanda ini dibuat.', italics: true, color: 'B54708', size: 18 })] }));
      if (x.cuplikan) isi.push(new Paragraph({ indent: { left: 360 },
        border: { left: { style: BorderStyle.SINGLE, size: 12, color: 'AAB4C3', space: 8 } },
        children: [new TextRun({ text: '“' + x.cuplikan + '”', italics: true, shading: x.warna ? { fill: WARNA_HEX[x.warna] || 'FFFFFF' } : undefined })] }));
      if (x.catatan) String(x.catatan).split(/\r?\n/).forEach(baris => isi.push(new Paragraph({ children: [new TextRun(baris)] })));
    }
  }
  if (!kelompok.length) isi.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Tidak ada tanda pada saringan ini.', italics: true })] }));
  const doc = new Document({
    creator: 'Pusat Referensi Regulasi YEH', title: 'Tanda dan Catatan',
    styles: { default: { document: { run: { font: 'Calibri', size: 22 } } } },
    sections: [{ children: isi }]
  });
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'Tanda-dan-Catatan-' + new Date().toISOString().slice(0, 10) + '.docx';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
