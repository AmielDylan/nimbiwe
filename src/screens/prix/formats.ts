const JOUR = 24 * 60 * 60 * 1000;

export function capitaliser(texte: string): string {
  return texte.charAt(0).toLocaleUpperCase('fr') + texte.slice(1);
}

/** 1234.6 -> « 1 235 » : les prix sont des FCFA entiers. */
export function formaterMontant(montant: number): string {
  return Math.round(montant)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function debutDeJour(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/**
 * Ancienneté à la seconde, minute ou heure près le premier jour, puis en jours
 * calendaires : « à l’instant », « il y a 30 sec », « il y a 5 min »,
 * « il y a 3 h », « hier », « il y a 3 jours », « il y a 2 mois ».
 */
export function formaterAnciennete(dateIso: string): string {
  const maintenant = new Date();
  const date = new Date(dateIso);
  const secondes = Math.floor(Math.max(0, maintenant.getTime() - date.getTime()) / 1000);
  if (secondes < 10) return 'à l’instant';
  if (secondes < 60) return `il y a ${secondes} sec`;
  const minutes = Math.floor(secondes / 60);
  if (minutes < 60) return `il y a ${minutes} min`;
  const heures = Math.floor(minutes / 60);
  if (heures < 24) return `il y a ${heures} h`;

  const jours = Math.round((debutDeJour(maintenant) - debutDeJour(date)) / JOUR);
  if (jours <= 1) return 'hier';
  if (jours < 30) return `il y a ${jours} jours`;
  return `il y a ${Math.floor(jours / 30)} mois`;
}

function libellePeriode(jours: number): string {
  return `${jours} jour${jours > 1 ? 's' : ''}`;
}

export function formaterNombreDeCollectes(nombre: number, jours: number): string {
  if (nombre === 0) return `Aucune collecte sur ${libellePeriode(jours)}`;
  return `${nombre} collecte${nombre > 1 ? 's' : ''} sur ${libellePeriode(jours)}`;
}

export { libellePeriode };
