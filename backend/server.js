const express = require('express');
const http = require('http');
const fs = require('fs');
const socketIo = require('socket.io');
const path = require('path');
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

const PORT = process.env.PORT || 3000;

// --- Gestion des Paramètres ---
const SETTINGS_FILE_PATH = path.join(__dirname, 'settings.json');
let settings = {
    smsEnabled: true,
    alertEmails: process.env.ALERT_EMAILS ? process.env.ALERT_EMAILS.split(',') : [], // <-- NOUVEAU
    activeResponseEnabled: true, // <-- NOUVEAU
    aiAnomalyThreshold: 0.9,
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

// --- Historique pour les nouveaux clients ---
const MAX_LOG_HISTORY = 20;
const signatureLogHistory = [];
const hcsLogHistory = [];
const emailLogHistory = []; // <-- NOUVEAU
const rewardsLogHistory = [];

// Middleware pour servir les fichiers statiques
app.use(express.static(path.join(__dirname, '../frontend')));
app.use(express.json());

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
        server.listen(PORT, () => {
            console.log(`🚀 Serveur démarré et prêt sur http://localhost:${PORT}`);
        });

    } catch (error) {
        console.error('❌ ERREUR CRITIQUE: Échec de l\'initialisation des services. Le serveur ne démarrera pas.', error);
        process.exit(1); // Arrête le processus. Render affichera cette erreur dans les logs.
    }
})();

// Route pour la page d'accueil
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// --- Simulation de trafic réseau (côté serveur) ---
const suspiciousIPs = [
    `154.16.10.25`, `201.8.45.112`, `103.56.12.9`, `45.12.189.44`
];
function simulateNetworkTraffic() {
    const networkData = {
        sourceIP: suspiciousIPs[Math.floor(Math.random() * suspiciousIPs.length)],
        protocol: Math.random() > 0.5 ? 'TCP' : 'UDP',
        packetSize: Math.floor(Math.random() * 1500),
        sensorId: Math.floor(Math.random() * 6) + 1,
        destinationIP: `10.0.0.${Math.floor(Math.random() * 255)}`,
        destinationPort: [21, 22, 80, 443, 3389, 8080][Math.floor(Math.random() * 6)]
    };

    // Simule un appel à l'API d'analyse en utilisant axios
    axios.post(`http://localhost:${PORT}/api/analyze`, networkData)
        .catch(error => console.error('Erreur de simulation interne:', error.message));
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
app.post('/api/analyze', async (req, res) => {
    try {
        const networkData = req.body;
        
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
            if (emailService && settings.emailEnabled && alertData.severity !== 'low') { // <-- MODIFIÉ
                const recipientEmails = settings.alertEmails || []; // <-- MODIFIÉ
                
                if (recipientEmails.length > 0) {
                    setTimeout(async () => {
                        try {
                            const emailResults = await emailService.sendAlertEmail(alertData, recipientEmails); // <-- MODIFIÉ
                            console.log(`📧 Emails envoyés: ${emailResults.filter(r => r.success).length}/${emailResults.length}`); // <-- MODIFIÉ
                            const emailLogEntry = { alertData, emailResults }; // <-- MODIFIÉ
                            emailLogHistory.unshift(emailLogEntry); // <-- MODIFIÉ
                            if (emailLogHistory.length > MAX_LOG_HISTORY) emailLogHistory.pop(); // <-- MODIFIÉ
                            io.emit('email-sent', emailLogEntry); // <-- MODIFIÉ
                        } catch (smsError) {
                            console.error('❌ Erreur envoi SMS:', smsError);
                        }
                    }, 1000);
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

        res.json(finalDecision);

    } catch (error) {
        console.error('Erreur analyse:', error);
        res.status(500).json({ 
            error: "Erreur lors de l'analyse",
            details: error.message 
        });
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