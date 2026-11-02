import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';
import fs from 'node:fs';

const pdf = await PDFDocument.create();
const font = await pdf.embedFont(StandardFonts.Helvetica);
const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

const p1 = pdf.addPage([612, 792]);
p1.drawText('CONSULTING AGREEMENT', { x: 72, y: 700, size: 20, font: bold, color: rgb(0.1, 0.1, 0.15) });
p1.drawText('This agreement is entered into on the date written below.', { x: 72, y: 660, size: 11, font });
for (let i = 0; i < 12; i++) {
  p1.drawText('Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer vitae nunc at velit.', {
    x: 72,
    y: 620 - i * 20,
    size: 10,
    font,
    color: rgb(0.3, 0.3, 0.35),
  });
}
p1.drawText('Signature', { x: 72, y: 170, size: 9, font, color: rgb(0.4, 0.4, 0.45) });
p1.drawLine({ start: { x: 72, y: 160 }, end: { x: 312, y: 160 }, thickness: 0.8, color: rgb(0.4, 0.4, 0.45) });
p1.drawText('Date', { x: 360, y: 170, size: 9, font, color: rgb(0.4, 0.4, 0.45) });
p1.drawLine({ start: { x: 360, y: 160 }, end: { x: 540, y: 160 }, thickness: 0.8, color: rgb(0.4, 0.4, 0.45) });
p1.drawText('Initials', { x: 72, y: 100, size: 9, font, color: rgb(0.4, 0.4, 0.45) });
p1.drawRectangle({ x: 72, y: 60, width: 52, height: 30, borderWidth: 0.8, borderColor: rgb(0.4, 0.4, 0.45) });

const p2 = pdf.addPage([612, 792]);
p2.setRotation(degrees(90));
p2.drawText('ROTATED PAGE /Rotate 90', { x: 72, y: 700, size: 18, font: bold });
p2.drawText('A signature placed upright on screen must stay upright after export.', {
  x: 72,
  y: 660,
  size: 10,
  font,
});
p2.drawRectangle({ x: 72, y: 80, width: 468, height: 520, borderWidth: 1, borderColor: rgb(0.6, 0.6, 0.7) });
p2.drawText('Sign here', { x: 100, y: 130, size: 12, font, color: rgb(0.4, 0.4, 0.5) });
p2.drawLine({ start: { x: 100, y: 120 }, end: { x: 320, y: 120 }, thickness: 0.8, color: rgb(0.4, 0.4, 0.5) });

const p3 = pdf.addPage([612, 792]);
p3.setCropBox(50, 100, 500, 600);
p3.drawText('CROP BOX OFFSET PAGE', { x: 80, y: 650, size: 18, font: bold });
p3.drawText('The crop box starts at (50, 100) with size 500x600.', { x: 80, y: 615, size: 10, font });
p3.drawRectangle({ x: 80, y: 140, width: 440, height: 420, borderWidth: 1, borderColor: rgb(0.6, 0.6, 0.7) });
p3.drawText('Sign here', { x: 100, y: 200, size: 12, font, color: rgb(0.4, 0.4, 0.5) });
p3.drawLine({ start: { x: 100, y: 190 }, end: { x: 330, y: 190 }, thickness: 0.8, color: rgb(0.4, 0.4, 0.5) });

pdf.setTitle('pdfsign test document');
fs.writeFileSync('tests/fixtures/sample.pdf', await pdf.save());
console.log('wrote tests/fixtures/sample.pdf');
