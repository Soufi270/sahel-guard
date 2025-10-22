/**
 * active-response-service.js
 *
 * Gère les contre-mesures automatiques en réponse aux menaces détectées.
 * Pour le hackathon, ce service simule des actions comme le blocage d'IP.
 */

const blockedIPs = new Set();

class ActiveResponseService {
    constructor() {
        console.log('🛡️ Service de Réponse Active initialisé (simulation).');
    }

    /**
     * Exécute une contre-mesure basée sur les données de la menace.
     * @param {object} alertData - Les données de l'alerte.
     * @param {object} networkData - Les données réseau originales.
     * @returns {object|null} Un objet décrivant l'action prise, ou null si aucune action.
     */
    executeCounterMeasure(alertData, networkData) {
        // Décision : On n'agit que sur les menaces de sévérité 'high' ou 'critical'
        if (alertData.severity !== 'high' && alertData.severity !== 'critical') {
            console.log(`[Réponse Active] Menace de niveau '${alertData.severity}' ignorée, aucune action automatique.`);
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
            reason: `Menace de niveau '${alertData.severity}' détectée: ${alertData.description}`,
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