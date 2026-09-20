import { lecteurAnonyme } from './aide';

describe('référentiel', () => {
  it('un lecteur anonyme voit les quatre marchés de détail de la V0', async () => {
    const { data, error } = await lecteurAnonyme.from('marches').select('nom');

    expect(error).toBeNull();
    expect(data).toEqual(
      expect.arrayContaining([
        { nom: 'Ganhi' },
        { nom: 'Ouando' },
        { nom: 'Bohicon' },
        { nom: 'Cotonou (provisoire)' },
      ]),
    );
  });

  it('un lecteur anonyme voit les douze produits de base', async () => {
    const { data, error } = await lecteurAnonyme.from('produits').select('nom').order('nom');

    expect(error).toBeNull();
    expect(data?.map((produit) => produit.nom)).toEqual(
      [
        'gari', 'haricot', 'huile de palme', 'huile végétale', 'igname', 'maïs',
        'oignon', 'piment', 'riz', 'sucre', 'tomate', 'œufs',
      ].sort((a, b) => a.localeCompare(b, 'fr')),
    );
  });

  it("chaque produit n'est proposé que dans ses unités valides", async () => {
    const { data, error } = await lecteurAnonyme
      .from('produits')
      .select('nom, unites(symbole)')
      .in('nom', ['maïs', 'huile végétale', 'œufs']);

    expect(error).toBeNull();
    const parProduit = Object.fromEntries(
      (data ?? []).map((produit) => [produit.nom, produit.unites.map((u) => u.symbole).sort()]),
    );
    expect(parProduit).toEqual({
      maïs: ['bol', 'kg'],
      'huile végétale': ['L'],
      œufs: ['pièce'],
    });
  });

  it('un lecteur anonyme ne peut modifier aucune donnée du référentiel', async () => {
    const produit = await lecteurAnonyme.from('produits').insert({ nom: 'produit pirate' });
    const unite = await lecteurAnonyme.from('unites').insert({ nom: 'unité pirate', symbole: 'x' });
    const lien = await lecteurAnonyme.from('produits_unites').insert({ produit_id: 1, unite_id: 1 });

    expect(produit.error).not.toBeNull();
    expect(unite.error).not.toBeNull();
    expect(lien.error).not.toBeNull();
  });
});
