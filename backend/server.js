/**
 * @file server.js
 * Point d'entrée principal de l'application SAHEL GUARD.
 * Ce fichier initialise le serveur Express, configure les middlewares,
 * gère les routes HTTP, les connexions WebSocket, et orchestre les
 * différents services (IA, Hedera, Email, etc.).
 */

const express = require('express');
const http = require('http');
const fs = require('fs');
const socketIo = require('socket.io');
const path = require('path');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const bcrypt = require('bcrypt'); // NOUVEAU
const { sendHCSMessage, getTopicId, createHCSTopic, createSignatureTopic, sendSignatureMessage } = require("./hedera-config");
const { getAnomalyDetector } = require('./ai-detection-advanced');
const { checkBusinessRules } = require('./ai-detection-simple'); // Ré-importation des règles métier
const reputationService = require('./sensor-reputation');
const axios = require('axios'); // Keep axios for simulation
const { getEmailService } = require('./email-service'); // <-- NOUVEAU
const activeResponseService = require('./active-response-service'); // <-- NOUVEAU
const { getTokenService } = require("./token-service-simple");
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// --- Configuration pour la production derrière un reverse proxy (Render) ---
app.set('trust proxy', 1); // Indispensable pour que les cookies de session fonctionnent en HTTPS


// --- Configuration de l'authentification ---
const authorizedEmailsRaw = [
    'layesouf@gmail.com',
    'garikosouleymane6@gmail.com',
    'moulayehassaneii@gmail.com',
    'amabagayoko19@gmail.com'
];
const authorizedEmails = authorizedEmailsRaw.map(email => email.toLowerCase());
// Hash généré et vérifié pour "Hackathon2025"
const passwordHash = '$2b$10$tpApNQnP7nGkE3tkVFmDv./xsvHcJz0TstyeGOhBICfU3fdt7DEe6';

// Middleware pour les sessions
app.use(session({
    store: new FileStore({
        path: path.join(__dirname, 'sessions'), // Chemin pour stocker les fichiers de session
        ttl: 86400, // Durée de vie de la session en secondes (24h)
        retries: 0
    }),
    secret: process.env.SESSION_SECRET || 'un-secret-tres-secret-pour-le-hackathon',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production', // Mettre à true en production (HTTPS)
        maxAge: 24 * 60 * 60 * 1000 // 24 heures
    }
}));

const PORT = process.env.PORT || 3000;

// --- Gestion des Paramètres ---
const SETTINGS_FILE_PATH = path.join(__dirname, 'settings.json');
let settings = {
    emailEnabled: true,
    alertEmails: process.env.ALERT_EMAILS ? process.env.ALERT_EMAILS.split(',') : [],
    activeResponseEnabled: true,
    aiAnomalyThreshold: 0.9,
    emailDigestMinutes: 5,    // Envoyer une synthèse toutes les 5 minutes
    theme: 'dark'
};

/**
 * Charge les paramètres depuis le fichier settings.json.
 * Si le fichier n'existe pas, il est créé avec les valeurs par défaut.
 */
function loadSettings() {
    try {
        if (fs.existsSync(SETTINGS_FILE_PATH)) {
            const data = fs.readFileSync(SETTINGS_FILE_PATH, 'utf8');
            settings = { ...settings, ...JSON.parse(data) };
            console.log('✅ Paramètres chargés depuis settings.json');
        } else {
            saveSettings();
        }
    } catch (error) {
        console.error('❌ Erreur chargement settings.json:', error);
    }
}

/**
 * Sauvegarde les paramètres actuels dans le fichier settings.json.
 */
function saveSettings() {
    try {
        fs.writeFileSync(SETTINGS_FILE_PATH, JSON.stringify(settings, null, 2), 'utf8');
        console.log('💾 Paramètres sauvegardés dans settings.json');
    } catch (error) {
        console.error('❌ Erreur sauvegarde settings.json:', error);
    }
}

// Variables pour les services
let anomalyDetector = null;
let emailService = null; // <-- NOUVEAU
let tokenService = null;
let isServerReady = false;

// --- Variable pour la temporisation des emails (anti-flood) ---
let lastEmailSentTime = 0;
 
// --- MIDDLEWARES STATIQUES ET JSON ---
// Doit être AVANT les routes GET pour les pages HTML pour servir correctement CSS/JS.
app.use(express.static(path.join(__dirname, '../frontend')));
app.use(express.json());

// Middleware pour protéger les routes admin
const ensureAuthenticated = (req, res, next) => {
    if (req.session.user) {
        return next();
    }
    res.redirect('/login');
};

// --- NOUVELLES ROUTES POUR LES PAGES ---

// Page d'accueil (portail de sélection)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Page de connexion
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/login.html'));
});

// Page Administrateur (maintenant sur /admin)
app.get('/admin', ensureAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/admin.html'));
});

// Page Utilisateur
app.get('/user', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/user.html'));
});

// --- HISTORIQUE POUR LES NOUVEAUX CLIENTS ---
const MAX_LOG_HISTORY = 20;
const signatureLogHistory = [];
const hcsLogHistory = [];
const emailLogHistory = [];
const rewardsLogHistory = [];
const counterMeasuresLogHistory = [];


// Initialisation de tous les services
(async function initializeServices() {
    try {
        loadSettings();
        console.log('🔄 Initialisation des services...');

        // Créer le Topic HCS au démarrage pour qu'il soit toujours disponible
        const alertTopicId = await createHCSTopic();
        const topicId = getTopicId();
        // Créer le Topic pour les signatures
        const signatureTopicId = await createSignatureTopic();
        console.log(`✅ Topics Hedera initialisés: Alertes (${alertTopicId}), Signatures (${signatureTopicId})`);

        if (topicId) {
            // Diffuser l'info du topic à tous les clients dès qu'elle est prête
            io.emit('topic-info', { topicId: topicId.toString() });
        }

        
        anomalyDetector = await getAnomalyDetector();
        console.log('✅ Détecteur d\'anomalies initialisé');

        emailService = getEmailService(); // <-- NOUVEAU
        console.log('✅ Service Email initialisé');
        
        tokenService = getTokenService();
        console.log('✅ Service Token initialisé');
        
        console.log('🚀 Tous les services sont prêts!');

        // Le serveur est maintenant prêt à accepter des connexions et à démarrer la simulation
        isServerReady = true;

        // Démarrage du serveur UNIQUEMENT après une initialisation réussie
        const HOST = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost';
        server.listen(PORT, HOST, () => {
            console.log(`🚀 Serveur démarré et prêt sur http://${HOST}:${PORT}`);
        });

    } catch (error) {
        console.error('❌ ERREUR CRITIQUE: Échec de l\'initialisation des services. Le serveur ne démarrera pas.', error);
        process.exit(1); // Arrête le processus. Render affichera cette erreur dans les logs.
    }
})();

// --- API D'AUTHENTIFICATION ---
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: "Email et mot de passe requis." });
    }

    // 1. Vérifier si l'email est autorisé
    if (!authorizedEmails.includes(email.toLowerCase())) {
        return res.status(401).json({ error: "Email ou mot de passe incorrect." });
    }

    // 2. Vérifier le mot de passe
    const isMatch = await bcrypt.compare(password, passwordHash);
    if (!isMatch) {
        return res.status(401).json({ error: "Email ou mot de passe incorrect." });
    }

    // 3. Créer la session
    req.session.user = { email: email.toLowerCase() };
    req.session.save((err) => {
        if (err) {
            return res.status(500).json({ error: "Erreur lors de la sauvegarde de la session." });
        }
        res.json({ success: true, message: "Connexion réussie." });
    });
});

app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: "Impossible de se déconnecter." });
        }
        res.redirect('/login');
    });
});

// --- Simulation de trafic réseau (côté serveur) ---
/**
 * Simule la réception de données réseau provenant d'un capteur.
 * Ces données sont ensuite passées au moteur d'analyse.
 */
const suspiciousIPs = [
    `154.16.10.25`, `201.8.45.112`, `103.56.12.9`, `45.12.189.44`
];
async function simulateNetworkTraffic() {
    const networkData = {
        sourceIP: suspiciousIPs[Math.floor(Math.random() * suspiciousIPs.length)],
        protocol: Math.random() > 0.5 ? 'TCP' : 'UDP',
        packetSize: Math.floor(Math.random() * 1500),
        sensorId: Math.floor(Math.random() * 6) + 1,
        destinationIP: `10.0.0.${Math.floor(Math.random() * 255)}`,
        destinationPort: [21, 22, 80, 443, 3389, 8080][Math.floor(Math.random() * 6)],
    };

    // Appel direct de la logique d'analyse au lieu d'un appel HTTP
    try {
        await analyzeTraffic(networkData);
    } catch (error) {
        console.error('Erreur de simulation interne:', error.message);
    }
}

// Route pour envoyer une alerte manuellement
app.post('/api/alert', async (req, res) => {
    try {
        const alertData = req.body;
        
        // Validation basique des données
        if (!alertData.type || !alertData.severity) {
            return res.status(400).json({ 
                error: "Les champs 'type' et 'severity' sont requis" 
            });
        }
        
        // Envoi du message à Hedera
        const result = await sendHCSMessage(alertData);
        
        // Diffusion via WebSocket à tous les clients connectés
        io.emit('new-alert', { ...alertData, id: result.messageId });
        
        res.json({ 
            success: true, 
            message: "Alerte envoyée avec succès",
            data: result 
        });
    } catch (error) {
        console.error("Erreur:", error);
        res.status(500).json({ 
            error: "Erreur lors de l'envoi de l'alerte",
            details: error.message 
        });
    }
});

// Route pour l'analyse en temps réel avec IA
/**
 * Analyse un paquet réseau donné pour détecter des anomalies ou des menaces.
 * @param {object} networkData - Les données du paquet réseau à analyser.
 * @returns {Promise<object>} L'objet de décision finale contenant les résultats de l'analyse.
 */
async function analyzeTraffic(networkData) {
    try {
        // La logique d'analyse est maintenant dans une fonction réutilisable

        if (!anomalyDetector) {
            return res.status(503).json({ 
                error: "Système IA non initialisé" 
            });
        }

        // --- RESTAURATION DE LA LOGIQUE DE DÉCISION INITIALE ---
        let aiResult;
        try {
            aiResult = await anomalyDetector.analyzeAndPredict(networkData);
        } catch (aiError) {
            console.error("❌ Erreur critique du service IA:", aiError.message);
            // En cas de panne de l'IA, on se fie uniquement aux règles métier
            aiResult = { isAnomaly: false, confidence: 0, features: {}, prediction: {} };
        }

        const businessRulesResult = checkBusinessRules(networkData);
        
        // Décision finale
        let finalDecision = {
            isThreat: aiResult.isAnomaly || businessRulesResult.length > 0,
            aiAnalysis: aiResult,
            businessRules: businessRulesResult,
            timestamp: Date.now(),
            networkData: networkData
        };

        // Si une menace est détectée, orchestrer toutes les actions nécessaires.
        if (finalDecision.isThreat) {
            await handleThreatDetected(finalDecision, networkData);
        }

        return finalDecision; // Retourne la décision pour la simulation

    } catch (error) {
        console.error('Erreur analyse:', error);
        // Si c'est un appel HTTP, on renvoie une erreur. Sinon, l'erreur est déjà loggée.
        throw error;
    }
}

app.post('/api/analyze', async (req, res) => {
    try {
        const networkData = req.body;
        const finalDecision = await analyzeTraffic(networkData);
        res.json(finalDecision);
    } catch (error) {
        res.status(500).json({ error: "Erreur lors de l'analyse", details: error.message });
    }
});

/**
 * Orchestre toutes les actions à prendre lorsqu'une menace est détectée.
 * @param {object} finalDecision - L'objet de décision de menace.
 * @param {object} networkData - Les données réseau originales.
 */
async function handleThreatDetected(finalDecision, networkData) {
    const { aiAnalysis, businessRules } = finalDecision;

    // 1. Construire l'objet d'alerte
    const severity = businessRules.length > 0 ? businessRules[0].severity : (aiAnalysis.confidence > 0.9 ? 'high' : 'medium');
    const description = businessRules.length > 0 ? businessRules[0].rule : (aiAnalysis.prediction.isPredicted ? aiAnalysis.prediction.reason : "Anomalie détectée par l'IA");

    const alertData = {
        type: 'auto-detected-threat',
        severity: severity,
        source: networkData.sourceIP || 'Inconnue',
        description: description,
        confidence: aiAnalysis.confidence || (aiAnalysis.prediction.predictionConfidence / 100),
        location: 'Mali',
        aiFeatures: aiAnalysis.features,
        timestamp: Date.now()
    };

    // 2. Journalisation sur Hedera et diffusion de l'alerte
    await logAndBroadcastAlert(alertData, networkData);

    // 3. Mise à jour du statut et de la réputation du capteur
    if (networkData.sensorId) {
        updateSensorStatusAndReputation(networkData, alertData);
    }

    // 4. Exécuter la contre-mesure et envoyer l'email
    let actionTaken = null;
    if (settings.activeResponseEnabled) {
        actionTaken = activeResponseService.executeCounterMeasure(alertData, networkData);
        if (actionTaken) {
            counterMeasuresLogHistory.unshift(actionTaken);
            if (counterMeasuresLogHistory.length > MAX_LOG_HISTORY) counterMeasuresLogHistory.pop();
            io.emit('counter-measure-executed', actionTaken);
        }
    }

    if (emailService && settings.emailEnabled && alertData.severity !== 'low') {
        sendEmailWithThrottling(alertData, actionTaken);
    }

    // 5. Distribuer les récompenses
    if (tokenService && networkData.sensorId) {
        distributeReward(networkData, alertData);
    }
}

/**
 * Journalise une alerte sur Hedera et la diffuse aux clients via WebSocket.
 * @param {object} alertData - L'objet de l'alerte à journaliser.
 * @param {object} networkData - Les données réseau originales pour créer une signature.
 */
async function logAndBroadcastAlert(alertData, networkData) {
    let logEntry = { ...alertData, id: `local-${Date.now()}` };
    try {
        const result = await sendHCSMessage(alertData);
        logEntry.id = result.messageId;

        const signature = {
            threatType: alertData.type,
            severity: alertData.severity,
            sourcePattern: networkData.sourceIP.split('.').slice(0, 2).join('.') + '.*.*',
        };
        const signatureLogEntry = await sendSignatureMessage(signature);
        signatureLogHistory.unshift(signatureLogEntry);
        if (signatureLogHistory.length > MAX_LOG_HISTORY) signatureLogHistory.pop();
        io.emit('new-signature', signatureLogEntry);

    } catch (hederaError) {
        console.error("❌ Échec de la journalisation sur Hedera:", hederaError.message);
    }

    hcsLogHistory.unshift(logEntry);
    if (hcsLogHistory.length > MAX_LOG_HISTORY) hcsLogHistory.pop();
    io.emit('new-alert', logEntry);
    io.emit('hcs-log-entry', logEntry);
}

/**
 * Met à jour le statut visuel d'un capteur et sa réputation après une détection.
 * @param {object} networkData - Les données réseau contenant l'ID du capteur.
 * @param {object} alertData - Les données de l'alerte pour calculer l'XP.
 */
function updateSensorStatusAndReputation(networkData, alertData) {
    io.emit('sensor-status-update', { sensorId: networkData.sensorId, status: 'alert' });
    io.emit('threat-flow', { sensorId: networkData.sensorId, severity: alertData.severity });

    const reputation = reputationService.addXpForAlert(networkData.sensorId, alertData);
    io.emit('reputation-updated', { sensorId: networkData.sensorId, reputation });

    setTimeout(() => {
        io.emit('sensor-status-update', { sensorId: networkData.sensorId, status: 'active' });
    }, 30000);
}

/**
 * Simule la distribution d'une récompense à un capteur.
 * @param {object} networkData - Les données réseau contenant l'ID du capteur.
 * @param {object} alertData - Les données de l'alerte pour calculer le montant de la récompense.
 */
function distributeReward(networkData, alertData) {
    setTimeout(async () => {
        try {
            const sensorAccountId = `0.0.${1000 + networkData.sensorId}`;
            const rewardResult = await tokenService.rewardAnomalyDetection(sensorAccountId, alertData);
            if (rewardResult.success) {
                console.log(`🎉 Récompense distribuée: ${rewardResult.amount} HBAR à ${sensorAccountId}`);
                rewardsLogHistory.unshift(rewardResult);
                if (rewardsLogHistory.length > MAX_LOG_HISTORY) rewardsLogHistory.pop();
                io.emit('reward-distributed', rewardResult);
            }
        } catch (rewardError) {
            console.error('❌ Erreur distribution récompense:', rewardError);
        }
    }, 2000);
}

// --- Routes pour les Paramètres ---
app.get('/api/settings', (req, res) => {
    res.json(settings);
});

app.post('/api/settings', (req, res) => {
    settings = { ...settings, ...req.body };
    if (anomalyDetector) {
        anomalyDetector.anomalyThreshold = settings.aiAnomalyThreshold; // Keep this
    }
    // Mettre à jour le paramètre du service de réponse active
    // (Pas nécessaire pour ce service simple, mais bonne pratique pour des services plus complexes)

    saveSettings();
    res.json({ success: true, message: "Paramètres mis à jour." });
});

// Route pour obtenir des informations sur le topic
app.get('/api/topic-info', (req, res) => {
    const topicId = getTopicId();
    res.json({
        topicId: topicId ? topicId.toString() : "Non défini",
        network: "Hedera Testnet",
        status: topicId ? "Actif" : "Inactif"
    });
});

// Route pour les informations token
app.get('/api/token-info', async (req, res) => {
    try {
        const info = tokenService.getTokenInfo();
        res.json(info);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Route pour vérifier un solde
app.get('/api/balance/:accountId', async (req, res) => {
    try {
        const balance = await tokenService.getAccountBalance(req.params.accountId);
        res.json(balance);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Route pour distribuer des récompenses manuelles
app.post('/api/reward', async (req, res) => {
    try {
        const { accountId, amount, reason } = req.body;
        
        if (!accountId || !amount) {
            return res.status(400).json({ error: "accountId et amount requis" });
        }

        const result = await tokenService.distributeReward(accountId, amount, reason || "Récompense manuelle");
        res.json(result);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- Gestion centralisée des connexions WebSocket ---
let simulationInterval = null;
// Gestion des connexions WebSocket
io.on('connection', (socket) => {
    // Démarrer la simulation automatique une fois que le serveur est prêt et qu'un premier client se connecte
    if (isServerReady && !simulationInterval) {
        console.log('✅ Premier client connecté et serveur prêt. Démarrage de la simulation.');
        simulationInterval = setInterval(simulateNetworkTraffic, 5000);
    }

    console.log('🔗 Nouveau client connecté:', socket.id);

    // Informer le client que le serveur est prêt
    io.emit('server-ready');
    
    // Envoyer les informations initiales au nouveau client
    const topicId = getTopicId();
    if (topicId) {
        socket.emit('topic-info', { topicId: topicId.toString() });
    }

    // Envoyer les différents historiques pour peupler l'interface
    socket.emit('log-history', hcsLogHistory);
    socket.emit('signature-log-history', signatureLogHistory);
    socket.emit('email-log-history', emailLogHistory);
    socket.emit('rewards-log-history', rewardsLogHistory);
    socket.emit('counter-measures-log-history', counterMeasuresLogHistory);

    // Envoyer les données de réputation initiales
    socket.emit('reputations-init', reputationService.getAllReputations());

    // Envoyer les informations sur le token de récompense
    if (tokenService) {
        socket.emit('token-info', tokenService.getTokenInfo());
    }
    
    // Gérer la déconnexion du client
    socket.on('disconnect', () => {
        console.log('Client déconnecté:', socket.id);
    });
});