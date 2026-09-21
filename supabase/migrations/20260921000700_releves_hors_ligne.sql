-- Saisie hors ligne : un relevé saisi sans réseau est envoyé plus tard, éventuellement
-- plusieurs fois (coupure en cours d'envoi, réponse perdue). Il ne doit jamais être
-- dupliqué.
--
-- Le téléphone fixe l'identifiant du relevé à la saisie (un UUID) et le renvoie tel
-- quel à chaque tentative : la clé primaire fait le reste. Le client peut donc écrire
-- `id`, et rien d'autre de nouveau ; l'auteur, la date d'enregistrement et tous les
-- garde-fous restent décidés ici. La date d'observation (déjà écrivable) est celle de la
-- saisie ; elle reste soumise à la fenêtre de 7 jours (NB004).
grant insert (id) on public.releves to authenticated;

-- Un renvoi d'un relevé déjà enregistré doit être reconnu comme tel (23505, doublon), et
-- non refusé pour une autre raison : les garde-fous comptent le relevé déjà enregistré
-- (limite du jour atteinte par lui-même), ou ont changé depuis (compte bloqué, date
-- devenue trop ancienne). Ce déclencheur passe avant les autres (ordre alphabétique).
-- Sans `security definer` : il ne voit que les relevés de l'appelant, ce qui suffit ;
-- l'identifiant d'un autre contributeur est refusé par la clé primaire.
create function public.ecarter_releve_deja_recu()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (select 1 from public.releves where id = new.id) then
    raise exception 'Ce relevé a déjà été reçu' using errcode = '23505';
  end if;
  return new;
end;
$$;

revoke execute on function public.ecarter_releve_deja_recu() from public, anon, authenticated;

create trigger ecarter_releve_deja_recu_avant_insertion
  before insert on public.releves
  for each row execute function public.ecarter_releve_deja_recu();
