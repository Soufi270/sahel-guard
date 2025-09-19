const tf = require('@tensorflow/tfjs-node');
const fs = require('fs');
const path = require('path');

// Modèle simple de détection d'anomalies
class NetworkAnomalyDetector {
    constructor() {
        this.model = null;
        this.normalPatterns = [];
        this.anomalyThreshold = 0.8;
        this.isModelTrained = false;
    }

    // Initialisation du modèle
    async initializeModel() {
        try {
            this.model = tf.sequential();
            this.model.add(tf.layers.dense({
                units: 10,
                activation: 'relu',
                inputShape: [5] // 5 caractéristiques réseau
            }));
            this.model.add(tf.layers.dense({
                units: 5,
                activation: 'relu'
            }));
            this.model.add(tf.layers.dense({
                units: 1,
                activation: 'sigmoid'
            }));

            this.model.compile({
                optimizer: 'adam',
                loss: 'binaryCrossentropy',
                metrics: ['accuracy']
            });

            console.log('✅ Modèle IA initialisé');
            return true;
        } catch (error) {
            console.error('❌ Erreur initialisation modèle IA:', error);
            return false;
        }
    }

    // Entraînement avec des données normales (simulées)
    async trainWithNormalData() {
        // Données normales simulées pour l'entraînement
        const normalData = this.generateNormalTrainingData();
        const xs = tf.tensor2d(normalData.map(item => item.features));
        const ys = tf.tensor1d(normalData.map(item => item.label));

        await this.model.fit(xs, ys, {
            epochs: 50,
            batchSize: 32,
            validationSplit: 0.2,
            verbose: 0
        });

        this.isModelTrained = true;
        console.log('✅ Modèle IA entraîné avec données normales');
        
        xs.dispose();
        ys.dispose();
    }

    // Génération de données d'entraînement normales
    generateNormalTrainingData() {
        const data = [];
        
        // Patterns réseau normaux (simulés)
        for (let i = 0; i < 1000; i++) {
            data.push({
                features: [
                    Math.random() * 100, // packets/min normal
                    Math.random() * 0.3, // error rate normal
                    Math.random() * 50,  // connexions simultanées
                    Math.floor(Math.random() * 3), // type de protocol (0-2)
                    Math.random() * 0.2  // taux de requêtes suspectes
                ],
                label: 0 // 0 = normal
            });
        }

        return data;
    }

    // Détection d'anomalie en temps réel
    async detectAnomaly(networkData) {
        if (!this.isModelTrained) {
            return { isAnomaly: false, confidence: 0, reason: 'Modèle non entraîné' };
        }

        try {
            // Extraction des caractéristiques du traffic réseau
            const features = this.extractFeatures(networkData);
            const inputTensor = tf.tensor2d([features]);
            
            const prediction = this.model.predict(inputTensor);
            const confidence = (await prediction.data())[0];
            
            inputTensor.dispose();
            prediction.dispose();

            const isAnomaly = confidence > this.anomalyThreshold;
            
            return {
                isAnomaly,
                confidence: Math.round(confidence * 100),
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
        // Simulation d'extraction de caractéristiques
        return [
            networkData.packetCount || Math.random() * 200,
            networkData.errorRate || Math.random(),
            networkData.concurrentConnections || Math.floor(Math.random() * 100),
            networkData.protocolType || Math.floor(Math.random() * 4),
            networkData.suspiciousPatterns || Math.random() * 0.5
        ];
    }

    // Ajout manuel d'une anomalie pour l'apprentissage
    addAnomalyPattern(anomalyData) {
        this.anomalyPatterns = this.anomalyPatterns || [];
        this.anomalyPatterns.push({
            features: this.extractFeatures(anomalyData),
            timestamp: Date.now()
        });
        
        console.log('📝 Pattern anomalie enregistré pour apprentissage futur');
    }
}

// Singleton pour l'analyseur
let anomalyDetector = null;

async function getAnomalyDetector() {
    if (!anomalyDetector) {
        anomalyDetector = new NetworkAnomalyDetector();
        await anomalyDetector.initializeModel();
        await anomalyDetector.trainWithNormalData();
    }
    return anomalyDetector;
}

// Règles métier spécifiques au contexte Malien
function checkBusinessRules(networkData) {
    const rules = [
        {
            name: "Tentative de phishing ciblant les services financiers",
            condition: (data) => data.destinationPort === 443 && 
                               data.packetSize > 1000 &&
                               data.sourceIP.includes('154.'),
            severity: 'high'
        },
        {
            name: "Scan de ports depuis une IP suspecte",
            condition: (data) => data.packetCount > 100 && 
                               data.destinationPort < 1024,
            severity: 'medium'
        },
        {
            name: "Trafic entrant anormal depuis l'étranger",
            condition: (data) => data.sourceIP && 
                               !data.sourceIP.startsWith('196.') && // Plage IP Mali
                               data.packetCount > 50,
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
    NetworkAnomalyDetector
};