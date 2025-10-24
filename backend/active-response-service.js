/**
 * active-response-service.js
 *
 * Gère les contre-mesures automatiques en réponse aux menaces détectées.
 */

const blockedIPs = new Set();
const reputationService = require('./sensor-reputation'); // Importer le service de réputation

class ActiveResponseService {
    constructor() {
        console.log('🛡️ Service de Réponse Active initialisé (simulation).');
    }

    /**
     * Génère une raison plus descriptive pour l'action de contre-mesure.
     * @param {object} alertData - Les données de l'alerte.
     * @returns {string} La raison formatée.
     */
    _getFormattedReason(alertData) {
        const { severity, type, description } = alertData;

        const reasonTemplates = {
            critical: `Réponse immédiate à une menace critique (${type}).`,
            high: `Activité malveillante de niveau élevé détectée (${type}).`,
            ddos: `Atténuation d'une attaque par déni de service probable.`,
            intrusion: `Isolation de la source suite à une tentative d'intrusion.`,
            malware: `Mise en quarantaine de la source suspectée de distribuer un malware.`,
            phishing: `Blocage de l'origine d'une campagne de phishing.`
        };

        // Choisir un modèle spécifique si disponible, sinon un modèle générique basé sur la sévérité
        const template = reasonTemplates[type] || reasonTemplates[severity] || `Menace de niveau '${severity}' détectée.`;
        
        return `${template} Description: ${description}`;
    }

    /**
     * Exécute une contre-mesure basée sur les données de la menace.
     * @param {object} alertData - Les données de l'alerte.
     * @param {object} networkData - Les données réseau originales.
     * @returns {object|null} Un objet décrivant l'action prise, ou null si aucune action.
     */
    executeCounterMeasure(alertData, networkData) { // Correction: Pas de virgule ici
        // Décision : On n'agit que sur les menaces de sévérité 'high' ou 'critical'
        if (alertData.severity !== 'high' && alertData.severity !== 'critical') {
            console.log(`[Réponse Active] Menace de niveau '${alertData.severity}' ignorée, aucune action automatique.`);
            return null;
        }

        // --- NOUVEAU : Vérification de la réputation du capteur ---
        const sensorId = networkData.sensorId;
        const reputation = reputationService.getReputation(sensorId);
        if (reputation.level === 'Bronze') {
            console.log(`[Réponse Active] Menace détectée par un capteur de niveau Bronze. Action automatique suspendue pour vérification.`);
            return null;
        }

        const ipToBlock = networkData.sourceIP;
        if (!ipToBlock || blockedIPs.has(ipToBlock)) {
            return null; // IP déjà bloquée ou invalide
        }

        // Action : Bloquer l'adresse IP source (simulation)
        console.log(`🛡️ [ACTION] Blocage simulé de l'adresse IP: ${ipToBlock}`);
        blockedIPs.add(ipToBlock);

        // Simuler l'expiration du blocage après 5 minutes pour la démo
        setTimeout(() => {
            blockedIPs.delete(ipToBlock);
            console.log(`🛡️ [ACTION] Expiration du blocage pour l'IP: ${ipToBlock}`);
        }, 5 * 60 * 1000);

        const action = {
            action: 'BLOCK_IP',
            target: ipToBlock,
            reason: this._getFormattedReason(alertData),
            timestamp: Date.now(),
            simulated: true
        };

        return action;
    }

    /**
     * Retourne la liste des IPs actuellement bloquées.
     * @returns {string[]}
     */
    getBlockedIPs() {
        return Array.from(blockedIPs);
    }
}

module.exports = new ActiveResponseService();