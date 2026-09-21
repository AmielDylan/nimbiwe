-- Relevés aberrants : écartés du prix courant, jamais supprimés.
--
-- Un relevé est aberrant quand son prix unitaire s'écarte de la médiane pondérée
-- de référence (même marché, produit et unité, 7 derniers jours) d'un facteur
-- supérieur à `facteur_ecart_aberrant` (3 par défaut), dans un sens ou dans l'autre.
-- Le jugement est calculé en direct sur les données actuelles : une médiane qui
-- bouge fait bouger les jugements, sans état à maintenir.
--
--   * sous `releves_min_pour_mediane` relevés récents (3 par défaut), aucun relevé
--     n'est écarté : la médiane n'est pas établie ;
--   * le relevé du relais du marché sert d'ancre : il n'est jamais écarté ;
--   * un relevé aberrant ne compte ni pour le prix, ni pour la publication ;
--   * les relevés aberrants restent en base et se relisent dans `releves_a_revoir`,
--     réservée au développeur.
--
-- Limite connue : la médiane de référence est robuste mais pas infaillible ; si la
-- majorité des relevés récents sont faux, les bons peuvent être écartés.

insert into public.parametres (cle, valeur, description) values
  ('facteur_ecart_aberrant', 3,
   'Un relevé est aberrant quand son prix unitaire dépasse la médiane de référence de ce facteur, ou lui est inférieur de ce facteur ; minimum 1,01'),
  ('releves_min_pour_mediane', 3,
   'Nombre minimal de relevés récents (marché, produit, unité) pour juger les aberrants ; en dessous, aucun relevé n''est écarté');

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
groupes as (
  select
    produit_id,
    unite_id,
    marche_id,
    count(*) filter (where recent) as nombre_recents,
    public.mediane_ponderee(
      array_agg(prix_unitaire::double precision order by prix_unitaire, id) filter (where recent),
      array_agg(poids order by prix_unitaire, id) filter (where recent)
    ) as reference
  from qualifies
  group by produit_id, unite_id, marche_id
)
select
  q.*,
  g.nombre_recents,
  g.reference,
  (q.recent
    and not q.relais_du_marche
    and g.nombre_recents >= r.minimum
    and g.reference > 0
    and (q.prix_unitaire > g.reference * r.facteur or q.prix_unitaire < g.reference / r.facteur)
  ) as aberrant
from qualifies q
join groupes g using (produit_id, unite_id, marche_id)
cross join reglages r;

revoke all on public.releves_evalues from anon, authenticated;

-- Prix courant : mêmes règles (7 jours, publication avec le relais du marché ou
-- trois contributeurs, poids), les relevés aberrants en moins.
create or replace view public.prix_courants as
with agregats as (
  select
    produit_id,
    unite_id,
    marche_id,
    count(*) filter (where recent and not aberrant) as nombre_releves,
    (count(*) filter (where recent and not aberrant and relais_du_marche) >= 1
      or count(distinct contributeur_id) filter (where recent and not aberrant) >= 3) as publiable,
    public.mediane_ponderee(
      array_agg(prix_unitaire::double precision order by prix_unitaire, id) filter (where recent and not aberrant),
      array_agg(poids order by prix_unitaire, id) filter (where recent and not aberrant)
    ) as mediane,
    max(observe_le) as dernier_releve_le
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
  e.reference as mediane_de_reference,
  round((e.prix_unitaire / e.reference)::numeric, 2) as rapport_a_la_mediane,
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
where e.aberrant
order by e.cree_le desc;

revoke all on public.releves_a_revoir from anon, authenticated;
