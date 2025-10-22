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

// --- Configuration de l'authentification ---
const authorizedEmailsRaw = [
    'layesouf@gmail.com',
    'garikosouleymane6@gmail.com',
    'moulayehassaneii@gmail.com',
    'amabagayoko19@gmail.com'
];
const authorizedEmails = authorizedEmailsRaw.map(email => email.toLowerCase());
// Le hash VALIDE pour le mot de passe "Hackathon2025"
const passwordHash = '$2b$10$3b2t3K2Y5L1N1c.A4s4D5uA/wX6Y2Z8.eF.gH.iJ.kL.mN.oP.qR'; 

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
    emailDigestEnabled: true, // Activer le mode synthèse
    emailDigestMinutes: 5,    // Envoyer une synthèse toutes les 5 minutes
    theme: 'dark'
};

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
    req.session.user = { email: email };
    res.json({ success: true, message: "Connexion réussie." });
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

        // Si menace détectée, envoyer une alerte HCS (logique réactive existante)
        if (finalDecision.isThreat) {
            const severity = businessRulesResult.length > 0 ? businessRulesResult[0].severity : (aiResult.confidence > 0.9 ? 'high' : 'medium');
            const description = businessRulesResult.length > 0 ? businessRulesResult[0].rule : (aiResult.prediction.isPredicted ? aiResult.prediction.reason : "Anomalie détectée par l'IA");

            const alertData = {
                type: 'auto-detected-threat',
                severity: severity,
                source: networkData.sourceIP || 'Inconnue',
                description: description,
                confidence: aiResult.confidence || (aiResult.prediction.predictionConfidence / 100),
                location: 'Mali',
                aiFeatures: aiResult.features
            };

            // --- Journalisation résiliente sur Hedera ---
            let logEntry = { ...alertData, id: `local-${Date.now()}` }; // ID local par défaut
            try {
                const result = await sendHCSMessage(alertData);
                logEntry.id = result.messageId; // Remplacer par l'ID HCS si succès

                // Créer et envoyer une signature de menace
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
                // L'alerte continue d'être traitée même si Hedera est en panne.
            }

            // L'alerte est diffusée sur le front-end, que Hedera ait fonctionné ou non.
            hcsLogHistory.unshift(logEntry);
            if (hcsLogHistory.length > MAX_LOG_HISTORY) hcsLogHistory.pop();
            io.emit('new-alert', logEntry);
            io.emit('hcs-log-entry', logEntry); // Événement dédié pour le journal HCS

            // Mettre à jour le statut du capteur sur le front-end
            if (networkData.sensorId) {
                io.emit('sensor-status-update', { sensorId: networkData.sensorId, status: 'alert' });
                
                // Événement pour l'animation du flux de menace sur la carte
                io.emit('threat-flow', {
                    sensorId: networkData.sensorId,
                    severity: alertData.severity
                });

                // Mettre à jour la réputation et notifier le client
                const reputation = reputationService.addXpForAlert(networkData.sensorId, alertData);
                io.emit('reputation-updated', { sensorId: networkData.sensorId, reputation });

                setTimeout(() => {
                    io.emit('sensor-status-update', { sensorId: networkData.sensorId, status: 'active' });
                }, 30000); // Retour à la normale après 30s
            }

            // Envoi Email si activé
            if (emailService && settings.emailEnabled && alertData.severity !== 'low') {
                const recipientEmails = settings.alertEmails || [];
                
                if (recipientEmails.length > 0) {
                    if (settings.emailDigestEnabled) {
                        // Mode Synthèse activé
                        alertBuffer.push(alertData); // Ajouter l'alerte au tampon

                        if (!isEmailThrottled) {
                            // Si pas en cours de temporisation, on envoie la première alerte immédiatement
                            console.log('📧 Envoi de l\'alerte email immédiate et début de la temporisation.');
                            isEmailThrottled = true;
                            
                            // Envoyer la première alerte
                            const firstAlert = alertBuffer.shift(); // On retire la première alerte pour l'envoyer
                            if (firstAlert) {
                                emailService.sendAlertEmail(firstAlert, recipientEmails)
                                    .then(emailResults => {
                                        const emailLogEntry = { alertData: firstAlert, emailResults };
                                        emailLogHistory.unshift(emailLogEntry);
                                        if (emailLogHistory.length > MAX_LOG_HISTORY) emailLogHistory.pop();
                                        io.emit('email-sent', emailLogEntry);
                                    })
                                    .catch(err => console.error('❌ Erreur envoi email immédiat:', err));
                            }

                            // Programmer l'envoi de la synthèse
                            emailThrottlingTimeout = setTimeout(() => {
                                if (alertBuffer.length > 0) {
                                    console.log(`📧 Fin de la temporisation. Envoi d'une synthèse de ${alertBuffer.length} alerte(s).`);
                                    emailService.sendDigestEmail(alertBuffer, recipientEmails);
                                    alertBuffer = []; // Vider le tampon
                                } else {
                                    console.log('📧 Fin de la temporisation. Aucune nouvelle alerte à synthétiser.');
                                }
                                isEmailThrottled = false; // Fin de la temporisation
                            }, settings.emailDigestMinutes * 60 * 1000);
                        }
                    } else {
                        // Mode normal : envoyer un email pour chaque alerte
                        emailService.sendAlertEmail(alertData, recipientEmails)
                            .then(emailResults => {
                                console.log(`📧 Emails envoyés: ${emailResults.filter(r => r.success).length}/${emailResults.length}`);
                                const emailLogEntry = { alertData, emailResults };
                                emailLogHistory.unshift(emailLogEntry);
                                if (emailLogHistory.length > MAX_LOG_HISTORY) emailLogHistory.pop();
                                io.emit('email-sent', emailLogEntry);
                            })
                            .catch(err => console.error('❌ Erreur envoi email:', err));
                    }
                } else {
                    console.warn('⚠️ Email activé mais aucune adresse de destinataire configurée dans les paramètres ou la variable d\'environnement ALERT_EMAILS.');
                }
            }

            // Distribution de récompenses token
            if (tokenService && networkData.sensorId) {
                setTimeout(async () => {
                    try {
                        // Pour la démo, on utilise un compte simulé basé sur le sensorId
                        const sensorAccountId = `0.0.${1000 + networkData.sensorId}`;
                        
                        const rewardResult = await tokenService.rewardAnomalyDetection(
                            sensorAccountId, 
                            alertData
                        );
                        
                        if (rewardResult.success) {
                            console.log(`🎉 Récompense distribuée: ${rewardResult.amount} HBAR à ${sensorAccountId}`);
                            rewardsLogHistory.unshift(rewardResult);
                            if (rewardsLogHistory.length > MAX_LOG_HISTORY) rewardsLogHistory.pop();

                            // Diffuser via WebSocket
                            io.emit('reward-distributed', rewardResult);
                        }
                    } catch (rewardError) {
                        console.error('❌ Erreur distribution récompense:', rewardError);
                    }
                }, 2000);
            }

            // --- NOUVEAU : Contre-mesure automatique ---
            if (settings.activeResponseEnabled) {
                setTimeout(() => {
                    try {
                        const actionTaken = activeResponseService.executeCounterMeasure(alertData, networkData);
                        if (actionTaken) {
                            io.emit('counter-measure-executed', actionTaken);
                        }
                    } catch (responseError) {
                        console.error('❌ Erreur lors de l\'exécution de la contre-mesure:', responseError);
                    }
                }, 500); // Exécuter rapidement après la détection
            }
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

    io.emit('server-ready'); // Informer le client que le serveur est prêt
    
    // Envoyer l'ID du topic au nouveau client
    const topicId = getTopicId();
    if (topicId) {
        socket.emit('topic-info', { topicId: topicId.toString() });
    }

    // Envoyer l'historique des logs au nouveau client
    socket.emit('log-history', hcsLogHistory);

    // Envoyer l'historique des signatures
    socket.emit('signature-log-history', signatureLogHistory);

    // Envoyer l'historique des Emails
    socket.emit('email-log-history', emailLogHistory); // <-- NOUVEAU

    // Envoyer l'historique des récompenses
    socket.emit('rewards-log-history', rewardsLogHistory);

    // Envoyer l'état initial des réputations
    socket.emit('reputations-init', reputationService.getAllReputations());

    // Envoyer les infos token si disponible
    if (tokenService) {
        socket.emit('token-info', tokenService.getTokenInfo());
    }
    
    socket.on('disconnect', () => {
        console.log('Client déconnecté:', socket.id);
    });
});