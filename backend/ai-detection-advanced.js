/**
 * @file ai-detection-advanced.js
 * Un service d'IA amélioré qui maintient un historique des paquets pour
 * non seulement détecter les anomalies actuelles, mais aussi prédire des
 * types de menaces spécifiques en se basant sur le comportement des flux réseau.
 * Cette approche est dite "stateful" car elle conserve un état des communications.
 */

const sourceIPFrequency = new Map();
const HISTORY_SIZE = 100; // Garder l'historique des 100 derniers paquets
const FLOW_HISTORY_SIZE = 20; // Garder l'historique des 20 derniers paquets par flux
const FLOW_TIMEOUT = 60000; // 1 minute

// Stocke les informations sur les flux de communication (source IP -> dest IP:port)
const activeFlows = new Map();

/**
 * Classe pour la détection d'anomalies et la prédiction de menaces.
 * Maintient un historique des paquets et des flux pour une analyse comportementale.
 */
class AdvancedAnomalyDetector {
    constructor(anomalyThreshold = 0.9) {
        this.anomalyThreshold = anomalyThreshold;
        this.packetHistory = [];
        console.log(`🧠 IA Prédictive initialisée (Seuil: ${this.anomalyThreshold}, Historique: ${HISTORY_SIZE})`);
    }

    /**
     * Extrait les caractéristiques pertinentes d'un paquet réseau.
     * @param {object} networkData - Les données brutes du paquet.
     * @returns {object} Un objet de caractéristiques normalisées.
     */
    extractFeatures(networkData) {
        const { sourceIP, destinationIP, destinationPort, protocol, packetSize } = networkData;
        
        // Mise à jour de la fréquence des IP sources
        const ipCount = (sourceIPFrequency.get(sourceIP) || 0) + 1;
        sourceIPFrequency.set(sourceIP, ipCount);
        const totalPackets = Array.from(sourceIPFrequency.values()).reduce((a, b) => a + b, 0);
        const isFrequentSource = ipCount / totalPackets;

        return {
            packetSize: packetSize || 0,
            protocolType: protocol === 'TCP' ? 1 : (protocol === 'UDP' ? 2 : 0),
            isFrequentSource: isFrequentSource,
            sourceIP: sourceIP,
            destinationIP: destinationIP,
            destinationPort: destinationPort,
            timestamp: Date.now()
        };
    }

    /**
     * Analyse un paquet réseau, met à jour l'état des flux et prédit les menaces.
     * @param {object} networkData - Les données du paquet à analyser.
     * @returns {object} Un objet contenant la décision de menace, la confiance et les détails de la prédiction.
     */
    analyzeAndPredict(networkData) {
        const features = this.extractFeatures(networkData);

        // Ajouter à l'historique et maintenir la taille
        this.packetHistory.push(features);
        if (this.packetHistory.length > HISTORY_SIZE) {
            this.packetHistory.shift();
        }

        // Met à jour l'historique du flux de communication actuel
        const flowId = `${features.sourceIP}>${features.destinationIP}:${features.destinationPort}`;
        if (!activeFlows.has(flowId)) {
            activeFlows.set(flowId, {
                packets: [],
                threatScore: 0,
                lastPacketTimestamp: Date.now()
            });
        }
        const flow = activeFlows.get(flowId);
        flow.packets.push(features);
        if (flow.packets.length > FLOW_HISTORY_SIZE) {
            flow.packets.shift();
        }
        flow.lastPacketTimestamp = features.timestamp;

        // Détection d'anomalie simple basée sur les caractéristiques du paquet actuel
        let isThreat = false;
        let confidence = 0;
        let threatReason = [];

        if (features.packetSize > 1400) {
            isThreat = true;
            confidence = Math.min(0.95, 0.6 + (features.packetSize - 1400) / 1000);
            threatReason.push("Paquet surdimensionné");
        }
        if (features.isFrequentSource > 0.7 && features.protocolType === 1) {
            isThreat = true;
            confidence = Math.max(confidence, Math.min(0.98, features.isFrequentSource));
            threatReason.push("Source TCP très fréquente");
        }

        // Logique de prédiction de menaces spécifiques basée sur le comportement du flux
        let prediction = {
            isPredicted: false,
            predictionConfidence: 0,
            predictionType: null,
            reason: ''
        };

        // Analyse comportementale si le flux a suffisamment de paquets
        if (flow.packets.length > 5) {
            const packetsInFlow = flow.packets;
            const timeDiffs = [];
            for (let i = 1; i < packetsInFlow.length; i++) {
                timeDiffs.push(packetsInFlow[i].timestamp - packetsInFlow[i-1].timestamp);
            }
            const avgTimeDiff = timeDiffs.reduce((a, b) => a + b, 0) / timeDiffs.length;
            const timeStdDev = Math.sqrt(timeDiffs.map(x => Math.pow(x - avgTimeDiff, 2)).reduce((a, b) => a + b) / timeDiffs.length);

            // 1. Prédiction de Beaconing C2 (Malware) : paquets à intervalle régulier (faible écart-type)
            if (timeStdDev < 100 && avgTimeDiff > 500) { // Faible écart-type = régulier
                flow.threatScore += 20;
                prediction = {
                    isPredicted: true,
                    predictionConfidence: Math.min(95, 70 + (200 - timeStdDev)),
                    predictionType: 'Beaconing C2 (Malware)',
                    reason: `Activité périodique détectée depuis ${features.sourceIP} (intervalle ~${(avgTimeDiff/1000).toFixed(1)}s).`
                };
            }

            // 2. Prédiction d'attaque par force brute : beaucoup de petits paquets vers un port de service connu
            const smallPackets = packetsInFlow.filter(p => p.packetSize < 100).length;
            const knownPorts = [21, 22, 3389];
            if (packetsInFlow.length > 10 && smallPackets > 8 && knownPorts.includes(features.destinationPort)) {
                flow.threatScore += 30;
                prediction = {
                    isPredicted: true,
                    predictionConfidence: Math.min(98, 80 + smallPackets),
                    predictionType: 'Attaque par Force Brute',
                    reason: `Multiples tentatives de connexion sur le port ${features.destinationPort} depuis ${features.sourceIP}.`
                };
            }

            // 3. Prédiction d'exfiltration de données : volume de données sortant anormalement élevé
            const totalSize = packetsInFlow.reduce((sum, p) => sum + p.packetSize, 0);
            if (totalSize > 50000) { // Seuil arbitraire de 50KB
                flow.threatScore += 40;
                prediction = {
                    isPredicted: true,
                    predictionConfidence: Math.min(99, 75 + (totalSize - 50000) / 10000),
                    predictionType: 'Exfiltration de Données',
                    reason: `Volume de données sortant anormalement élevé (${(totalSize/1024).toFixed(1)} KB) depuis ${features.sourceIP}.`
                };
            }
        }

        // Nettoie les flux inactifs pour libérer la mémoire
        const now = Date.now();
        for (const [flowId, flowData] of activeFlows.entries()) {
            if (now - flowData.lastPacketTimestamp > FLOW_TIMEOUT) {
                activeFlows.delete(flowId);
            }
        }

        // Déclenche une alerte générique si le score de menace d'un flux est élevé
        if (flow.threatScore > 50 && !prediction.isPredicted) {
             prediction = {
                isPredicted: true,
                predictionConfidence: Math.min(99, flow.threatScore),
                predictionType: 'Activité Suspecte Multiple',
                reason: `Le flux depuis ${features.sourceIP} a un score de menace élevé (${flow.threatScore}).`
            };
        }


        return {
            isThreat,
            confidence: parseFloat(confidence.toFixed(2)),
            reason: threatReason.join(', '),
            features,
            prediction
        };
    }
}

let anomalyDetectorInstance = null;

function getAnomalyDetector() {
    if (!anomalyDetectorInstance) {
        anomalyDetectorInstance = new AdvancedAnomalyDetector();
    }
    return anomalyDetectorInstance;
}

module.exports = { getAnomalyDetector };