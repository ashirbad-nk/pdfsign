import { PDFDocument } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import fs from 'node:fs';
import path from 'node:path';
const files = fs.readdirSync('public/fonts').filter(f=>f.endsWith('.ttf'));
for (const subset of [true, false]) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  for (const file of files) {
    const bytes = fs.readFileSync(path.join('public/fonts', file));
    try {
      const font = await pdf.embedFont(bytes, {subset});
      const page = pdf.addPage([612, 120]);
      page.drawText(file, {x: 20, y: 90, size: 10});
      page.drawText('02 Nov 2026  Ashirbad  Agenda', {x: 20, y: 40, size: 28, font});
    } catch (e) {
      console.log('FAIL', file, e.message);
    }
  }
  fs.writeFileSync(`/tmp/opencode/fonts-${subset?'subset':'full'}.pdf`, await pdf.save());
  console.log('wrote', subset);
}
