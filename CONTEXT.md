# Nimbiwe

Suivi collaboratif des prix des denrées de base sur les marchés du Bénin. *Nimbiwe* signifie « c'est combien ? » en fon. Les utilisateurs relèvent des prix, la communauté les confirme ou les conteste.

## Language

### Prix

**Relevé**:
Un prix saisi par un utilisateur pour un produit, sur un marché, dans une unité donnée. Le verbe est *relever* un prix.
_Avoid_: Signalement, signaler (évoquent une alerte ou un bug), collecte, collecter (ambigus avec la collecte de données personnelles), contribution, entrée, report

**Prix courant**:
La médiane pondérée des relevés des 7 derniers jours d'un même produit, sur un même marché, dans une même unité. Chaque relevé compte selon son **poids** ; à poids égaux, c'est la médiane ordinaire.
_Avoid_: Prix du jour, prix moyen, cours

**Poids**:
L'importance d'un relevé dans le prix courant. Un relevé pèse 1 quand sa **position** est vérifiée, moins sinon (0,5 par défaut) ; le relevé d'un **relais** sur son marché pèse en plus 3 fois davantage (facteur réglable).
_Avoid_: Note, score, fiabilité

**Position**:
Les coordonnées que le contributeur joint, s'il le souhaite, à un relevé. Elle n'est jamais montrée : ni aux autres, ni à son auteur. Le serveur en déduit la distance au marché et ne la retient que si elle est plausible. Refuser de la partager ne bloque jamais un relevé.
_Avoid_: Localisation, GPS, géolocalisation

**Bornes plausibles**:
La fourchette de prix jugée réaliste pour un produit dans une unité. Un relevé hors bornes est soumis à l'utilisateur pour confirmation, jamais refusé.
_Avoid_: Plafond, limites

### Produits et unités

**Produit**:
Une denrée de base suivie par l'application (maïs, riz, gari, tomate…).
_Avoid_: Article, marchandise

**Unité**:
La quantité à laquelle un prix se rapporte. Obligatoire pour tout relevé : un prix sans unité n'a pas de sens.
_Avoid_: Mesure, format, conditionnement

**Unité standard**:
Une unité dont la quantité ne varie pas d'un vendeur à l'autre (kilogramme, litre, pièce).
_Avoid_: Unité officielle

**Mesure locale**:
Une unité d'usage courant au marché dont la quantité varie selon le vendeur (bol, tas, cuvette). Ne devient comparable qu'une fois convertie en unité standard avec les relais.
_Avoid_: Unité traditionnelle

### Lieux

**Marché**:
Un marché de détail, lieu physique où l'acheteur achète et où les prix sont relevés (Ganhi, Ouando, Bohicon…).
_Avoid_: Point de vente, boutique

**Marché de gros**:
Un marché réservé aux grossistes (par exemple Tokpa Daho à Akassato). Ses prix ne sont pas ceux payés par l'acheteur ; hors périmètre de la V0.
_Avoid_: Marché (sans précision)

### Personnes

**Relais**:
Une personne locale de confiance, rattachée à un marché, dont les relevés servent d'ancre pour juger les autres et dont le poids est plus fort dans le prix courant. Elle ancre son marché seulement : ailleurs, elle compte comme un contributeur ordinaire. Elle est désignée à la main depuis le tableau de bord et se connecte comme tout contributeur.
_Avoid_: Enquêteur, agent, modérateur

**Contributeur**:
Tout utilisateur connecté qui relève un prix. Un relais est un contributeur de confiance.
_Avoid_: Utilisateur (trop large : il inclut les simples lecteurs), membre

**Confirmation**:
La réaction d'un utilisateur qui valide le relevé d'un autre.
_Avoid_: Vote positif, like

**Contestation**:
La réaction d'un utilisateur qui remet en cause le relevé d'un autre.
_Avoid_: Vote négatif, dislike, signalement d'abus
