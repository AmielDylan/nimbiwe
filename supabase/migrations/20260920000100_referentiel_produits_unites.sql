-- Référentiel : produits, unités et unités valides par produit. Lisible par
-- tous, modifiable par le développeur seul (mêmes règles que `marches`).
create table public.unites (
  id bigint generated always as identity primary key,
  nom text not null unique,
  symbole text not null unique,
  -- 'standard' : quantité fixe (kg, litre, pièce). 'locale' : quantité variable
  -- selon le vendeur (bol, tas…). Aucune mesure locale en V0 : elles ne sont pas
  -- encore normalisées et seront ajoutées avec leurs conversions.
  type text not null check (type in ('standard', 'locale'))
);

create table public.produits (
  id bigint generated always as identity primary key,
  nom text not null unique,
  nom_fon text -- prévu, vide en V0
);

create table public.produits_unites (
  produit_id bigint not null references public.produits (id),
  unite_id bigint not null references public.unites (id),
  primary key (produit_id, unite_id)
);

alter table public.unites enable row level security;
alter table public.produits enable row level security;
alter table public.produits_unites enable row level security;

create policy "Les unités sont lisibles par tous"
  on public.unites for select to anon, authenticated using (true);
create policy "Les produits sont lisibles par tous"
  on public.produits for select to anon, authenticated using (true);
create policy "Les unités valides sont lisibles par tous"
  on public.produits_unites for select to anon, authenticated using (true);

insert into public.unites (nom, symbole, type) values
  ('kilogramme', 'kg', 'standard'),
  ('litre', 'L', 'standard'),
  ('pièce', 'pièce', 'standard');

insert into public.produits (nom) values
  ('maïs'), ('riz'), ('gari'), ('haricot'), ('igname'), ('tomate'),
  ('oignon'), ('piment'), ('huile végétale'), ('huile de palme'), ('sucre'), ('œufs');

insert into public.produits_unites (produit_id, unite_id)
select p.id, u.id
from (values
  ('maïs', 'kg'),
  ('riz', 'kg'),
  ('gari', 'kg'),
  ('haricot', 'kg'),
  ('igname', 'kg'), ('igname', 'pièce'),
  ('tomate', 'kg'),
  ('oignon', 'kg'),
  ('piment', 'kg'),
  ('huile végétale', 'L'),
  ('huile de palme', 'L'),
  ('sucre', 'kg'),
  ('œufs', 'pièce')
) as valides (produit, unite)
join public.produits p on p.nom = valides.produit
join public.unites u on u.symbole = valides.unite;

-- Marchés de détail de la V0. « Dantokpa » tient lieu de marché provisoire pour
-- Cotonou : il sera remplacé par le marché de détail choisi après une visite sur
-- place (Dantokpa a fermé définitivement le 2 mai 2026).
insert into public.marches (nom) values
  ('Ganhi'), ('Ouando'), ('Bohicon'), ('Dantokpa');
