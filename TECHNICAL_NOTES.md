# Tracker Competitif Gentle Mates - Notes Techniques

## Système de Récupération des Tournois

Le système repose sur une logique de filtrage stricte pour garantir que seuls les tournois pertinents pour l'équipe (EU, FNCS, Victory Cups) s'affichent.

### 1. Filtrage des Événements (`isRelevantTournament`)
Seuls les événements répondant à ces critères sont affichés :
- **Région** : Europe (`_EU`) uniquement.
- **Type** : `FNCS`, `VictoryCup`, `CashCup`, `SoloSeries`, `EliteSeries`.
- **Exclusion** : Mobile, Ranked, PlayStation, Console Cups, et tout mode "troll" ou mineur.

### 2. Nomenclature (`formatEventName`)
Les noms bruts de l'API sont nettoyés pour être lisibles :
- **FNCS** : Affiche la division (ex: "FNCS Div 1").
- **Détails** : Affiche le round, la semaine (W1, W2...), et la session (Day 1, Day 2, Finals).
- **Exemple** : `FNCS Div 1 W1 Day 2` indique clairement le jour 2 de la semaine 1.

### 3. Recherche de Joueurs (`getTournamentRankings`)
- **Profondeur** : Le système scanne les **500 premiers joueurs** (5 pages de classement) pour s'assurer de trouver les joueurs M8 même en cas de mauvaise performance.
- **Identification** : La recherche se fait par `accountId` (source de vérité) ET par recherche partielle de nom (ex: "M8 Merstach" matche "Merstach"), permettant de gérer les changements de pseudos.
- **Roster** : Défini dans `src/config/roster.ts` avec les IDs Epic Games officiels.

### 4. Sécurité
- Les appels API se font coté serveur (`use server`) pour protéger la clé API `FORTNITE_API_KEY`.
- En cas d'erreur API, le système renvoie un tableau vide plutôt que de crasher.

---
**Dernière mise à jour stable** : 17 Février 2026
**Version** : 1.2 "Secured Base"
