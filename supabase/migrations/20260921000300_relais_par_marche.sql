-- Relais : ancres de confiance rattachées à un marché.
--
-- Un relais est désigné à la main depuis le tableau de bord de la base : le
-- développeur coche `est_relais` ET choisit `marche_relais_id`. Le contributeur ne
-- peut modifier ni l'un ni l'autre (droits de colonne : seul `nom_affiche` est
-- modifiable). Un relais ancre SON marché : ses relevés y pèsent davantage et un
-- seul suffit à publier le prix courant. Ailleurs, il compte comme tout le monde.

alter table public.profils
  add column marche_relais_id bigint references public.marches (id),
  add constraint profils_relais_avec_marche check (est_relais = (marche_relais_id is not null));

-- Marquage figé à l'envoi : le relevé garde la trace « fait par le relais de ce
-- marché », même si le statut change ensuite. Décidé par le serveur, invisible du
-- client (aucun droit de lecture ni d'écriture sur cette colonne).
alter table public.releves add column par_relais boolean not null default false;

create function public.marquer_releve_de_relais()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.par_relais := exists (
    select 1 from public.profils
    where id = new.contributeur_id and est_relais and marche_relais_id = new.marche_id
  );
  return new;
end;
$$;

revoke execute on function public.marquer_releve_de_relais() from public, anon, authenticated;

create trigger marquer_relais_avant_insertion
  before insert on public.releves
  for each row execute function public.marquer_releve_de_relais();

-- Facteur de poids d'un relevé de relais, appliqué en plus du poids lié à la
-- position. Réglable depuis le tableau de bord ; minimum appliqué : 0,01.
insert into public.parametres (cle, valeur, description) values
  ('poids_releve_de_relais', 3,
   'Facteur de poids, dans la médiane du prix courant, d''un relevé fait par le relais de son marché (multiplié par le poids lié à la position) ; minimum 0,01');

-- Prix courant : mêmes règles (7 jours, publication avec le relais du marché ou
-- trois contributeurs), avec le poids des relais en plus.
create or replace view public.prix_courants as
with reglages as (
  select
    greatest(coalesce(
      (select valeur from public.parametres where cle = 'poids_releve_sans_position'), 0.5), 0.01)::double precision
      as poids_sans_position,
    coalesce((select valeur from public.parametres where cle = 'rayon_position_max_m'), 3000)::double precision
      as rayon,
    greatest(coalesce(
      (select valeur from public.parametres where cle = 'poids_releve_de_relais'), 3), 0.01)::double precision
      as poids_relais
),
releves_qualifies as (
  select
    s.id,
    s.produit_id,
    s.unite_id,
    s.marche_id,
    s.contributeur_id,
    s.prix_unitaire,
    s.observe_le,
    s.par_relais,
    s.observe_le >= now() - interval '7 days' as recent,
    (case
      when s.distance_marche_m is not null and s.distance_marche_m <= reglages.rayon then 1::double precision
      else reglages.poids_sans_position
    end) * (case when s.par_relais then reglages.poids_relais else 1::double precision end) as poids
  from public.releves s
  cross join reglages
),
agregats as (
  select
    produit_id,
    unite_id,
    marche_id,
    count(*) filter (where recent) as nombre_releves,
    (count(*) filter (where recent and par_relais) >= 1
      or count(distinct contributeur_id) filter (where recent) >= 3) as publiable,
    public.mediane_ponderee(
      array_agg(prix_unitaire::double precision order by prix_unitaire, id) filter (where recent),
      array_agg(poids order by prix_unitaire, id) filter (where recent)
    ) as mediane,
    max(observe_le) as dernier_releve_le
  from releves_qualifies
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
  a.nombre_releves,
  a.dernier_releve_le
from agregats a
join public.produits p on p.id = a.produit_id
join public.unites u on u.id = a.unite_id
join public.marches m on m.id = a.marche_id;
