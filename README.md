# salleDeSport

## 🎮 Les 5 Gardiens — RPG fantastique mobile à jouer à 5

Un mini-RPG tour par tour, jouable en local à 5 sur un seul mobile (mode "passe l'appareil"), avec 5 héros à compétences uniques :

- 🐗 **Samurai Sanglier** — Guerrier tank : charge, garde et attaque de zone.
- 🦌 **Prêtresse Biche** — Soigneuse : soins simples/de groupe et purification.
- 🦊 **Renard Ninja** — Assassin : frappes critiques, poison et esquive.
- 🦦 **Loutre Mage** — Élémentaliste : dégâts de zone, gel et boucliers.
- 🐉 **Dragon Barde** — Soutien : buffs d'équipe et envoûtement.

👉 Pour jouer : ouvrez [`rpg/index.html`](rpg/index.html) dans un navigateur mobile (ou en local).

## 🌍 Les 5 Gardiens — MMO (`mmo/`)

Version en ligne, en temps réel, pour 5 joueurs connectés simultanément depuis leurs propres téléphones : un monde partagé en **3D** (caméra 3e personne, style low-poly cel-shadé original) avec 3 villages, 3 zones sauvages, des quêtes qui font progresser du niveau 1 au niveau 20, et de l'équipement (casque/plastron/jambières/bottes) — aucune personnalisation esthétique, chaque classe garde son modèle fixe. Tous les modèles 3D (héros, monstres, PNJ, décor) sont générés par code, sans aucune ressource externe copiée.

Contrairement à `rpg/`, cette version a besoin d'un serveur qui tourne en continu (déplacements et combats synchronisés en temps réel entre joueurs). Elle ne peut donc pas être hébergée sur GitHub Pages.

### Déployer gratuitement (Render.com)

1. Va sur [render.com](https://render.com) et connecte-toi avec ton compte GitHub.
2. Clique sur **New +** → **Web Service**, puis choisis le dépôt `salledesport`.
3. Render détecte le fichier `mmo/render.yaml` automatiquement (sinon configure manuellement : *Root Directory* = `mmo`, *Build Command* = `npm install`, *Start Command* = `npm start`).
4. Choisis le plan **Free**, puis clique sur **Create Web Service**.
5. Une fois déployé (1-2 minutes), Render te donne une URL du type `https://les-5-gardiens-mmo.onrender.com` — c'est cette adresse que chacun des 5 joueurs ouvre depuis son téléphone.

⚠️ Sur le plan gratuit, le serveur s'endort après une quinzaine de minutes d'inactivité et met ~30 secondes à se réveiller à la prochaine connexion — normal pour un usage entre amis. Les sauvegardes de personnages sont stockées sur le serveur ; elles peuvent être perdues si Render redéploie le service (disque non persistant sur le plan gratuit).

### Lancer en local (test)

```bash
cd mmo
npm install
npm start
```

Puis ouvre `http://localhost:3000` (ou l'IP locale de ta machine) depuis les téléphones connectés au même réseau Wi-Fi.