-- Mesures locales : le bol revient au catalogue, avec sa conversion.
--
-- Une mesure locale (bol) n'a pas de quantité fixe : elle n'est comparable qu'à
-- elle-même. Le prix courant reste toujours calculé dans l'unité d'origine, jamais
-- mélangé à celui d'une autre unité. Quand le développeur renseigne un facteur de
-- conversion pour un produit, le prix courant expose en plus son équivalent en
-- unité standard (affichage seulement : le prix en kg n'entre jamais dans la
-- médiane en kg). Sans facteur, rien n'est converti.

insert into public.unites (nom, symbole, type) values ('bol', 'bol', 'locale');

-- Produits vendus au bol sur les marchés de la V0. Aucune borne de plausibilité :
-- sans bornes connues pour une paire, rien n'est hors bornes (le contrôle des
-- valeurs aberrantes, lui, s'applique comme pour toute unité).
insert into public.produits_unites (produit_id, unite_id)
select p.id, u.id
from public.produits p
join public.unites u on u.symbole = 'bol'
where p.nom in ('maïs', 'riz', 'gari', 'haricot');

-- Facteur de conversion, à renseigner depuis le tableau de bord de la base (Studio) :
-- « 1 bol de maïs = 2,5 kg » s'écrit (maïs, bol, kg, 2.5). Les vrais facteurs seront
-- fournis avec les relais : aucun n'est inventé ici.
create table public.conversions_unites (
  produit_id bigint not null,
  unite_id bigint not null,
  unite_standard_id bigint not null,
  -- Quantité d'unité standard contenue dans une unité locale.
  facteur numeric not null check (facteur > 0),
  primary key (produit_id, unite_id),
  -- Le produit doit se vendre dans les deux unités.
  foreign key (produit_id, unite_id) references public.produits_unites (produit_id, unite_id),
  foreign key (produit_id, unite_standard_id) references public.produits_unites (produit_id, unite_id)
);

alter table public.conversions_unites enable row level security;
revoke all on public.conversions_unites from anon, authenticated;

-- On convertit une mesure locale vers une unité standard, jamais autrement.
create function public.verifier_conversion()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from public.unites where id = new.unite_id and type = 'locale') then
    raise exception 'Seule une mesure locale se convertit';
  end if;
  if not exists (select 1 from public.unites where id = new.unite_standard_id and type = 'standard') then
    raise exception 'On ne convertit que vers une unité standard';
  end if;
  return new;
end;
$$;

create trigger verifier_conversion_avant_ecriture
  before insert or update on public.conversions_unites
  for each row execute function public.verifier_conversion();

-- Deux colonnes en plus à la fin de prix_courants : l'équivalent en unité standard,
-- seulement quand le prix est publié et qu'un facteur est connu. Les droits de la vue
-- sont conservés (create or replace).
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
    -- Un relevé écarté (aberrant ou contesté) ne fixe pas la date de fraîcheur du prix.
    coalesce(max(observe_le) filter (where not coalesce(aberrant, false) and not conteste), max(observe_le)) as dernier_releve_le
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
  a.dernier_releve_le,
  case when a.publiable then a.mediane / c.facteur::double precision end as prix_converti,
  case when a.publiable and c.facteur is not null then us.symbole end as unite_convertie
from agregats a
join public.produits p on p.id = a.produit_id
join public.unites u on u.id = a.unite_id
join public.marches m on m.id = a.marche_id
left join public.conversions_unites c on c.produit_id = a.produit_id and c.unite_id = a.unite_id
left join public.unites us on us.id = c.unite_standard_id;
