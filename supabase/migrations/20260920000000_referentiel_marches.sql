-- Référentiel des marchés de détail : lisible par tous, modifiable par le
-- développeur seul (aucune politique d'écriture : seuls les rôles qui
-- contournent la sécurité par ligne, comme le tableau de bord, peuvent écrire).
create table public.marches (
  id bigint generated always as identity primary key,
  nom text not null unique
);

alter table public.marches enable row level security;

create policy "Les marchés sont lisibles par tous"
  on public.marches for select
  to anon, authenticated
  using (true);
