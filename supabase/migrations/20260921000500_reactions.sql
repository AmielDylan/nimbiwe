-- Confirmer et contester un relevé.
--
-- Un contributeur connecté peut confirmer ou contester le relevé d'un AUTRE,
-- changer ou retirer sa réaction (une réaction par personne et par relevé). Un
-- relevé contesté par au moins `contestations_min_pour_exclure` personnes (3 par
-- défaut), et plus qu'il n'est confirmé, sort du prix courant, sans être supprimé.
-- Les réactions individuelles restent privées ; le public ne voit que les compteurs.
-- Limite connue : rien n'empêche encore quelqu'un qui contrôle plusieurs numéros de
-- téléphone de contester en nombre.

create table public.reactions (
  releve_id uuid not null references public.releves (id) on delete cascade,
  contributeur_id uuid not null default auth.uid() references public.profils (id) on delete cascade,
  type text not null check (type in ('confirmation', 'contestation')),
  cree_le timestamptz not null default now(),
  primary key (releve_id, contributeur_id)
);

alter table public.reactions enable row level security;

-- Le contributeur ne lit, ne crée, ne modifie et ne supprime que SES réactions.
revoke all on public.reactions from anon, authenticated;
grant select on public.reactions to authenticated;
grant insert (releve_id, type) on public.reactions to authenticated;
grant update (type) on public.reactions to authenticated;
grant delete on public.reactions to authenticated;

create policy "Un contributeur lit ses réactions"
  on public.reactions for select to authenticated
  using (contributeur_id = (select auth.uid()));
create policy "Un contributeur crée ses réactions"
  on public.reactions for insert to authenticated
  with check (contributeur_id = (select auth.uid()));
create policy "Un contributeur modifie ses réactions"
  on public.reactions for update to authenticated
  using (contributeur_id = (select auth.uid()))
  with check (contributeur_id = (select auth.uid()));
create policy "Un contributeur retire ses réactions"
  on public.reactions for delete to authenticated
  using (contributeur_id = (select auth.uid()));

-- Règles décidées par le serveur : pas de réaction à son propre relevé (NB005), pas
-- de réaction d'un compte bloqué (NB001).
create function public.verifier_reaction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.jwt() ->> 'role' = 'service_role' or session_user in ('postgres', 'supabase_admin') then
    return new;
  end if;
  if exists (select 1 from public.profils where id = new.contributeur_id and est_bloque) then
    raise exception 'Ce compte ne peut plus réagir' using errcode = 'NB001';
  end if;
  if exists (select 1 from public.releves where id = new.releve_id and contributeur_id = new.contributeur_id) then
    raise exception 'On ne réagit pas à son propre relevé' using errcode = 'NB005';
  end if;
  return new;
end;
$$;

revoke execute on function public.verifier_reaction() from public, anon, authenticated;

create trigger verifier_reaction_avant_insertion
  before insert on public.reactions
  for each row execute function public.verifier_reaction();

insert into public.parametres (cle, valeur, description) values
  ('contestations_min_pour_exclure', 3,
   'Nombre minimal de contestations pour qu''un relevé, contesté plus qu''il n''est confirmé, sorte du prix courant');

-- Les vues de calcul changent de colonnes : on les recrée (elles ne sont pas
-- lisibles par l'API, sauf prix_courants, dont les droits sont rétablis).
drop view public.releves_a_revoir;
drop view public.prix_courants;
drop view public.releves_evalues;

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
      as minimum,
    coalesce((select valeur from public.parametres where cle = 'contestations_min_pour_exclure'), 3)::bigint
      as seuil_contestation
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
    rx.confirmations,
    rx.contestations,
    -- Contesté : au moins `seuil_contestation` contestations, et plus que de confirmations.
    (rx.contestations >= reglages.seuil_contestation and rx.contestations > rx.confirmations) as conteste,
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
  cross join lateral (
    select
      count(*) filter (where r.type = 'confirmation') as confirmations,
      count(*) filter (where r.type = 'contestation') as contestations
    from public.reactions r
    where r.releve_id = s.id
  ) rx
),
-- `dernier` : le dernier relevé récent de chaque contributeur.
avec_dernier as (
  select
    q.*,
    q.recent and row_number() over (
      partition by q.produit_id, q.unite_id, q.marche_id, q.contributeur_id, q.recent
      order by q.observe_le desc, q.id desc
    ) = 1 as dernier
  from qualifies q
),
-- `retenu` : seul relevé pris en compte pour la référence et le prix. Un relevé
-- contesté est sorti du prix courant, sans être supprimé.
retenus as (
  select a.*, (a.dernier and not a.conteste) as retenu
  from avec_dernier a
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

revoke all on public.prix_courants from anon, authenticated;
grant select on public.prix_courants to anon, authenticated;

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

-- Relevés récents d'un produit, d'un marché et d'une unité, pour l'écran de détail.
-- Publique, mais réduite à ce qui peut se voir : le nom affiché de l'auteur (jamais
-- son numéro), les compteurs, et pour le connecté sa propre réaction. Ni position ni
-- verdict de relevé aberrant.
create function public.releves_recents(p_produit_id bigint, p_unite_id bigint, p_marche_id bigint)
returns table (
  id uuid,
  prix_total numeric,
  quantite numeric,
  prix_unitaire numeric,
  observe_le timestamptz,
  auteur text,
  confirmations bigint,
  contestations bigint,
  conteste boolean,
  ma_reaction text,
  est_le_mien boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    e.id,
    e.prix_total,
    e.quantite,
    e.prix_unitaire,
    e.observe_le,
    coalesce(nullif(btrim(pr.nom_affiche), ''), 'Contributeur'),
    e.confirmations,
    e.contestations,
    e.conteste,
    (select r.type from public.reactions r
      where r.releve_id = e.id and r.contributeur_id = (select auth.uid())),
    coalesce(e.contributeur_id = (select auth.uid()), false)
  from public.releves_evalues e
  join public.profils pr on pr.id = e.contributeur_id
  where e.produit_id = p_produit_id and e.unite_id = p_unite_id and e.marche_id = p_marche_id and e.recent
  order by e.observe_le desc, e.id
  limit 50
$$;

revoke execute on function public.releves_recents(bigint, bigint, bigint) from public;
grant execute on function public.releves_recents(bigint, bigint, bigint) to anon, authenticated;
