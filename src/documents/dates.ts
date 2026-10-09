const FUSEAU_PAR_DEFAUT = 'Africa/Porto-Novo';

const MOIS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

/**
 * Date du jour au format AAAA-MM-JJ dans le fuseau de l'établissement. Le
 * serveur tourne en UTC : sans ça, un document émis à 00h30 à Porto-Novo
 * porterait la date de la veille.
 */
export function dateCivileDuJour(
  maintenant: Date = new Date(),
  fuseau: string = FUSEAU_PAR_DEFAUT,
): string {
  // La locale en-CA formate nativement en AAAA-MM-JJ.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: fuseau,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(maintenant);
}

/** « 2026-10-02 » → « 2 octobre 2026 » (« 1er » pour le premier du mois). */
export function formaterDateLongue(iso: string): string {
  const [annee, mois, jour] = iso.split('-').map(Number) as [
    number,
    number,
    number,
  ];
  const nom = MOIS[mois - 1] ?? '';
  return `${jour === 1 ? '1er' : jour} ${nom} ${annee}`;
}
