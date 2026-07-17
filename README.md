# Administration de New Hanover

Plateforme interne de l'administration de New Hanover : décrets, communiqués,
agenda, comptabilité et gestion des accès, avec connexion obligatoire via
Discord. Thème visuel "1892" (bois sombre, cuir, papier ancien, dorures).

## Stack

- **Frontend** : HTML/CSS/JS vanilla, aucune étape de build.
- **Backend** : [Cloudflare Pages Functions](https://developers.cloudflare.com/pages/functions/) (`/functions`).
- **Base de données** : [Cloudflare D1](https://developers.cloudflare.com/d1/) (SQLite serverless).
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

## Mise en place

### 1. Créer l'application Discord

1. Ouvrir le [portail développeurs Discord](https://discord.com/developers/applications) et créer une application.
2. Dans **OAuth2 → General**, noter le **Client ID** et générer un **Client Secret**.
3. Ajouter une **Redirect URL** : `https://<votre-domaine-pages>/api/auth/callback`
   (et une seconde en local si besoin, ex. `http://localhost:8788/api/auth/callback`).

### 2. Créer la base D1

```bash
npx wrangler d1 create new-hanover-admin-db
```

Copier l'`database_id` retourné dans `wrangler.toml` (champ `database_id`).

Appliquer le schéma :

```bash
npx wrangler d1 execute new-hanover-admin-db --remote --file=./schema.sql
```

(Utiliser `--local` pour un test en développement local.)

### 3. Variables d'environnement / secrets

À configurer dans **Cloudflare Pages → Settings → Environment variables**
(ou via `wrangler pages secret put` pour les secrets) :

| Variable | Description |
|---|---|
| `DISCORD_CLIENT_ID` | Client ID de l'application Discord |
| `DISCORD_CLIENT_SECRET` | Client Secret (secret) |
| `DISCORD_REDIRECT_URI` | URL de callback exacte, ex. `https://admin.example.com/api/auth/callback` |
| `BOOTSTRAP_DISCORD_IDS` | Un ou plusieurs identifiants Discord (séparés par des virgules) qui seront automatiquement acceptés avec le rôle **Administrateur principal** lors de leur toute première connexion — nécessaire pour valider les comptes suivants. |

### 4. Déploiement sur Cloudflare Pages

```bash
npm install -g wrangler   # si nécessaire
npx wrangler pages deploy public --project-name=new-hanover-admin
```

Le dossier `functions/` est détecté automatiquement par Cloudflare Pages.
Penser à lier la base D1 au projet Pages (Settings → Functions → D1 database
bindings → binding `DB` → `new-hanover-admin-db`), en plus de la déclaration
dans `wrangler.toml`.

### 5. Première connexion

1. Configurer `BOOTSTRAP_DISCORD_IDS` avec votre propre identifiant Discord.
2. Se connecter sur le site avec Discord : le compte est automatiquement
   accepté avec le rôle Administrateur principal.
3. Retirer votre ID de `BOOTSTRAP_DISCORD_IDS` une fois les autres comptes
   administrateurs mis en place (optionnel, cette variable ne sert qu'à la
   création des tout premiers comptes).
4. Les connexions suivantes créent des demandes d'accès en attente, à valider
   depuis **Administration du site → Demandes d'accès**.

## Développement local

```bash
npx wrangler pages dev public --d1=DB=new-hanover-admin-db --local
```

## Confidentialité

Le formulaire de connexion Discord ne demande que le scope `identify`. Le
code de callback (`functions/api/auth/callback.js`) n'extrait que `id` et
`username` de la réponse Discord ; aucune autre donnée n'est conservée en
base.
