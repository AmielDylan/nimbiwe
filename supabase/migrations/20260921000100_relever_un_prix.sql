-- Relever un prix : le serveur décide.
--
-- Un contributeur connecté envoie un relevé avec les seuls champs autorisés
-- (produit, unité, marché, quantité, prix total, date d'observation, confirmation
-- d'un prix hors bornes). Tout le reste est décidé ici : auteur, prix unitaire,
-- indicateur « hors bornes », limite de fréquence, compte bloqué, date valide.
-- Les refus portent un code propre à Nimbiwe (NB001 à NB004) que l'app traduit.

-- Statut « bloqué » : posé à la main depuis le tableau de bord de la base.
alter table public.profils add column est_bloque boolean not null default false;

-- Paramètres réglables depuis le tableau de bord, jamais lisibles par le client.
create table public.parametres (
  cle text primary key,
  valeur numeric not null,
  description text
);

alter table public.parametres enable row level security;
revoke all on public.parametres from anon, authenticated;

insert into public.parametres (cle, valeur, description) values
  ('releves_max_par_jour', 5, 'Relevés maximaux par contributeur, produit et marché sur 24 heures'),
  ('releve_anciennete_max_jours', 7, 'Ancienneté maximale de la date d''observation d''un relevé, en jours');

-- Bornes plausibles : fourchette de prix UNITAIRE réaliste par produit et unité.
-- Un prix hors bornes n'est jamais refusé définitivement : il exige une
-- confirmation explicite. Valeurs d'exemple (FCFA), à fixer avec les relais.
create table public.bornes_plausibles (
  produit_id bigint not null,
  unite_id bigint not null,
  prix_unitaire_min numeric not null check (prix_unitaire_min > 0),
  prix_unitaire_max numeric not null,
  primary key (produit_id, unite_id),
  foreign key (produit_id, unite_id) references public.produits_unites (produit_id, unite_id),
  check (prix_unitaire_max > prix_unitaire_min)
);

alter table public.bornes_plausibles enable row level security;
revoke all on public.bornes_plausibles from anon, authenticated;

insert into public.bornes_plausibles (produit_id, unite_id, prix_unitaire_min, prix_unitaire_max)
select p.id, u.id, b.minimum, b.maximum
from (values
  ('maïs', 'kg', 150, 800),
  ('riz', 'kg', 400, 1500),
  ('gari', 'kg', 300, 1200),
  ('haricot', 'kg', 500, 2000),
  ('igname', 'kg', 200, 1500),
  ('igname', 'pièce', 500, 5000),
  ('tomate', 'kg', 200, 2500),
  ('oignon', 'kg', 300, 2000),
  ('piment', 'kg', 500, 6000),
  ('huile végétale', 'L', 900, 2500),
  ('huile de palme', 'L', 800, 2500),
  ('sucre', 'kg', 500, 1500),
  ('œufs', 'pièce', 50, 250)
) as b (produit, unite, minimum, maximum)
join public.produits p on p.nom = b.produit
join public.unites u on u.symbole = b.unite;

-- Nouvelles colonnes du relevé.
alter table public.releves
  -- Décidé par le serveur : le prix unitaire sort des bornes plausibles.
  add column hors_bornes boolean not null default false,
  -- Déclaré par le client ; le serveur ne le retient que si le prix est hors bornes.
  add column hors_bornes_confirme boolean not null default false,
  alter column contributeur_id set default auth.uid(),
  -- Clés directes (en plus de la paire produit-unité valide) : l'API en a besoin
  -- pour joindre les noms du produit et de l'unité à la liste de mes relevés.
  add foreign key (produit_id) references public.produits (id),
  add foreign key (unite_id) references public.unites (id);

create function public.verifier_releve()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  appelant text := auth.jwt() ->> 'role';
  unitaire numeric;
  bornes record;
  maximum_par_jour numeric;
  anciennete_maximale numeric;
  deja_relevees integer;
begin
  -- `nullif` : une quantité nulle n'est pas une division par zéro ici, mais un
  -- refus ordinaire de la contrainte de la table.
  unitaire := new.prix_total / nullif(new.quantite, 0);

  select prix_unitaire_min, prix_unitaire_max into bornes
  from public.bornes_plausibles
  where produit_id = new.produit_id and unite_id = new.unite_id;

  -- Sans bornes connues pour ce produit et cette unité, rien n'est hors bornes.
  new.hors_bornes := coalesce(unitaire < bornes.prix_unitaire_min or unitaire > bornes.prix_unitaire_max, false);
  new.hors_bornes_confirme := new.hors_bornes and coalesce(new.hors_bornes_confirme, false);

  -- Les garde-fous s'appliquent à tout appel de l'API, sauf le tableau de bord, les
  -- imports et les tests (service_role, ou connexion directe en postgres). Liste
  -- blanche : sans rôle reconnu, les garde-fous s'appliquent.
  if appelant = 'service_role' or session_user in ('postgres', 'supabase_admin') then
    return new;
  end if;

  if exists (select 1 from public.profils where id = new.contributeur_id and est_bloque) then
    raise exception 'Ce compte ne peut plus relever de prix' using errcode = 'NB001';
  end if;

  select valeur into anciennete_maximale from public.parametres where cle = 'releve_anciennete_max_jours';
  if new.observe_le > now() + interval '5 minutes'
     or new.observe_le < now() - make_interval(days => coalesce(anciennete_maximale, 7)::integer) then
    raise exception 'La date d''observation est invalide' using errcode = 'NB004';
  end if;

  -- Deux envois simultanés du même contributeur pour le même produit et marché
  -- passent l'un après l'autre : sans ce verrou, ils compteraient tous deux le même total.
  perform pg_advisory_xact_lock(
    hashtextextended(new.contributeur_id::text || ':' || new.produit_id || ':' || new.marche_id, 0));

  select valeur into maximum_par_jour from public.parametres where cle = 'releves_max_par_jour';
  select count(*) into deja_relevees
  from public.releves
  where contributeur_id = new.contributeur_id
    and produit_id = new.produit_id
    and marche_id = new.marche_id
    and cree_le > now() - interval '1 day';
  if deja_relevees >= coalesce(maximum_par_jour, 5) then
    raise exception 'Limite de relevés atteinte pour aujourd''hui' using errcode = 'NB002';
  end if;

  if new.hors_bornes and not new.hors_bornes_confirme then
    raise exception 'Prix hors des bornes plausibles : confirmation requise'
      using errcode = 'NB003', hint = case when unitaire > bornes.prix_unitaire_max then 'haut' else 'bas' end;
  end if;

  return new;
end;
$$;

revoke execute on function public.verifier_releve() from public, anon, authenticated;

create index releves_limite_quotidienne_idx
  on public.releves (contributeur_id, produit_id, marche_id, cree_le);

create trigger verifier_releve_avant_insertion
  before insert on public.releves
  for each row execute function public.verifier_releve();

-- Droits du contributeur : créer un relevé avec les seuls champs autorisés, et
-- lire les siennes. Ni modification ni suppression.
revoke all on public.releves from anon, authenticated;
grant select on public.releves to authenticated;
grant insert (produit_id, unite_id, marche_id, quantite, prix_total, observe_le, hors_bornes_confirme)
  on public.releves to authenticated;

create policy "Un contributeur lit ses relevés"
  on public.releves for select
  to authenticated
  using (contributeur_id = (select auth.uid()));

create policy "Un contributeur crée ses relevés"
  on public.releves for insert
  to authenticated
  with check (contributeur_id = (select auth.uid()));

-- Le statut « bloqué » ne se pose que depuis le tableau de bord : les droits de
-- colonne du contributeur sur son profil restent limités à `nom_affiche`.
