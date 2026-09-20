# Les prix courants sont lus par une vue à droits du propriétaire

Les relevés sont fermés par la sécurité par ligne, sans aucune politique, et les profils ne s'ouvrent qu'à leur propriétaire (il lit son profil et ne modifie que son nom affiché) : ni un lecteur anonyme ni un contributeur ne lit directement les relevés des autres ni les profils des autres. Le public ne lit que la vue `prix_courants`, qui calcule la médiane, applique le seuil de publication et s'exécute avec les droits de son propriétaire, donc en contournant cette fermeture. Le relevé d'un contributeur, son numéro et son statut de relais ne sont jamais exposés ; seul le résultat calculé l'est.

Le linter de Supabase signale ce type de vue (`security_definer_view`) : c'est voulu. Une vue `security_invoker` aurait exigé une politique de lecture publique sur `releves` et `profils`, donc exposé les relevés individuels, leurs auteurs et le statut de relais, et déplacé le calcul de confiance vers le client, contre le principe « le serveur décide ».

Toute nouvelle vue ou fonction qui lit ces tables au nom du public suit la même règle : droits du propriétaire, colonnes calculées uniquement, `revoke all` puis `grant select` explicite.
