-- DONNÉES D'EXEMPLE, ENTIÈREMENT FACTICES : prix inventés, comptes « Exemple »
-- créés pour tester l'app en local. Ce fichier ne s'applique qu'à `supabase db
-- reset` (base locale) et jamais en production : le référentiel réel vit dans
-- les migrations.

insert into auth.users (id, instance_id, aud, role, phone, phone_confirmed_at, created_at, updated_at) values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '22900000001', now(), now(), now()),
  ('00000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '22900000002', now(), now(), now()),
  ('00000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '22900000003', now(), now(), now()),
  ('00000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '22900000004', now(), now(), now()),
  ('00000000-0000-4000-8000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '22900000005', now(), now(), now());

insert into public.profils (id, nom_affiche, est_relais) values
  ('00000000-0000-4000-8000-000000000001', 'Exemple – relais Ganhi', true),
  ('00000000-0000-4000-8000-000000000002', 'Exemple – relais Bohicon', true),
  ('00000000-0000-4000-8000-000000000003', 'Exemple – contributeur 1', false),
  ('00000000-0000-4000-8000-000000000004', 'Exemple – contributeur 2', false),
  ('00000000-0000-4000-8000-000000000005', 'Exemple – contributeur 3', false);

-- (auteur, marché, produit, unité, prix total, jours écoulés)
insert into public.collectes (contributeur_id, marche_id, produit_id, unite_id, prix_total, observe_le)
select e.auteur::uuid, m.id, p.id, u.id, e.prix, now() - make_interval(days => e.jours)
from (values
  -- Ganhi : un relais suffit à publier.
  ('00000000-0000-4000-8000-000000000001', 'Ganhi', 'maïs', 'kg', 425, 0),
  ('00000000-0000-4000-8000-000000000001', 'Ganhi', 'riz', 'kg', 650, 1),
  ('00000000-0000-4000-8000-000000000001', 'Ganhi', 'gari', 'kg', 550, 2),
  ('00000000-0000-4000-8000-000000000001', 'Ganhi', 'huile végétale', 'L', 1500, 2),
  ('00000000-0000-4000-8000-000000000001', 'Ganhi', 'œufs', 'pièce', 100, 0),
  ('00000000-0000-4000-8000-000000000003', 'Ganhi', 'maïs', 'kg', 450, 1),
  -- Ouando : trois contributeurs, sans relais, publient ; deux ne suffisent pas.
  ('00000000-0000-4000-8000-000000000003', 'Ouando', 'sucre', 'kg', 800, 0),
  ('00000000-0000-4000-8000-000000000004', 'Ouando', 'sucre', 'kg', 850, 1),
  ('00000000-0000-4000-8000-000000000005', 'Ouando', 'sucre', 'kg', 820, 3),
  ('00000000-0000-4000-8000-000000000003', 'Ouando', 'haricot', 'kg', 900, 1),
  ('00000000-0000-4000-8000-000000000004', 'Ouando', 'haricot', 'kg', 950, 2),
  -- Bohicon : un relais, et un prix trop ancien pour être publié.
  ('00000000-0000-4000-8000-000000000002', 'Bohicon', 'igname', 'pièce', 1200, 1),
  ('00000000-0000-4000-8000-000000000002', 'Bohicon', 'piment', 'kg', 2500, 4),
  ('00000000-0000-4000-8000-000000000002', 'Bohicon', 'huile de palme', 'L', 1300, 12)
) as e (auteur, marche, produit, unite, prix, jours)
join public.marches m on m.nom = e.marche
join public.produits p on p.nom = e.produit
join public.unites u on u.symbole = e.unite;
-- « Dantokpa » reste volontairement sans collecte (état vide).
