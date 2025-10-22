// Version simplifiée de la détection d'anomalies sans TensorFlow
class SimpleAnomalyDetector {
    constructor() {
        this.normalPatterns = [];
        this.anomalyThreshold = 0.8;
        this.isModelTrained = true; // Toujours prêt pour cette version simple
    }

    // Détection d'anomalie basée sur des règles simples
    detectAnomaly(networkData) {
        try {
            // Extraction des caractéristiques du traffic
            const features = this.extractFeatures(networkData);
            
            // Calcul simple de score d'anomalie (sans machine learning)
            let anomalyScore = 0;
            
            // Règles simples de détection
            if (features[0] > 150) anomalyScore += 0.3; // Trop de paquets
            if (features[1] > 0.5) anomalyScore += 0.4; // Taux d'erreur élevé
            if (features[2] > 80) anomalyScore += 0.3; // Trop de connexions simultanées
            if (features[4] > 0.4) anomalyScore += 0.5; // Pattern suspect
            
            // Si l'IP source est suspecte (commence par 154. - souvent des attaques)
            if (networkData.sourceIP && networkData.sourceIP.startsWith('154.')) {
                anomalyScore += 0.6;
            }
            
            const isAnomaly = anomalyScore > this.anomalyThreshold;
            
            return {
                isAnomaly,
                confidence: Math.round(anomalyScore * 100),
                features: features,
                timestamp: Date.now()
            };
        } catch (error) {
            console.error('Erreur détection anomalie:', error);
            return { isAnomaly: false, confidence: 0, error: error.message };
        }
    }

    // Extraction des caractéristiques du traffic
    extractFeatures(networkData) {
        return [
            networkData.packetCount || Math.random() * 200,
            networkData.errorRate || Math.random(),
            networkData.concurrentConnections || Math.floor(Math.random() * 100),
            networkData.protocolType || Math.floor(Math.random() * 4),
            networkData.suspiciousPatterns || Math.random() * 0.5
        ];
    }
}

// Singleton pour l'analyseur
let anomalyDetector = null;

function getAnomalyDetector() {
    if (!anomalyDetector) {
        anomalyDetector = new SimpleAnomalyDetector();
        console.log('✅ Détecteur d\'anomalies simple initialisé');
    }
    return anomalyDetector;
}

// Règles métier spécifiques au contexte Malien (version simplifiée)
function checkBusinessRules(networkData) {
    const rules = [
        {
            name: "Tentative de phishing ciblant les services financiers",
            condition: (data) => data.destinationPort === 443 && data.packetSize > 1000,
            severity: 'high'
        },
        {
            name: "Scan de ports depuis une IP suspecte",
            condition: (data) => data.packetCount > 100,
            severity: 'medium'
        },
        {
            name: "Trafic entrant anormal depuis l'étranger",
            condition: (data) => data.sourceIP && !data.sourceIP.startsWith('196.') && (data.sourceIP.startsWith('154.') || data.sourceIP.startsWith('201.') || data.sourceIP.startsWith('103.') || data.sourceIP.startsWith('45.')),
            severity: 'high'
        }
    ];

    const triggeredRules = [];

    for (const rule of rules) {
        if (rule.condition(networkData)) {
            triggeredRules.push({
                rule: rule.name,
                severity: rule.severity,
                description: `Déclenché par: ${JSON.stringify(networkData)}`
            });
        }
    }

    return triggeredRules;
}

module.exports = {
    getAnomalyDetector,
    checkBusinessRules,
    SimpleAnomalyDetector
};