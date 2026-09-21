-- Relevés aberrants : écartés du prix courant, jamais supprimés.
--
-- Un relevé est aberrant quand son prix unitaire s'écarte de la médiane pondérée
-- de référence (même marché, produit et unité, 7 derniers jours) d'un facteur
-- supérieur à `facteur_ecart_aberrant` (3 par défaut), dans un sens ou dans l'autre.
--
--   * la référence et le prix ne retiennent que le DERNIER relevé récent de chaque
--     contributeur : un seul compte ne peut pas déplacer la médiane en multipliant
--     ses relevés, et le minimum ci-dessous compte des contributeurs distincts ;
--   * sous `releves_min_pour_mediane` contributeurs (3 par défaut), aucun relevé
--     n'est écarté : la médiane n'est pas établie ;
--   * le relevé du relais du marché sert d'ancre : il n'est jamais écarté (sa
--     faute éventuelle pèse donc lourd : limite connue) ;
--   * un relevé aberrant ne compte ni pour le prix, ni pour la publication ;
--   * le verdict qui décide du prix est calculé EN DIRECT sur les données actuelles
--     (une médiane qui bouge fait bouger les jugements) ; en plus, chaque relevé est
--     MARQUÉ à l'envoi (médiane du moment et verdict), pour que la décision se relise
--     même quand le verdict actuel a changé ;
--   * les relevés aberrants restent en base et se relisent dans `releves_a_revoir`,
--     réservée au développeur.
--
-- Limites connues : si la majorité des contributeurs récents sont faux (ou si un
-- groupe est bimodal), tout peut être écarté et le prix n'est plus publié
-- (« pas assez de données ») ; la vue publique relit tous les relevés à chaque
-- lecture, ce qui suffit aux volumes du pilote.

insert into public.parametres (cle, valeur, description) values
  ('facteur_ecart_aberrant', 3,
   'Un relevé est aberrant quand son prix unitaire dépasse la médiane de référence de ce facteur, ou lui est inférieur de ce facteur ; minimum 1,01'),
  ('releves_min_pour_mediane', 3,
   'Nombre minimal de relevés récents (marché, produit, unité) pour juger les aberrants ; en dessous, aucun relevé n''est écarté');

alter table public.releves
  add column mediane_a_l_envoi double precision,
  add column aberrant_a_l_envoi boolean not null default false;

-- Base commune du jugement : un relevé par ligne, avec son poids, sa médiane de
-- référence et son verdict. Réservée au serveur (aucun droit pour l'API).
create view public.releves_evalues as
with reglages as (
  select
    greatest(coalesce(
      (select valeur from public.parametres where cle = 'poids_releve_sans_position'), 0.5), 0.01)::double precision
      as poids_sans_position,
    coalesce((select valeur from public.parametres where cle = 'rayon_position_max_m'), 3000)::double precision
      as rayon,
    greatest(coalesce(
      (select valeur from public.parametres where cle = 'poids_releve_de_relais'), 3), 0.01)::double precision
      as poids_relais,
    greatest(coalesce(
      (select valeur from public.parametres where cle = 'facteur_ecart_aberrant'), 3), 1.01)::double precision
      as facteur,
    coalesce((select valeur from public.parametres where cle = 'releves_min_pour_mediane'), 3)::integer
      as minimum
),
qualifies as (
  select
    s.id,
    s.produit_id,
    s.unite_id,
    s.marche_id,
    s.contributeur_id,
    s.quantite,
    s.prix_total,
    s.prix_unitaire,
    s.observe_le,
    s.cree_le,
    s.hors_bornes,
    s.hors_bornes_confirme,
    s.mediane_a_l_envoi,
    s.aberrant_a_l_envoi,
    (pr.est_relais and pr.marche_relais_id = s.marche_id) as relais_du_marche,
    s.observe_le >= now() - interval '7 days' as recent,
    (case
      when s.distance_marche_m is not null and s.distance_marche_m <= reglages.rayon then 1::double precision
      else reglages.poids_sans_position
    end) * (case when pr.est_relais and pr.marche_relais_id = s.marche_id
                 then reglages.poids_relais else 1::double precision end) as poids
  from public.releves s
  join public.profils pr on pr.id = s.contributeur_id
  cross join reglages
),
-- `retenu` : le dernier relevé récent de chaque contributeur, seul pris en compte.
retenus as (
  select
    q.*,
    q.recent and row_number() over (
      partition by q.produit_id, q.unite_id, q.marche_id, q.contributeur_id, q.recent
      order by q.observe_le desc, q.id desc
    ) = 1 as retenu
  from qualifies q
),
groupes as (
  select
    produit_id,
    unite_id,
    marche_id,
    count(*) filter (where retenu) as nombre_recents,
    public.mediane_ponderee(
      array_agg(prix_unitaire::double precision order by prix_unitaire, id) filter (where retenu),
      array_agg(poids order by prix_unitaire, id) filter (where retenu)
    ) as reference
  from retenus
  group by produit_id, unite_id, marche_id
)
select
  r.*,
  g.nombre_recents,
  g.reference,
  (r.retenu
    and not r.relais_du_marche
    and g.nombre_recents >= x.minimum
    and g.reference > 0
    and (r.prix_unitaire > g.reference * x.facteur or r.prix_unitaire < g.reference / x.facteur)
  ) as aberrant
from retenus r
join groupes g using (produit_id, unite_id, marche_id)
cross join reglages x;

revoke all on public.releves_evalues from anon, authenticated;

-- Prix courant : mêmes règles (7 jours, publication avec le relais du marché ou
-- trois contributeurs, poids), les relevés aberrants en moins.
create or replace view public.prix_courants as
with agregats as (
  select
    produit_id,
    unite_id,
    marche_id,
    count(*) filter (where retenu and not aberrant) as nombre_releves,
    (count(*) filter (where retenu and not aberrant and relais_du_marche) >= 1
      or count(distinct contributeur_id) filter (where retenu and not aberrant) >= 3) as publiable,
    public.mediane_ponderee(
      array_agg(prix_unitaire::double precision order by prix_unitaire, id) filter (where retenu and not aberrant),
      array_agg(poids order by prix_unitaire, id) filter (where retenu and not aberrant)
    ) as mediane,
    -- Un relevé écarté ne fixe pas la date de fraîcheur du prix.
    coalesce(max(observe_le) filter (where not coalesce(aberrant, false)), max(observe_le)) as dernier_releve_le
  from public.releves_evalues
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

-- Relevés écartés, à relire. Un prix hors bornes CONFIRMÉ volontairement se
-- distingue d'un écart sans confirmation, qui ressemble à une faute de frappe.
create view public.releves_a_revoir as
select
  e.id,
  m.nom as marche,
  p.nom as produit,
  u.symbole as unite,
  e.prix_total,
  e.quantite,
  e.prix_unitaire,
  e.aberrant as aberrant_actuellement,
  e.reference as mediane_actuelle,
  e.aberrant_a_l_envoi as marque_a_l_envoi,
  e.mediane_a_l_envoi,
  -- Rapport à la médiane qui a motivé la décision : celle de l'envoi si le relevé y a
  -- été marqué, sinon la médiane actuelle.
  round((e.prix_unitaire / case when e.aberrant_a_l_envoi then e.mediane_a_l_envoi else e.reference end)::numeric, 2)
    as rapport_a_la_mediane,
  e.hors_bornes,
  e.hors_bornes_confirme,
  case
    when e.hors_bornes_confirme then 'hors bornes, confirmé volontairement'
    when e.hors_bornes then 'hors bornes'
    else 'écart à la médiane, sans confirmation (probable faute de frappe)'
  end as nature,
  pr.nom_affiche as contributeur,
  e.observe_le,
  e.cree_le
from public.releves_evalues e
join public.marches m on m.id = e.marche_id
join public.produits p on p.id = e.produit_id
join public.unites u on u.id = e.unite_id
join public.profils pr on pr.id = e.contributeur_id
where e.aberrant or e.aberrant_a_l_envoi
order by e.cree_le desc;

revoke all on public.releves_a_revoir from anon, authenticated;

-- Le marquage à l'envoi lit `releves_evalues` : sa fonction et son trigger sont
-- créés une fois la vue en place.
create function public.juger_releve_a_l_envoi()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  reference double precision;
  nombre bigint;
  facteur double precision := greatest(coalesce(
    (select valeur from public.parametres where cle = 'facteur_ecart_aberrant'), 3), 1.01);
  minimum integer := coalesce((select valeur from public.parametres where cle = 'releves_min_pour_mediane'), 3);
  unitaire double precision := new.prix_total / nullif(new.quantite, 0);
begin
  new.mediane_a_l_envoi := null;
  new.aberrant_a_l_envoi := false;
  -- Un relevé de plus de 7 jours n'est pas jugé : il ne compte pas dans la fenêtre.
  if new.observe_le < now() - interval '7 days' then
    return new;
  end if;

  select e.reference, e.nombre_recents into reference, nombre
  from public.releves_evalues e
  where e.produit_id = new.produit_id and e.unite_id = new.unite_id and e.marche_id = new.marche_id
  limit 1;

  new.mediane_a_l_envoi := reference;
  new.aberrant_a_l_envoi := coalesce(
    coalesce(nombre, 0) >= minimum
    and coalesce(reference, 0) > 0
    and not exists (
      select 1 from public.profils p
      where p.id = new.contributeur_id and p.est_relais and p.marche_relais_id = new.marche_id)
    and (unitaire > reference * facteur or unitaire < reference / facteur),
    false);
  return new;
end;
$$;

revoke execute on function public.juger_releve_a_l_envoi() from public, anon, authenticated;

create trigger juger_releve_avant_insertion
  before insert on public.releves
  for each row execute function public.juger_releve_a_l_envoi();
