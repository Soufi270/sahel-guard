const express = require('express');
const http = require('http');
const fs = require('fs');
const socketIo = require('socket.io');
const path = require('path');
const { sendHCSMessage, getTopicId, createHCSTopic, createSignatureTopic, sendSignatureMessage } = require("./hedera-config");
const { getAnomalyDetector, checkBusinessRules } = require('./ai-detection-simple');
const reputationService = require('./sensor-reputation');
const axios = require('axios');
const { getSmsService } = require('./sms-service');
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
    alertPhoneNumbers: process.env.ALERT_PHONE_NUMBERS ? process.env.ALERT_PHONE_NUMBERS.split(',') : [],
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
let smsService = null;
let tokenService = null;
let isServerReady = false;

// --- Historique pour les nouveaux clients ---
const MAX_LOG_HISTORY = 20;
const signatureLogHistory = [];
const hcsLogHistory = [];
const smsLogHistory = [];
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
        await createHCSTopic();
        const topicId = getTopicId();
        // Créer le Topic pour les signatures
        await createSignatureTopic();

        if (topicId) {
            // Diffuser l'info du topic à tous les clients dès qu'elle est prête
            io.emit('topic-info', { topicId: topicId.toString() });
        }

        
        anomalyDetector = await getAnomalyDetector();
        console.log('✅ Détecteur d\'anomalies initialisé');
        
        smsService = getSmsService();
        console.log('✅ Service SMS initialisé');
        
        tokenService = getTokenService();
        console.log('✅ Service Token initialisé');
        
        console.log('🚀 Tous les services sont prêts!');

        // Le serveur est maintenant prêt à accepter des connexions et à démarrer la simulation
        isServerReady = true;
        
    } catch (error) {
        console.error('❌ Erreur initialisation services:', error);
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

// Démarrer la simulation automatique une fois que le serveur est prêt
let simulationInterval = null;
io.on('connection', (socket) => {
    // Si le serveur est prêt et qu'un client se connecte, on démarre la simulation
    if (isServerReady && !simulationInterval) {
        console.log('✅ Premier client connecté et serveur prêt. Démarrage de la simulation.');
        simulationInterval = setInterval(simulateNetworkTraffic, 5000); // Ralentissement de 3s à 5s
    }
});

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

        const aiResult = await anomalyDetector.detectAnomaly(networkData);
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
            const alertData = {
                type: 'auto-detected-threat',
                severity: businessRulesResult.length > 0 ? businessRulesResult[0].severity : (aiResult.confidence > 90 ? 'high' : 'medium'),
                source: networkData.sourceIP || 'Inconnue',
                description: `Menace détectée: ${aiResult.isAnomaly ? 'Anomalie IA' : 'Règle métier'} - ${businessRulesResult.map(r => r.rule).join(', ')}`,
                confidence: aiResult.confidence,
                location: 'Mali',
                aiFeatures: aiResult.features
            };

            const result = await sendHCSMessage(alertData);

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

            // Ajouter au log et à l'historique
            const logEntry = { ...alertData, id: result.messageId };
            hcsLogHistory.unshift(logEntry);
            if (hcsLogHistory.length > MAX_LOG_HISTORY) hcsLogHistory.pop();

            io.emit('new-alert', logEntry);
            io.emit('hcs-log-entry', logEntry); // Événement dédié pour le journal HCS

            // Mettre à jour le statut du capteur sur le front-end
            if (networkData.sensorId) {
                io.emit('sensor-status-update', { sensorId: networkData.sensorId, status: 'alert' });
                // Mettre à jour la réputation et notifier le client
                const reputation = reputationService.addXpForAlert(networkData.sensorId, alertData);
                io.emit('reputation-updated', { sensorId: networkData.sensorId, reputation });

                setTimeout(() => {
                    io.emit('sensor-status-update', { sensorId: networkData.sensorId, status: 'active' });
                }, 30000); // Retour à la normale après 30s
            }

            // Envoi SMS si activé
            if (smsService && settings.smsEnabled && alertData.severity !== 'low') {
                const phoneNumbers = settings.alertPhoneNumbers || [];
                
                if (phoneNumbers.length > 0) {
                    setTimeout(async () => {
                        try {
                            const smsResults = await smsService.sendAlertSms(alertData, phoneNumbers);
                            console.log(`📱 SMS envoyés: ${smsResults.filter(r => r.success).length}/${smsResults.length}`);
                            const smsLogEntry = { alertData, smsResults };
                            smsLogHistory.unshift(smsLogEntry);
                            if (smsLogHistory.length > MAX_LOG_HISTORY) smsLogHistory.pop();

                            io.emit('sms-sent', smsLogEntry);
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
                            console.log(`🎉 Récompense distribuée: ${rewardResult.amount} SAHEL à ${sensorAccountId}`);
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
        anomalyDetector.anomalyThreshold = settings.aiAnomalyThreshold;
    }
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

// Gestion des connexions WebSocket
io.on('connection', (socket) => {
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

    // Envoyer l'historique des signatures
    socket.emit('signature-log-history', signatureLogHistory);

    // Envoyer l'historique des SMS
    socket.emit('sms-log-history', smsLogHistory);

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

// Démarrage du serveur
server.listen(PORT, () => {
    console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
    console.log(`📋 Topic ID: ${getTopicId() ? getTopicId().toString() : "Non encore créé"}`);
});