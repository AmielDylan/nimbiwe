-- Connexion par téléphone : un profil est créé à la première connexion, et un
-- contributeur ne peut lire et modifier que son propre profil, seulement son nom
-- affiché. Le numéro reste dans `auth.users`, jamais exposé par l'API ; le statut
-- de relais ne change que depuis le tableau de bord de la base.

alter table public.profils
  add constraint profils_nom_affiche_valide
  check (nom_affiche is null or char_length(btrim(nom_affiche)) between 1 and 40);

create function public.creer_profil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profils (id) values (new.id);
  return new;
end;
$$;

create trigger creer_profil_a_la_creation_du_compte
  after insert on auth.users
  for each row execute function public.creer_profil();

-- Comptes existants (aucun en production à ce stade, mais la migration reste rejouable).
insert into public.profils (id)
select id from auth.users
on conflict (id) do nothing;

revoke all on public.profils from anon, authenticated;
grant select on public.profils to authenticated;
grant update (nom_affiche) on public.profils to authenticated;

create policy "Un contributeur lit son profil"
  on public.profils for select
  to authenticated
  using (id = (select auth.uid()));

create policy "Un contributeur modifie son nom affiché"
  on public.profils for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
