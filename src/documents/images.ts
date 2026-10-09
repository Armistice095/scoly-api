/** PDFKit n'embarque que du PNG et du JPEG (pas de WebP, que l'upload du logo autorise). */
export function estImageSupporteePdf(octets: Buffer): boolean {
  const png =
    octets.length > 8 &&
    octets[0] === 0x89 &&
    octets[1] === 0x50 &&
    octets[2] === 0x4e &&
    octets[3] === 0x47;
  const jpeg = octets.length > 3 && octets[0] === 0xff && octets[1] === 0xd8;
  return png || jpeg;
}
