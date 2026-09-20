-- Profils, collectes et prix courants.
--
-- Principe : le serveur décide. Les tables sont fermées par la sécurité par
-- ligne (aucune politique : personne ne lit ni n'écrit via l'API pour
-- l'instant) ; le public ne lit que la fonction `prix_courants`, calculée ici.

-- Profil d'un compte. Le statut de relais est une donnée du compte, attribuée
-- à la main par le développeur depuis le tableau de bord de la base.
create table public.profils (
  id uuid primary key references auth.users (id) on delete cascade,
  nom_affiche text,
  est_relais boolean not null default false,
  cree_le timestamptz not null default now()
);

alter table public.profils enable row level security;

-- Une collecte : un prix total pour une quantité d'une unité, d'un produit,
-- sur un marché, par un contributeur, observé à une date donnée.
create table public.collectes (
  id uuid primary key default gen_random_uuid(),
  produit_id bigint not null,
  unite_id bigint not null,
  marche_id bigint not null references public.marches (id),
  contributeur_id uuid not null references public.profils (id),
  quantite numeric not null default 1 check (quantite > 0),
  prix_total numeric not null check (prix_total > 0),
  -- Calculé par le serveur : le client ne peut pas le forger.
  prix_unitaire numeric generated always as (prix_total / quantite) stored,
  observe_le timestamptz not null default now(),
  cree_le timestamptz not null default now(),
  -- L'unité doit être valide pour le produit.
  foreign key (produit_id, unite_id) references public.produits_unites (produit_id, unite_id)
);

create index collectes_prix_courant_idx
  on public.collectes (marche_id, produit_id, unite_id, observe_le);

alter table public.collectes enable row level security;

-- Prix courant : médiane du prix unitaire des collectes des `jours` derniers
-- jours (7 par défaut, de 1 à 90), pour un même produit, marché et unité. Publié
-- seulement si au moins un relais a collecté, ou si au moins trois contributeurs
-- différents ont collecté, dans cette période ; sinon `prix` est nul et
-- `derniere_collecte_le` indique la dernière collecte.
--
-- La fonction s'exécute avec les droits de son propriétaire : c'est voulu, elle
-- est la seule porte de lecture vers les collectes et les profils (voir ADR 0002).
create function public.prix_courants(jours integer default 7)
returns table (
  produit_id bigint,
  unite_id bigint,
  marche_id bigint,
  produit text,
  unite text,
  marche text,
  statut text,
  prix double precision,
  nombre_collectes bigint,
  derniere_collecte_le timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if jours is null or jours < 1 or jours > 90 then
    raise exception 'La période doit être comprise entre 1 et 90 jours'
      using errcode = '22023';
  end if;

  return query
  with collectes_qualifiees as (
    select
      c.produit_id,
      c.unite_id,
      c.marche_id,
      c.contributeur_id,
      c.prix_unitaire,
      c.observe_le,
      pr.est_relais,
      c.observe_le >= now() - make_interval(days => jours) as recent
    from public.collectes c
    join public.profils pr on pr.id = c.contributeur_id
  ),
  agregats as (
    select
      q.produit_id,
      q.unite_id,
      q.marche_id,
      count(*) filter (where q.recent) as nombre_collectes,
      (count(*) filter (where q.recent and q.est_relais) >= 1
        or count(distinct q.contributeur_id) filter (where q.recent) >= 3) as publiable,
      percentile_cont(0.5) within group (order by q.prix_unitaire) filter (where q.recent) as mediane,
      max(q.observe_le) as derniere_collecte_le
    from collectes_qualifiees q
    group by q.produit_id, q.unite_id, q.marche_id
  )
  select
    a.produit_id,
    a.unite_id,
    a.marche_id,
    p.nom,
    u.symbole,
    m.nom,
    case when a.publiable then 'publie' else 'pas_assez_de_donnees' end,
    case when a.publiable then a.mediane end,
    a.nombre_collectes,
    a.derniere_collecte_le
  from agregats a
  join public.produits p on p.id = a.produit_id
  join public.unites u on u.id = a.unite_id
  join public.marches m on m.id = a.marche_id;
end;
$$;

revoke all on function public.prix_courants(integer) from public, anon, authenticated;
grant execute on function public.prix_courants(integer) to anon, authenticated;
