/**
 * Numéro saisi -> format international (« +2290197000000 »), ou null s'il est
 * invalide. Sans indicatif, on suppose un numéro béninois (+229).
 */
export function normaliserNumero(saisie: string): string | null {
  const nettoye = saisie.replace(/[\s.\-()]/g, '');
  let international: string;
  if (nettoye.startsWith('+')) international = nettoye;
  else if (nettoye.startsWith('00')) international = `+${nettoye.slice(2)}`;
  else if (/^229\d{8,10}$/.test(nettoye)) international = `+${nettoye}`;
  else international = `+229${nettoye}`;
  return /^\+\d{10,15}$/.test(international) ? international : null;
}
