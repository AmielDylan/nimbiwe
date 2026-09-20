import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const cleAnonyme = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !cleAnonyme) {
  throw new Error(
    'EXPO_PUBLIC_SUPABASE_URL et EXPO_PUBLIC_SUPABASE_ANON_KEY sont requis : copier .env.example vers .env (voir le README).',
  );
}

const lecteurAnonyme = createClient(url, cleAnonyme);

describe('marchés (référentiel)', () => {
  it('un lecteur anonyme peut lister les marchés de détail', async () => {
    const { data, error } = await lecteurAnonyme.from('marches').select('nom').order('nom');

    expect(error).toBeNull();
    expect(data).toEqual(expect.arrayContaining([{ nom: 'Bohicon' }, { nom: 'Ganhi' }, { nom: 'Ouando' }]));
  });

  it("un lecteur anonyme ne peut pas ajouter un marché", async () => {
    const { error } = await lecteurAnonyme.from('marches').insert({ nom: 'Marché pirate' });

    expect(error).not.toBeNull();
  });
});
