-- Position facultative du relevé.
--
-- Le contributeur peut joindre sa position à un relevé. Elle est stockée côté
-- serveur uniquement : aucune colonne de position n'est lisible par l'API, ni par
-- l'auteur, ni par les autres, ni par un lecteur anonyme. Le serveur en déduit la
-- distance au marché. Un relevé sans position n'est jamais refusé : il pèse moins
-- dans le prix courant (médiane pondérée).

-- Coordonnées des marchés : publiques comme le reste du référentiel. Valeurs
-- APPROXIMATIVES, à corriger sur place avec les relais.
alter table public.marches
  add column latitude double precision,
  add column longitude double precision,
  add constraint marches_coordonnees_valides check (
    (latitude is null) = (longitude is null)
    and latitude between -90 and 90
    and longitude between -180 and 180
  );

update public.marches m
set latitude = c.latitude, longitude = c.longitude
from (values
  ('Ganhi', 6.3610, 2.4225),
  ('Dantokpa', 6.3670, 2.4350),
  ('Ouando', 6.4880, 2.6180),
  ('Bohicon', 7.1783, 2.0667)
) as c (nom, latitude, longitude)
where m.nom = c.nom;

-- Position du relevé. `distance_marche_m` est calculée par le serveur.
-- En Postgres, NaN et l'infini sortent de « between » : ils sont refusés.
alter table public.releves
  add column latitude double precision,
  add column longitude double precision,
  add column distance_marche_m integer,
  add constraint releves_position_valide check (
    (latitude is null) = (longitude is null)
    and latitude between -90 and 90
    and longitude between -180 and 180
  );

-- Distance à vol d'oiseau entre deux points (formule de haversine), en mètres.
create function public.distance_metres(
  latitude_a double precision, longitude_a double precision,
  latitude_b double precision, longitude_b double precision
)
returns double precision
language sql
immutable
parallel safe
as $$
  select 2 * 6371000 * asin(least(1, sqrt(
    sin(radians(latitude_b - latitude_a) / 2) ^ 2
    + cos(radians(latitude_a)) * cos(radians(latitude_b)) * sin(radians(longitude_b - longitude_a) / 2) ^ 2
  )))
$$;

-- `security definer` : le trigger appelle distance_metres, fermée à l'API.
create function public.calculer_distance_releve()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  marche record;
begin
  new.distance_marche_m := null;
  if new.latitude is not null then
    select latitude, longitude into marche from public.marches where id = new.marche_id;
    if marche.latitude is not null then
      new.distance_marche_m := round(
        public.distance_metres(new.latitude, new.longitude, marche.latitude, marche.longitude));
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.calculer_distance_releve() from public, anon, authenticated;
-- Fonction pure utilisée par le seul trigger : inutile pour l'API, donc fermée.
revoke execute on function public.distance_metres(double precision, double precision, double precision, double precision)
  from public, anon, authenticated;

create trigger calculer_distance_avant_insertion
  before insert on public.releves
  for each row execute function public.calculer_distance_releve();

-- Droits du contributeur : il peut envoyer une position, jamais la relire. La
-- lecture passe à des colonnes nommées, sans latitude, longitude ni distance.
revoke select on public.releves from authenticated;
grant select (
  id, produit_id, unite_id, marche_id, contributeur_id, quantite, prix_total,
  prix_unitaire, observe_le, cree_le, hors_bornes, hors_bornes_confirme
) on public.releves to authenticated;
grant insert (latitude, longitude) on public.releves to authenticated;

-- Poids d'un relevé sans position dans la médiane du prix courant. Un relevé avec
-- position pèse 1. Réglable depuis le tableau de bord ; minimum appliqué : 0,01.
insert into public.parametres (cle, valeur, description) values
  ('poids_releve_sans_position', 0.5,
   'Poids, dans la médiane du prix courant, d''un relevé sans position (un relevé avec position pèse 1) ; minimum 0,01'),
  ('rayon_position_max_m', 3000,
   'Distance maximale, en mètres, entre la position d''un relevé et son marché pour qu''elle donne le poids plein ; au-delà, ou sans coordonnées du marché, le relevé pèse comme un relevé sans position');

-- Médiane pondérée, interpolée comme une médiane ordinaire : avec des poids égaux
-- elle donne exactement le même résultat que percentile_cont(0.5). Entrées triées
-- par valeur croissante ; les poids nuls ou négatifs sont ignorés. Le relevé i est
-- placé au milieu de son poids sur l'axe cumulé ; la médiane est lue à la
-- position 0,5. Fonction pure : elle reste appelable, car Postgres exige de l'appelant d'une vue
-- qu'il puisse exécuter les fonctions de cette vue (ici prix_courants).
create function public.mediane_ponderee(valeurs double precision[], poids double precision[])
returns double precision
language plpgsql
immutable
strict
as $$
declare
  n integer := coalesce(array_length(valeurs, 1), 0);
  total double precision;
  cumul double precision := 0;
  position_precedente double precision;
  position_courante double precision;
  precedent integer;
  i integer;
begin
  if n <> coalesce(array_length(poids, 1), 0) then
    raise exception 'valeurs et poids doivent avoir la même longueur' using errcode = '22023';
  end if;
  select sum(p) into total from unnest(poids) as p where p > 0;
  if total is null then
    return null;
  end if;

  for i in 1..n loop
    if poids[i] > 0 then
      position_courante := (cumul + poids[i] / 2) / total;
      if position_courante >= 0.5 then
        if precedent is null or position_courante = 0.5 then
          return valeurs[i];
        end if;
        return valeurs[precedent]
          + (0.5 - position_precedente) / (position_courante - position_precedente)
            * (valeurs[i] - valeurs[precedent]);
      end if;
      position_precedente := position_courante;
      precedent := i;
      cumul := cumul + poids[i];
    end if;
  end loop;
  return valeurs[precedent];
end;
$$;

-- Prix courant : mêmes règles qu'avant (7 jours, publication avec un relais ou
-- trois contributeurs), mais la médiane est pondérée. Un relevé pèse 1 quand sa
-- position est vérifiée, c'est-à-dire à moins de `rayon_position_max_m` de son
-- marché : sans cela, un client pourrait envoyer une position quelconque pour peser
-- plus. Sinon (sans position, position trop éloignée, marché sans coordonnées), il
-- pèse `poids_releve_sans_position`.
create or replace view public.prix_courants as
with reglages as (
  select
    greatest(coalesce(
      (select valeur from public.parametres where cle = 'poids_releve_sans_position'), 0.5), 0.01)::double precision
      as poids_sans_position,
    coalesce((select valeur from public.parametres where cle = 'rayon_position_max_m'), 3000)::double precision
      as rayon
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
    pr.est_relais,
    s.observe_le >= now() - interval '7 days' as recent,
    case
      when s.distance_marche_m is not null and s.distance_marche_m <= reglages.rayon then 1::double precision
      else reglages.poids_sans_position
    end as poids
  from public.releves s
  join public.profils pr on pr.id = s.contributeur_id
  cross join reglages
),
agregats as (
  select
    produit_id,
    unite_id,
    marche_id,
    count(*) filter (where recent) as nombre_releves,
    (count(*) filter (where recent and est_relais) >= 1
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
