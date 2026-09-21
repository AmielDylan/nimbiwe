import { createClient } from '@supabase/supabase-js';

import { admin, CODE_DE_TEST, lecteurAnonyme, numeroDeTestNeuf, seConnecter } from './aide';

// Codes Postgres et GoTrue observés à travers l'API.
const REFUSE_PAR_LA_SECURITE = '42501';
const CONTRAINTE_VIOLEE = '23514'; // check_violation

describe('connexion par SMS', () => {
  it('avec un numéro de test et son code fixe, on se connecte sans SMS réel', async () => {
    const telephone = await numeroDeTestNeuf();
    const client = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL!, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false },
    });

    const envoi = await client.auth.signInWithOtp({ phone: telephone });
    const verification = await client.auth.verifyOtp({ phone: telephone, token: CODE_DE_TEST, type: 'sms' });

    expect(envoi.error).toBeNull();
    expect(verification.error).toBeNull();
    expect(verification.data.session?.access_token).toBeTruthy();
    expect(verification.data.user?.phone).toBe(telephone);
  });

  it('un code faux est refusé', async () => {
    const telephone = await numeroDeTestNeuf();
    const client = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL!, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false },
    });
    await client.auth.signInWithOtp({ phone: telephone });

    const { data, error } = await client.auth.verifyOtp({ phone: telephone, token: '000000', type: 'sms' });

    expect(error).not.toBeNull();
    expect(data.session).toBeNull();
  });

  it("un nouveau code ne peut pas être redemandé immédiatement", async () => {
    const telephone = await numeroDeTestNeuf();
    const client = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL!, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false },
    });

    const premier = await client.auth.signInWithOtp({ phone: telephone });
    const second = await client.auth.signInWithOtp({ phone: telephone });

    expect(premier.error).toBeNull();
    expect(second.error).not.toBeNull();
  });
});

describe('profil', () => {
  it('est créé à la première connexion, sans relais et sans nom', async () => {
    const telephone = await numeroDeTestNeuf();

    const { client, utilisateurId } = await seConnecter(telephone);

    const { data, error } = await client.from('profils').select('*').eq('id', utilisateurId);
    expect(error).toBeNull();
    expect(data).toEqual([expect.objectContaining({ id: utilisateurId, nom_affiche: null, est_relais: false })]);
  });

  it("n'expose jamais le numéro de téléphone", async () => {
    const { client, utilisateurId } = await seConnecter(await numeroDeTestNeuf());

    const { data } = await client.from('profils').select('*').eq('id', utilisateurId).single();

    expect(Object.keys(data!).sort()).toEqual(['cree_le', 'est_bloque', 'est_relais', 'id', 'marche_relais_id', 'nom_affiche']);
  });

  it('un contributeur définit son nom affiché', async () => {
    const { client, utilisateurId } = await seConnecter(await numeroDeTestNeuf());

    const { error } = await client.from('profils').update({ nom_affiche: 'Adjovi' }).eq('id', utilisateurId);

    expect(error).toBeNull();
    const { data } = await admin.from('profils').select('nom_affiche').eq('id', utilisateurId).single();
    expect(data?.nom_affiche).toBe('Adjovi');
  });

  it('un contributeur ne peut pas se donner le statut de relais', async () => {
    const { client, utilisateurId } = await seConnecter(await numeroDeTestNeuf());

    const { error } = await client.from('profils').update({ est_relais: true }).eq('id', utilisateurId);

    expect(error?.code).toBe(REFUSE_PAR_LA_SECURITE);
    const { data } = await admin.from('profils').select('est_relais').eq('id', utilisateurId).single();
    expect(data?.est_relais).toBe(false);
  });

  it("un contributeur ne lit ni ne modifie le profil d'un autre", async () => {
    const { client, utilisateurId } = await seConnecter(await numeroDeTestNeuf());
    const { data: autre } = await admin
      .from('profils')
      .select('id, nom_affiche')
      .neq('id', utilisateurId)
      .limit(1)
      .single();

    const lecture = await client.from('profils').select('id').eq('id', autre!.id);
    const modification = await client
      .from('profils')
      .update({ nom_affiche: 'Pirate' })
      .eq('id', autre!.id)
      .select();

    expect(lecture.error).toBeNull();
    expect(lecture.data).toEqual([]);
    expect(modification.error).toBeNull();
    expect(modification.data).toEqual([]);
    const { data: apres } = await admin.from('profils').select('nom_affiche').eq('id', autre!.id).single();
    expect(apres?.nom_affiche).toBe(autre!.nom_affiche);
  });

  it('refuse un nom vide ou de plus de 40 caractères', async () => {
    const { client, utilisateurId } = await seConnecter(await numeroDeTestNeuf());

    const vide = await client.from('profils').update({ nom_affiche: '   ' }).eq('id', utilisateurId);
    const trop = await client.from('profils').update({ nom_affiche: 'x'.repeat(41) }).eq('id', utilisateurId);

    expect(vide.error?.code).toBe(CONTRAINTE_VIOLEE);
    expect(trop.error?.code).toBe(CONTRAINTE_VIOLEE);
  });

  it('un lecteur anonyme ne lit toujours aucun profil', async () => {
    await seConnecter(await numeroDeTestNeuf());

    const { data, error } = await lecteurAnonyme.from('profils').select('id');

    expect(error?.code).toBe(REFUSE_PAR_LA_SECURITE);
    expect(data).toBeNull();
  });
});
