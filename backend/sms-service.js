const { TwilioSmsService } = require('./sms-service-twilio');

/**
 * Classe principale qui gère les services SMS avec une logique de fallback.
 */
class SmsManager {
    constructor() {
        this.providers = [];
        const twilioService = new TwilioSmsService();
        if (twilioService.isConfigured) {
            this.providers.push(twilioService);
        }
        console.log(`📱 Gestionnaire SMS initialisé avec ${this.providers.length} fournisseur(s).`);
    }

    async sendAlertSms(alertData, phoneNumbers) {
        if (this.providers.length === 0) {
            console.log('⚠️ Aucun fournisseur SMS n\'est configuré. Aucun envoi.');
            return phoneNumbers.map(pn => ({ phoneNumber: pn, success: false, error: 'No SMS provider configured' }));
        }

        if (!phoneNumbers || phoneNumbers.length === 0) {
            console.log('⚠️ Aucun numéro à notifier.');
            return [];
        }

        const message = this.formatAlertMessage(alertData);
        const results = []; // Pour stocker les résultats de chaque numéro tenté

        // Utilise uniquement le premier numéro valide, comme demandé ("un seul numéro doit suffir")
        const primaryPhoneNumber = phoneNumbers.find(num => this.isValidMaliNumber(num));

        if (!primaryPhoneNumber) {
            console.warn('⚠️ Aucun numéro de téléphone malien valide trouvé pour l\'envoi de SMS.');
            return phoneNumbers.map(pn => ({ phoneNumber: pn, success: false, error: 'No valid Mali phone number found' }));
        }

        const formattedNumber = this.formatMaliPhoneNumber(primaryPhoneNumber);
        const provider = this.providers[0]; // Il ne devrait y avoir que Twilio maintenant

        try {
            const result = await provider.send(formattedNumber, message);
            results.push({ phoneNumber: primaryPhoneNumber, ...result });
        } catch (error) {
            const errorMessage = `Échec avec ${provider.constructor.name}: ${error.message}`;
            console.error(`❌ ${errorMessage} (pour le numéro ${formattedNumber})`);
            results.push({ phoneNumber: primaryPhoneNumber, success: false, error: errorMessage });
        }

        // Pour les autres numéros qui n'ont pas été traités (si l'array en contenait plusieurs)
        // on peut ajouter un message d'information ou d'erreur si nécessaire.
        // Pour l'instant, on se concentre sur le premier numéro valide.
        const otherNumbers = phoneNumbers.filter(num => num !== primaryPhoneNumber);
        for (const num of otherNumbers) {
            results.push({ phoneNumber: num, success: false, error: 'Only the first valid number is processed for SMS alerts.' });
        }
        return results;
    }
    
    // Formatage du message d'alerte
    formatAlertMessage(alertData) {
        // Message court et simple pour maximiser la délivrabilité.
        // On retire les emojis et les informations non essentielles.
        const level = alertData.severity.toUpperCase();
        const type = alertData.type;
        const source = alertData.source;
        // Tronquer la description pour s'assurer que le message reste court
        const description = alertData.description.substring(0, 50);

        return `ALERTE SAHEL GUARD (${level}): ${type} depuis ${source}. Desc: ${description}...`;
    }

    // Formatage des numéros maliens
    formatMaliPhoneNumber(phoneNumber) {
        // 1. Nettoyage de tout ce qui n'est pas un chiffre
        let cleaned = phoneNumber.replace(/\D/g, '');
        
        // 2. Gérer les préfixes internationaux (ex: 00223...)
        if (cleaned.startsWith('00223')) {
            cleaned = cleaned.substring(2); // Retire le '00' pour obtenir '223...'
        }
        
        // 3. Gérer les numéros locaux (ex: 06..., 07...)
        if (cleaned.length === 9 && cleaned.startsWith('0')) {
            cleaned = '223' + cleaned.substring(1); // Remplace le '0' par '223'
        }
        
        // 4. Si le numéro a 8 chiffres, on suppose que c'est un numéro malien sans indicatif
        if (cleaned.length === 8) {
            cleaned = '223' + cleaned; // Ajoute l'indicatif '223'
        }
        
        // 5. Retourne le numéro au format E.164
        return `+${cleaned}`;
    }

    // Vérification de la validité d'un numéro malien
    isValidMaliNumber(phoneNumber) {
        const cleaned = phoneNumber.replace(/\D/g, '');
        
        // Formats acceptés: 223XXXXXXXXX, 0XXXXXXXXX, XXXXXXXXX
        const regex = /^(223|0)?[67]\d{7}$/;
        return regex.test(cleaned);
    }
}

// Singleton du service SMS
let smsService = null;

function getSmsService() {
    if (!smsService) {
        smsService = new SmsManager();
    }
    return smsService;
}

module.exports = {
    getSmsService
};