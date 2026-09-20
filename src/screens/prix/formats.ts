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

/** Ancienneté en jours calendaires : « aujourd’hui », « hier », « il y a 3 jours », « il y a 2 mois ». */
export function formaterAnciennete(dateIso: string): string {
  const maintenant = new Date();
  const jours = Math.max(0, Math.round((debutDeJour(maintenant) - debutDeJour(new Date(dateIso))) / JOUR));
  if (jours === 0) return 'aujourd’hui';
  if (jours === 1) return 'hier';
  if (jours < 30) return `il y a ${jours} jours`;
  return `il y a ${Math.floor(jours / 30)} mois`;
}

export function formaterNombreDeCollectes(nombre: number): string {
  if (nombre === 0) return 'Aucune collecte sur 7 jours';
  return `${nombre} collecte${nombre > 1 ? 's' : ''} sur 7 jours`;
}
