# SAHEL GUARD - Système de Sécurité Réseau Décentralisé

 <!-- Pensez à remplacer par une capture d'écran de votre interface -->

**SAHEL GUARD** est un prototype de système de sécurité réseau décentralisé conçu pour le hackathon Hedera 2025. Il combine une détection de menaces en temps réel, une journalisation immuable sur le Hedera Consensus Service (HCS), et un système de récompenses pour les capteurs qui détectent des anomalies.

## 🚀 Fonctionnalités

- **Tableau de Bord Interactif** : Interface web en temps réel construite avec Express et Socket.IO pour visualiser les alertes, les statuts des services et la cartographie des menaces.
- **Détection de Menaces** : Un système simple d'IA et de règles métier pour analyser le trafic réseau simulé et identifier les activités suspectes.
- **Journalisation Décentralisée** : Chaque alerte générée est enregistrée de manière immuable sur le **Hedera Consensus Service (HCS)**, garantissant un audit transparent et infalsifiable.
- **Notifications SMS** : Envoi d'alertes critiques aux administrateurs via l'API SMS de **Vonage**.
- **Notifications Email** : Envoi d'alertes critiques aux administrateurs via **Nodemailer**.
- **Système de Récompenses (Simulé)** : Distribution de tokens (simulés en HBAR pour la démo) via le **Hedera Token Service (HTS)** pour récompenser les capteurs qui identifient des menaces.
- **Cartographie des Menaces** : Visualisation géographique des capteurs et des flux de menaces détectées.

## 🛠️ Technologies Utilisées

- **Backend** : Node.js, Express.js
- **Communication Temps Réel** : Socket.IO
- **Blockchain / DLT** : Hedera SDK for JS (@hashgraph/sdk)
- **Notifications** : Nodemailer
- **Dépendances** : `dotenv`, `axios`, `nodemailer`

## ⚙️ Installation et Configuration

### Prérequis

- Node.js (v18.x ou supérieure)
- Un compte sur le portail développeur Hedera pour obtenir un `OPERATOR_ID` et `OPERATOR_KEY`.
- Un compte Vonage pour obtenir les clés d'API SMS.
- Un compte de service email (ex: Gmail, Outlook, un serveur SMTP dédié) pour Nodemailer.

### Étapes d'installation

1.  **Clonez le dépôt :**
    ```bash
    git clone https://github.com/VOTRE_NOM_UTILISATEUR/sahel-guard.git
    cd sahel-guard
    ```

2.  **Installez les dépendances :**
    ```bash
    npm install
    ```

3.  **Configurez les variables d'environnement :**
    Créez un fichier `.env` à la racine du projet en copiant le fichier d'exemple :
    ```bash
    cp .env.example .env
    ```
    Modifiez le fichier `.env` et remplissez-le avec vos propres clés Hedera et Vonage.

## ▶️ Lancement

Pour démarrer le serveur, exécutez :

```bash
npm start
```

Le serveur sera accessible à l'adresse `http://localhost:3000`.

## 🤝 Contribution

Ce projet a été réalisé dans le cadre du hackathon Hedera 2025. Les contributions sont les bienvenues. N'hésitez pas à ouvrir une *issue* ou une *pull request*.