import { admin, lecteurAnonyme } from './aide';

// Code Postgres « insufficient_privilege » : refus par la sécurité par ligne.
const REFUSE_PAR_LA_SECURITE = '42501';

describe('référentiel', () => {
  it('un lecteur anonyme voit les quatre marchés de détail de la V0', async () => {
    const { data, error } = await lecteurAnonyme.from('marches').select('nom');

    expect(error).toBeNull();
    expect(data).toEqual(
      expect.arrayContaining([
        { nom: 'Ganhi' },
        { nom: 'Ouando' },
        { nom: 'Bohicon' },
        { nom: 'Dantokpa' },
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

  it('un lecteur anonyme voit les trois unités standard', async () => {
    const { data, error } = await lecteurAnonyme.from('unites').select('symbole, type').order('symbole');

    expect(error).toBeNull();
    expect(data).toEqual(
      expect.arrayContaining([
        { symbole: 'kg', type: 'standard' },
        { symbole: 'L', type: 'standard' },
        { symbole: 'pièce', type: 'standard' },
      ]),
    );
    expect(data).toHaveLength(3);
  });

  it("chaque produit n'est proposé que dans ses unités valides", async () => {
    const { data, error } = await lecteurAnonyme
      .from('produits')
      .select('nom, unites(symbole)')
      .in('nom', ['maïs', 'igname', 'huile végétale', 'œufs']);

    expect(error).toBeNull();
    const parProduit = Object.fromEntries(
      (data ?? []).map((produit) => [produit.nom, produit.unites.map((u) => u.symbole).sort()]),
    );
    expect(parProduit).toEqual({
      maïs: ['kg'],
      igname: ['kg', 'pièce'],
      'huile végétale': ['L'],
      œufs: ['pièce'],
    });
  });

  it('un lecteur anonyme ne peut modifier aucune donnée du référentiel', async () => {
    // Des lignes valides : seul un refus de la sécurité peut les faire échouer.
    const { data: huile } = await admin.from('produits').select('id').eq('nom', 'huile végétale').single();
    const { data: piece } = await admin.from('unites').select('id').eq('symbole', 'pièce').single();

    const produit = await lecteurAnonyme.from('produits').insert({ nom: 'produit pirate' });
    const unite = await lecteurAnonyme
      .from('unites')
      .insert({ nom: 'unité pirate', symbole: 'x', type: 'standard' });
    const lien = await lecteurAnonyme
      .from('produits_unites')
      .insert({ produit_id: huile!.id, unite_id: piece!.id });

    expect(produit.error?.code).toBe(REFUSE_PAR_LA_SECURITE);
    expect(unite.error?.code).toBe(REFUSE_PAR_LA_SECURITE);
    expect(lien.error?.code).toBe(REFUSE_PAR_LA_SECURITE);
  });
});
