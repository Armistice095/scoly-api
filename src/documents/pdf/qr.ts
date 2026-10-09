import QRCode from 'qrcode';

/**
 * Dessine un QR code en VECTORIEL (carrés pleins, pas d'image) : net à toute
 * résolution d'impression, donc scannable même sur une photocopie.
 */
export function dessinerQr(
  doc: PDFKit.PDFDocument,
  texte: string,
  x: number,
  y: number,
  taille: number,
): void {
  const qr = QRCode.create(texte, { errorCorrectionLevel: 'M' });
  const n = qr.modules.size;
  const module = taille / n;

  doc.save().fillColor('#000000');
  for (let ligne = 0; ligne < n; ligne++) {
    for (let colonne = 0; colonne < n; colonne++) {
      if (qr.modules.get(ligne, colonne)) {
        // +0.15 : léger recouvrement pour éviter les filets blancs entre modules
        // dans certains lecteurs PDF.
        doc
          .rect(
            x + colonne * module,
            y + ligne * module,
            module + 0.15,
            module + 0.15,
          )
          .fill();
      }
    }
  }
  doc.restore();
}
