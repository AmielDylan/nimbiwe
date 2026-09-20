# Nimbiwe

Suivi collaboratif des prix des denrées de base sur les marchés du Bénin. *Nimbiwe* signifie « c'est combien ? » en fon. Les utilisateurs collectent des prix, la communauté les confirme ou les conteste.

## Language

### Prix

**Collecte**:
Un prix saisi par un utilisateur pour un produit, sur un marché, dans une unité donnée. Le verbe est *collecter* un prix.
_Avoid_: Signalement, signaler (évoquent une alerte ou un bug), relevé, contribution, entrée, report

**Prix courant**:
La médiane des collectes récentes d'un même produit, sur un même marché, dans une même unité. La période « récente » est de 7 jours par défaut ; le lecteur peut la resserrer (1 jour, 3 jours…) ou l'élargir.
_Avoid_: Prix du jour, prix moyen, cours

**Bornes plausibles**:
La fourchette de prix jugée réaliste pour un produit dans une unité. Une collecte hors bornes est soumise à l'utilisateur pour confirmation, jamais refusée.
_Avoid_: Plafond, limites

### Produits et unités

**Produit**:
Une denrée de base suivie par l'application (maïs, riz, gari, tomate…).
_Avoid_: Article, marchandise

**Unité**:
La quantité à laquelle un prix se rapporte. Obligatoire pour toute collecte : un prix sans unité n'a pas de sens.
_Avoid_: Mesure, format, conditionnement

**Unité standard**:
Une unité dont la quantité ne varie pas d'un vendeur à l'autre (kilogramme, litre, pièce).
_Avoid_: Unité officielle

**Mesure locale**:
Une unité d'usage courant au marché dont la quantité varie selon le vendeur (bol, tas, cuvette). Ne devient comparable qu'une fois convertie en unité standard avec les relais.
_Avoid_: Unité traditionnelle

### Lieux

**Marché**:
Un marché de détail, lieu physique où l'acheteur achète et où les prix sont collectés (Ganhi, Ouando, Bohicon…).
_Avoid_: Point de vente, boutique

**Marché de gros**:
Un marché réservé aux grossistes (par exemple Tokpa Daho à Akassato). Ses prix ne sont pas ceux payés par l'acheteur ; hors périmètre de la V0.
_Avoid_: Marché (sans précision)

### Personnes

**Relais**:
Une personne locale de confiance, rattachée à un marché, dont les collectes servent d'ancre pour juger les autres et dont le poids est plus fort dans le prix courant.
_Avoid_: Enquêteur, agent, modérateur

**Contributeur**:
Tout utilisateur connecté qui collecte un prix. Un relais est un contributeur de confiance.
_Avoid_: Utilisateur (trop large : il inclut les simples lecteurs), membre

**Confirmation**:
La réaction d'un utilisateur qui valide la collecte d'un autre.
_Avoid_: Vote positif, like

**Contestation**:
La réaction d'un utilisateur qui remet en cause la collecte d'un autre.
_Avoid_: Vote négatif, dislike, signalement d'abus
