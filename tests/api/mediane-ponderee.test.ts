import { admin, lecteurAnonyme } from './aide';

async function mediane(valeurs: number[], poids: number[]) {
  const { data, error } = await admin.rpc('mediane_ponderee', { valeurs, poids });
  expect(error).toBeNull();
  return data as number | null;
}

describe('médiane pondérée', () => {
  it('avec un seul relevé, c’est sa valeur', async () => {
    expect(await mediane([420], [0.5])).toBe(420);
  });

  it.each([
    [[1], 1],
    [[1, 2], 1.5],
    [[1, 2, 3], 2],
    [[1, 2, 3, 4], 2.5],
    [[10, 20, 40, 80, 160], 40],
    [[10, 20, 40, 80, 160, 320], 60],
  ])('à poids égaux, redonne la médiane ordinaire de %j : %d', async (valeurs, attendu) => {
    expect(await mediane(valeurs, valeurs.map(() => 1))).toBe(attendu);
    expect(await mediane(valeurs, valeurs.map(() => 0.25))).toBe(attendu); // seuls les rapports comptent
  });

  it('avec des poids inégaux, tire la médiane vers les relevés les plus lourds', async () => {
    // Positions cumulées 0,125 ; 0,375 ; 0,75 : la médiane est lue entre 20 et 30.
    expect(await mediane([10, 20, 30], [1, 1, 2])).toBeCloseTo(23.3333, 3);
    expect(await mediane([400, 800, 1200], [1, 0.5, 0.5])).toBeCloseTo(666.6667, 3);
  });

  it('un relevé très lourd impose sa valeur', async () => {
    expect(await mediane([10, 20, 30], [1, 1, 100])).toBeCloseTo(29.802, 2); // 20 + 49,5 / 50,5 × 10
  });

  it('ignore les poids nuls : le résultat est celui des relevés restants', async () => {
    expect(await mediane([1, 2, 3], [1, 0, 3])).toBeCloseTo(await mediane([1, 3], [1, 3]) as number, 6);
    expect(await mediane([1, 2, 3, 4], [1, 1, 0, 0])).toBe(1.5);
  });

  it('ne donne rien sans relevé ni sans poids utile', async () => {
    expect(await mediane([], [])).toBeNull();
    expect(await mediane([5, 6], [0, 0])).toBeNull();
  });

  it('refuse des listes de longueurs différentes', async () => {
    const { error } = await admin.rpc('mediane_ponderee', { valeurs: [1, 2, 3], poids: [1, 1] });

    expect(error?.code).toBe('22023');
  });

  it("la fonction de distance n'est pas exposée par l'API", async () => {
    const { error } = await lecteurAnonyme.rpc('distance_metres', {
      latitude_a: 0, longitude_a: 0, latitude_b: 1, longitude_b: 1,
    });

    expect(error?.code).toBe('42501');
  });
});
