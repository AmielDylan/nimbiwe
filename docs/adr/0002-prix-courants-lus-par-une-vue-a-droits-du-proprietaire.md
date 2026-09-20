# Les prix courants sont lus par une vue à droits du propriétaire

Les collectes et les profils sont fermés par la sécurité par ligne, sans aucune politique : ni un lecteur anonyme ni un contributeur ne les lit directement. Le public ne lit que la vue `prix_courants`, qui calcule la médiane, applique le seuil de publication et s'exécute avec les droits de son propriétaire, donc en contournant cette fermeture. La collecte d'un contributeur, son numéro et son statut de relais ne sont jamais exposés ; seul le résultat calculé l'est.

Le linter de Supabase signale ce type de vue (`security_definer_view`) : c'est voulu. Une vue `security_invoker` aurait exigé une politique de lecture publique sur `collectes` et `profils`, donc exposé les collectes individuelles, leurs auteurs et le statut de relais, et déplacé le calcul de confiance vers le client, contre le principe « le serveur décide ».

Toute nouvelle vue ou fonction qui lit ces tables au nom du public suit la même règle : droits du propriétaire, colonnes calculées uniquement, `revoke all` puis `grant select` explicite.
