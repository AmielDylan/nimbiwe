-- Profils, signalements et prix courants.
--
-- Principe : le serveur décide. Les tables sont fermées par la sécurité par
-- ligne (aucune politique : personne ne lit ni n'écrit via l'API pour
-- l'instant) ; le public ne lit que la vue `prix_courants`, calculée ici.

-- Profil d'un compte. Le statut de relais est une donnée du compte, attribuée
-- à la main par le développeur depuis le tableau de bord de la base.
create table public.profils (
  id uuid primary key references auth.users (id) on delete cascade,
  nom_affiche text,
  est_relais boolean not null default false,
  cree_le timestamptz not null default now()
);

alter table public.profils enable row level security;

-- Un signalement : un prix total pour une quantité d'une unité, d'un produit,
-- sur un marché, par un contributeur, observé à une date donnée.
create table public.signalements (
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

create index signalements_prix_courant_idx
  on public.signalements (marche_id, produit_id, unite_id, observe_le);

alter table public.signalements enable row level security;

-- Prix courant : médiane du prix unitaire des signalements des 7 derniers
-- jours, pour un même produit, marché et unité. Publié seulement si au moins un
-- relais a signalé, ou si au moins trois contributeurs différents ont signalé ;
-- sinon `prix` est nul et `derniere_observation` indique le dernier signalement.
--
-- La vue s'exécute avec les droits de son propriétaire : c'est voulu, elle est
-- la seule porte de lecture vers les signalements et les profils.
create view public.prix_courants as
with signalements_qualifies as (
  select
    s.produit_id,
    s.unite_id,
    s.marche_id,
    s.contributeur_id,
    s.prix_unitaire,
    s.observe_le,
    pr.est_relais,
    s.observe_le >= now() - interval '7 days' as recent
  from public.signalements s
  join public.profils pr on pr.id = s.contributeur_id
),
agregats as (
  select
    produit_id,
    unite_id,
    marche_id,
    count(*) filter (where recent) as nombre_signalements,
    (count(*) filter (where recent and est_relais) >= 1
      or count(distinct contributeur_id) filter (where recent) >= 3) as publiable,
    percentile_cont(0.5) within group (order by prix_unitaire) filter (where recent) as mediane,
    max(observe_le) as derniere_observation
  from signalements_qualifies
  group by produit_id, unite_id, marche_id
)
select
  a.produit_id,
  a.unite_id,
  a.marche_id,
  p.nom as produit,
  u.symbole as unite,
  m.nom as marche,
  case when a.publiable then 'publie' else 'pas_assez_de_donnees' end as statut,
  case when a.publiable then a.mediane end as prix,
  a.nombre_signalements,
  a.derniere_observation
from agregats a
join public.produits p on p.id = a.produit_id
join public.unites u on u.id = a.unite_id
join public.marches m on m.id = a.marche_id;

revoke all on public.prix_courants from anon, authenticated;
grant select on public.prix_courants to anon, authenticated;
