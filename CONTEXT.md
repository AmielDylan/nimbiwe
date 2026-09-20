# Nimbiwe

Suivi collaboratif des prix des denrées de base sur les marchés du Bénin. *Nimbiwe* signifie « c'est combien ? » en fon. Les utilisateurs signalent des prix, la communauté les confirme ou les conteste.

## Language

### Prix

**Signalement**:
Un prix saisi par un utilisateur pour un produit, sur un marché, dans une unité donnée.
_Avoid_: Relevé, contribution, entrée, report

**Prix courant**:
La médiane des signalements récents d'un même produit, sur un même marché, dans une même unité.
_Avoid_: Prix du jour, prix moyen, cours

**Bornes plausibles**:
La fourchette de prix jugée réaliste pour un produit dans une unité. Un signalement hors bornes est signalé à l'utilisateur pour confirmation, jamais refusé.
_Avoid_: Plafond, limites

### Produits et unités

**Produit**:
Une denrée de base suivie par l'application (maïs, riz, gari, tomate…).
_Avoid_: Article, marchandise

**Unité**:
La quantité à laquelle un prix se rapporte. Obligatoire pour tout signalement : un prix sans unité n'a pas de sens.
_Avoid_: Mesure, format, conditionnement

**Unité standard**:
Une unité dont la quantité ne varie pas d'un vendeur à l'autre (kilogramme, litre, pièce).
_Avoid_: Unité officielle

**Mesure locale**:
Une unité d'usage courant au marché dont la quantité varie selon le vendeur (bol, tas, cuvette). Ne devient comparable qu'une fois convertie en unité standard avec les relais.
_Avoid_: Unité traditionnelle

### Lieux

**Marché**:
Un lieu physique où les prix sont relevés (Dantokpa, Ganhi, Bohicon, Ouando).
_Avoid_: Point de vente, boutique

### Personnes

**Relais**:
Une personne locale de confiance, rattachée à un marché, dont les signalements servent d'ancre pour juger les autres et dont le poids est plus fort dans le prix courant.
_Avoid_: Enquêteur, agent, modérateur

**Contributeur**:
Tout utilisateur connecté qui signale un prix. Un relais est un contributeur de confiance.
_Avoid_: Utilisateur (trop large : il inclut les simples lecteurs), membre

**Confirmation**:
La réaction d'un utilisateur qui valide le signalement d'un autre.
_Avoid_: Vote positif, like

**Contestation**:
La réaction d'un utilisateur qui remet en cause le signalement d'un autre.
_Avoid_: Vote négatif, dislike, signalement d'abus
