# CapWorks Studio Worker — Secrets & Configuration

## 1. Creer le namespace KV

```bash
# Dans le dossier worker/
npx wrangler kv namespace create CW_KV
```

La commande retourne un ID (ex: `abcd1234...`).
Copie cet ID dans `wrangler.toml` a la place de `REPLACE_WITH_YOUR_KV_NAMESPACE_ID`.

---

## 2. Secrets a configurer

Chaque secret se configure avec la commande :
```bash
npx wrangler secret put NOM_DU_SECRET
```
Wrangler te demandera de coller la valeur.

---

### `ADMIN_PASSWORD`

**Description :** Mot de passe pour acceder au panneau d'administration du site.
C'est le mot de passe que tu tapes quand tu cliques sur "Admin" sur le site.

**Comment le definir :**
```bash
npx wrangler secret put ADMIN_PASSWORD
# Colle ton mot de passe (ex: MonSuperMotDePasse123!)
```

**Conseil :** Choisis un mot de passe fort (min 8 caracteres, avec majuscules, chiffres, caracteres speciaux).

---

### `JWT_SECRET`

**Description :** Cle secrete pour signer les tokens d'authentification des utilisateurs.
Chaque utilisateur qui se connecte recoit un token signe avec cette cle.
Ne le partage jamais.

**Comment le generer :**
```bash
# Genere une cle aleatoire de 64 caracteres
openssl rand -hex 32
# Resultat : quelque chose comme a3f8b2c9d1e4f5a6b7c8d9e0f1a2b3c4...

npx wrangler secret put JWT_SECRET
# Colle la cle generee
```

**Conseil :** Utilise au moins 32 caracteres hexadecimaux (64 bits). Ne reutilise pas un mot de passe existant.

---

### `DISCORD_WEBHOOK_URL`

**Description :** URL du webhook Discord pour recevoir les notifications (commandes, inscriptions, messages de contact, support).
Les notifications arrivent automatiquement dans le salon Discord que tu choisis.

**Comment le creer :**
1. Ouvre Discord
2. Va dans le salon ou tu veux recevoir les notifications
3. Clic droit sur le salon > **Modifier le salon** > **Integrations** > **Webhooks**
4. Clique **Nouveau webhook**
5. Donne-lui un nom (ex: "CapWorks Notifs")
6. Clique **Copier l'URL du webhook**
7. Configure-le :

```bash
npx wrangler secret put DISCORD_WEBHOOK_URL
# Colle l'URL (ex: https://discord.com/api/webhooks/1234567890/abcdef...)
```

---

### `RESEND_API_KEY`

**Description :** Cle API du service [Resend](https://resend.com) pour envoyer les emails de verification OTP (code a 6 chiffres envoye par email lors de l'inscription ou du changement d'email).

**Comment l'obtenir :**
1. Va sur [resend.com](https://resend.com) et cree un compte (gratuit, 100 emails/jour)
2. Va dans **API Keys** > **Create API Key**
3. Donne-lui un nom (ex: "CapWorks Studio")
4. Copie la cle (commence par `re_...`)

```bash
npx wrangler secret put RESEND_API_KEY
# Colle la cle (ex: re_abc123...)
```

**Note :** Si tu ne configures pas cette cle, les codes OTP seront affiches dans les logs du Worker (`wrangler tail`) au lieu d'etre envoyes par email. Utile pour tester.

---

### `FROM_EMAIL`

**Description :** Adresse email d'expedition pour les emails OTP.
Format : `Nom <email@domaine.com>`

**Comment le configurer :**
```bash
npx wrangler secret put FROM_EMAIL
# Ex: CapWorks Studio <noreply@capworks.studio>
```

**Important :** Pour utiliser un domaine custom (ex: `@capworks.studio`), tu dois :
1. Ajouter et verifier le domaine dans Resend (Settings > Domains)
2. Ajouter les enregistrements DNS (SPF, DKIM) que Resend te donne

**Alternative gratuite :** Tu peux utiliser l'email `onboarding@resend.dev` fourni par Resend pour tester sans configurer de domaine.

---

## 3. Variable d'environnement (non-secrete)

### `ALLOWED_ORIGIN`

**Description :** L'origine (URL) de ton frontend, pour la securite CORS.
Deja configure dans `wrangler.toml`.

**Valeur par defaut :** `https://capky.github.io`

**Si tu changes l'URL de ton site :** modifie la valeur dans `wrangler.toml` :
```toml
[vars]
ALLOWED_ORIGIN = "https://ton-domaine.com"
```

---

## 4. Deploiement

```bash
cd worker/

# Installer les dependances
npm install

# Deployer le worker
npm run deploy

# Verifier les logs en temps reel
npx wrangler tail
```

---

## Resume rapide

| Secret               | Obligatoire | Description                        |
|----------------------|:-----------:|------------------------------------|
| `ADMIN_PASSWORD`     | Oui         | Mot de passe admin                 |
| `JWT_SECRET`         | Oui         | Cle de signature des tokens        |
| `DISCORD_WEBHOOK_URL`| Recommande  | Webhook Discord pour notifications |
| `RESEND_API_KEY`     | Recommande  | Cle API Resend pour emails OTP     |
| `FROM_EMAIL`         | Optionnel   | Email d'expedition                 |

| KV Namespace | Obligatoire | Description                             |
|-------------|:-----------:|-----------------------------------------|
| `CW_KV`    | Oui         | Stockage de toutes les donnees du site  |
