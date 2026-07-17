# Administration de New Hanover

Plateforme interne de l'administration de New Hanover : décrets, communiqués,
agenda, comptabilité et gestion des accès, avec connexion obligatoire via
Discord. Thème visuel "1892" (bois sombre, cuir, papier ancien, dorures).

## Stack

- **Frontend** : HTML/CSS/JS vanilla, aucune étape de build, servi depuis la racine du projet.
- **Backend** : [Vercel Functions](https://vercel.com/docs/functions) (dossier `/api`, runtime Node.js).
- **Base de données** : [Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres) (se crée en 2 clics depuis le dashboard, sans compte externe).
- **Authentification** : OAuth2 Discord (scope `identify` uniquement). Seuls
  l'identifiant Discord et le pseudo Discord sont enregistrés — aucune autre
  donnée du compte Discord (avatar, e-mail...) n'est lue ni stockée.

## Modules livrés dans cette version

Squelette complet (navigation, thème, structure de pages) pour l'ensemble des
19 sections du cahier des charges, avec logique métier et CRUD complets pour :

- Authentification Discord + demandes d'accès + statuts de compte
- Rôles et permissions (8 rôles par défaut, matrice de permissions modifiable)
- Tableau de bord
- Décrets (numérotation `DEC-NH-1892-XXX`, workflow complet, version imprimable)
- Communiqués (numérotation `COM-NH-1892-XXX`, workflow complet)
- Agenda administratif (vues jour / semaine / mois)
- Comptabilité (numérotation `TR-NH-1892-XXX`, validation, export CSV)
- Journal d'activité (lecture admin uniquement)
- Recherche générale

Les modules Entreprises, Employés, Tâches, Courriers, Registre des armes,
Registre des chevaux, Inventaire, Événements, Archives, Paramètres et
Sauvegardes sont présents dans la navigation avec une page "module à venir"
détaillant les champs prévus, prêts à être développés selon le même schéma.

## Mise en place (Vercel)

### 1. Importer le projet sur Vercel

Sur [vercel.com/new](https://vercel.com/new), importez le dépôt GitHub
`amarograph/new-hanover-admin`. Aucune configuration de build n'est
nécessaire (pas de "Build Command", pas de "Output Directory" à changer) :
Vercel détecte automatiquement les fichiers statiques à la racine et les
fonctions dans `/api`.

### 2. Créer la base de données

Dans le projet Vercel → onglet **Storage** → **Create Database** → **Postgres**.
Une fois créée, cliquez sur **Connect Project** pour la lier au projet : les
variables `POSTGRES_URL` (et apparentées) sont alors injectées automatiquement,
aucune saisie manuelle requise.

### 3. Appliquer le schéma

Depuis l'onglet **Storage → votre base → .env.local**, copiez la valeur de
`POSTGRES_URL`, puis en local :

```bash
psql "<valeur de POSTGRES_URL>" -f ./schema.sql
```

(Ou utilisez l'onglet **Query** du dashboard Vercel Postgres et collez le
contenu de `schema.sql` directement.)

### 4. Application Discord

1. Ouvrir le [portail développeurs Discord](https://discord.com/developers/applications) et créer une application.
2. Dans **OAuth2 → General**, noter le **Client ID** et générer un **Client Secret**.
3. Ajouter une **Redirect URL** : `https://<votre-projet>.vercel.app/api/auth/callback`.

### 5. Variables d'environnement

Dans le projet Vercel → **Settings → Environment Variables**, ajoutez :

| Variable | Description |
|---|---|
| `DISCORD_CLIENT_ID` | Client ID de l'application Discord |
| `DISCORD_CLIENT_SECRET` | Client Secret (cocher "Sensitive") |
| `DISCORD_REDIRECT_URI` | URL de callback exacte, ex. `https://admin.example.com/api/auth/callback` |
| `BOOTSTRAP_DISCORD_IDS` | Un ou plusieurs identifiants Discord (séparés par des virgules) qui seront automatiquement acceptés avec le rôle **Administrateur principal** lors de leur toute première connexion — nécessaire pour valider les comptes suivants. |

`POSTGRES_URL` est déjà présente automatiquement (étape 2).

### 6. Déployer

Un simple `git push` sur la branche principale déclenche un déploiement
automatique (Vercel est connecté au dépôt GitHub). Après avoir ajouté les
variables d'environnement, redéployez une fois (bouton **Redeploy** dans
l'onglet Deployments) pour qu'elles soient prises en compte.

### 7. Première connexion

1. Assurez-vous que `BOOTSTRAP_DISCORD_IDS` contient votre identifiant Discord.
2. Connectez-vous sur le site avec Discord : votre compte est automatiquement
   accepté avec le rôle Administrateur principal.
3. Les connexions suivantes créent des demandes d'accès en attente, à valider
   depuis **Administration du site → Demandes d'accès**.

## Développement local

```bash
npm install
cp .env.example .env.local   # renseigner POSTGRES_URL, DISCORD_*, BOOTSTRAP_DISCORD_IDS
npx vercel dev
```

`vercel dev` sert les fichiers statiques et les fonctions `/api` en local sur
`http://localhost:3000`.

## Confidentialité

Le formulaire de connexion Discord ne demande que le scope `identify`. Le
code de callback (`api/auth/callback.js`) n'extrait que `id` et `username`
de la réponse Discord ; aucune autre donnée n'est conservée en base.
