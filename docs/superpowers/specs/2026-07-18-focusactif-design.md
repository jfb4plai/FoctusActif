# FocusActif — design

**Statut** : validé en brainstorming le 2026-07-18, prêt pour plan d'implémentation.

## Contexte et objectif

Aucun outil PLAI ne couvre aujourd'hui l'auto-organisation exécutive au quotidien
(RituActif structure des routines/CAA construites par l'enseignant ; PlanBot est
un jeu ; UtilActif est une boîte à outils de gestion de classe). FocusActif comble
ce vide, inspiré du mécanisme d'ilseon (app Android tierce, cf. analyse RISS/GitHub
du 2026-07-18) : filtrage par contexte, une seule tâche affichée à la fois,
décomposition en sous-étapes, capture rapide.

**Ancrage RISS** (validé précédemment, à ne pas re-vérifier) :
- `dumas-01302572` (Minary, 2010) — remédiation cognitive des fonctions exécutives
  chez l'enfant TDAH, protocole **informatisé**, étude contrôlée. Référence directe
  pour un outil numérique de ce type.
- `hal-04457967` — programmes structurés CRT/RECOS/RC2S pour flexibilité/
  planification/organisation en autisme.

Nuance à conserver dans toute documentation publiée : ces références valident le
terrain (FE déficitaires en TDAH/TSA, bénéfice d'un support numérique
structurant), pas l'outil FocusActif lui-même (aucune étude propre).

## Public cible

Double public, un seul outil à deux modes de configuration :
1. **Secondaire autonome** (TDAH/TSA léger) — gère seul l'outil.
2. **Tous niveaux, médiation enseignante** — l'enseignant configure/verrouille
   pour un élève moins autonome.

Pas de troisième mode "enseignant organise sa propre charge" (écarté).

## Stack

Webapp React/Vite/Tailwind (gabarit PLAI standard) + Supabase, PWA installable
(manifest + service worker). Cohérent avec RituActif/UtilActif/etc.

## Architecture

```
UI (React) : ContextPicker → TaskDashboard → TaskDetail/DecomposeSheet
        │ appelle uniquement
TaskStore (interface) : listContexts() / addTask() / decompose() /
                         completeTask() / getNextTask()
        │                              │
   LocalStore (IndexedDB)        SupabaseStore (focus_* tables + RLS)
```

- Écran d'accueil `StorageSetup` (calqué sur `ClassSetup` d'UtilActif) : choix
  explicite "Continuer sans compte" (mode local) vs "Créer un compte / Se
  connecter" (mode compte Supabase, synchronisé). Le choix fixe quelle
  implémentation de `TaskStore` est injectée pour la session ; l'UI ne sait
  jamais laquelle elle utilise.
- **Verrouillage** : porté par le contexte (`locked: boolean`), pas par tâche
  individuelle. Contexte verrouillé = l'élève exécute mais ne peut ni ajouter
  ni supprimer de tâches dedans ; seul l'enseignant qui gère le lien peut
  modifier. Un même compte élève peut avoir des contextes verrouillés et des
  contextes libres en parallèle.
- Mode local : par nature, pas de configuration enseignant à distance
  possible (les données ne quittent pas l'appareil) — à annoncer explicitement
  à l'écran `StorageSetup`, pas une limitation cachée.

## Modèle de données (mode compte — Supabase)

```
focus_contexts
  id, owner_id (auth.uid()), label, emoji, locked (bool),
  locked_by (teacher_id, nullable), created_at

focus_tasks
  id, context_id, owner_id, title, status (todo|done),
  parent_task_id (nullable → sous-étape), step_order, created_at, done_at

focus_reminders   -- mode compte uniquement (push réel)
  id, task_id, owner_id, remind_at, sent (bool)

focus_links
  id, teacher_id, student_id (nullable), invite_code,
  initiated_by ('teacher'|'student'), status ('pending'|'linked'),
  created_at, linked_at
```

- **Une tâche = une entité**, racine ou sous-étape (`parent_task_id`), cohérent
  avec le principe mono-exercice déjà appliqué (mathipulatifs-plai). Un seul
  niveau de décomposition autorisé côté UI (pas de sous-sous-étape), pour
  préserver l'affichage "une chose à la fois".
- `getNextTask(contextId)` = première tâche `todo` sans sous-étape `todo` en
  attente, triée par `step_order`/`created_at`. Si une tâche a des sous-étapes
  non terminées, on affiche la première sous-étape, jamais la tâche parente.
- Mode local (IndexedDB) : même forme de données, sans `owner_id`/RLS/
  `focus_links`, pour permettre un mapping 1:1 si un export/import
  local→compte est ajouté plus tard (hors MVP).
- Préfixe `focus_` à vérifier contre les tables existantes du projet Supabase
  partagé avant toute création (`grep -r "create table"` sur les autres apps),
  règle absolue de nommage.

## Liaison enseignant/élève (`focus_links`)

Un seul mécanisme bidirectionnel, un seul composant `LinkByCode` réutilisé
dans les deux sens :
- **Élève autonome** : génère son code depuis ses réglages, le transmet à
  l'enseignant → l'enseignant le saisit dans `TeacherRoster` → lien immédiat.
- **Élève peu autonome** : l'enseignant génère un code (`student_id` encore
  vide) → transmis à l'élève/parent → saisi à la première connexion de
  l'élève → le lien se complète.

Une fois lié, l'enseignant peut créer/verrouiller des contextes pour cet
élève. L'élève peut ignorer un code reçu (pas de lien forcé) et consulter/
révoquer ses liens actifs depuis ses réglages (cohérent avec le consentement
RGPD-lite déjà appliqué sur RituActif/Communication expressive).

## Périmètre MVP

Inclus :
- Filtrage par contexte
- Affichage d'une seule tâche prioritaire
- Décomposition en sous-étapes (un niveau)
- Capture rapide (texte + dictée Web Speech API en secours — pas
  d'intégration avec VolubilActif, qui est un outil desktop externe séparé,
  pas une librairie intégrable)
- Notifications douces dès la v1 (voir ci-dessous, dégradées en mode local)
- Choix mode local / mode compte dès l'écran d'accueil
- Liaison enseignant/élève par code (bidirectionnelle)

Hors MVP (v2 explicitement reportée) :
- Export/import de données entre mode local et mode compte
- Sous-décomposition à plus d'un niveau
- Suivi de progression / séries de constance (present dans ilseon, pas
  demandé ici)

## Notifications

- **Mode compte** : push réel (Web Push API, clés VAPID), déclenché par une
  edge function Supabase planifiée (`pg_cron`) parcourant `focus_reminders`
  où `remind_at <= now() AND sent = false`. Dégradation silencieuse vers
  rappel in-app si la permission navigateur est refusée.
- **Mode local** : pas de vrai arrière-plan possible (pas de serveur) →
  rappel affiché uniquement quand l'app est ouverte. Limitation à afficher
  explicitement à l'écran `StorageSetup`.
- Vibration + indicateur visuel discret dans les deux modes, jamais de son
  (principe ilseon, respect de l'hypersensibilité sensorielle).
- Rappel optionnel par tâche/sous-étape, jamais forcé.

## Gestion d'erreurs

- Mode compte hors-ligne : queue locale des actions (cocher, ajouter),
  rejouée à la reconnexion — pas de blocage.
- Conflit de synchronisation : dernier écrit gagne au niveau tâche/contexte
  (pas de fusion fine).
- Code d'invitation invalide/expiré : message générique côté élève (pas de
  distinction "inconnu" vs "déjà utilisé", pour éviter l'énumération),
  détail loggé côté serveur.
- `QuickCapture` : bouton désactivé si champ vide (pas de tâche fantôme) ;
  micro refusé → repli silencieux sur texte, pas de message intrusif.

## Tests

- Suite de tests partagée pour `TaskStore`, exécutée contre `LocalStore` et
  `SupabaseStore` (même comportement garanti par un seul jeu de tests).
- `getNextTask` : contexte vide, sous-étapes partiellement terminées,
  plusieurs tâches racines (ordre stable), contexte verrouillé (élève ne peut
  pas agir).
- `LinkByCode` : les deux sens de génération/saisie, code expiré, code déjà
  consommé.
- Smoke test manuel : parcours élève autonome complet (créer contexte →
  capturer → décomposer → terminer) + parcours élève lié (enseignant crée le
  lien, verrouille un contexte, élève exécute sans pouvoir modifier).

## Questions résolues pendant le brainstorming (traçabilité)

- Public cible : les deux (autonome + médiation), un seul outil.
- Cohabitation des deux modes : configuration, pas deux parcours séparés.
- Plateforme : webapp standard PLAI, pas de natif.
- Capture vocale : Web Speech API intégrée, décision explicite malgré la
  disponibilité de VolubilActif (jugé non pertinent car outil desktop externe,
  pas intégrable).
- Auth : choix explicite compte/local à l'écran d'accueil, les deux
  coexistent (pas de valeur par défaut imposée).
- Stockage : adaptateur à deux moteurs (option A), pas de compte anonyme
  Supabase pour le mode local (rejeté : contredit la promesse de
  confidentialité "données sur l'appareil").
- Lien enseignant/élève : bidirectionnel par code, pas de création directe de
  compte par l'enseignant seule (aurait cassé l'autonomie pour le public
  secondaire), ni de génération unilatérale côté élève seul (aurait exclu le
  public moins autonome).
