# Les prix courants sont lus par une fonction à droits du propriétaire

Les collectes et les profils sont fermés par la sécurité par ligne, sans aucune politique : ni un lecteur anonyme ni un contributeur ne les lit directement. Le public ne lit que la fonction `prix_courants(jours)`, qui calcule la médiane sur la période demandée, applique le seuil de publication et s'exécute avec les droits de son propriétaire (`security definer`), donc en contournant cette fermeture. La collecte d'un contributeur, son numéro et son statut de relais ne sont jamais exposés ; seul le résultat calculé l'est.

Le linter de Supabase signale ce type d'objet : c'est voulu. Une lecture avec les droits de l'appelant aurait exigé une politique de lecture publique sur `collectes` et `profils`, donc exposé les collectes individuelles, leurs auteurs et le statut de relais, et déplacé le calcul de confiance vers le client, contre le principe « le serveur décide ».

C'est une fonction plutôt qu'une vue parce que la période (1 jour, 3 jours, 7 jours…) est un paramètre de l'appel ; elle est bornée de 1 à 90 jours côté serveur. Sa position de recherche est vidée (`set search_path = ''`) et tous les objets sont qualifiés, pour qu'elle ne puisse pas être détournée.

Toute nouvelle fonction qui lit ces tables au nom du public suit la même règle : droits du propriétaire, colonnes calculées uniquement, `revoke all` puis `grant execute` explicite.
