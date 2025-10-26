# Étape 1: Utiliser une image Node.js officielle et optimisée
FROM node:18-alpine

# Définir le répertoire de travail à l'intérieur du conteneur
WORKDIR /usr/src/app

# Copier les fichiers package.json et package-lock.json
COPY package*.json ./

# Installer les dépendances de production
RUN npm install --only=production

# Copier le reste du code de l'application
COPY . .

# Exposer le port sur lequel l'application s'exécute
EXPOSE 3000

# Commande pour démarrer l'application
CMD [ "node", "backend/server.js" ]