const { Vonage } = require('@vonage/server-sdk');

// Service SMS utilisant Vonage
class VonageSmsService {
    constructor() {
        this.apiKey = process.env.VONAGE_API_KEY;
        this.apiSecret = process.env.VONAGE_API_SECRET;
        this.senderNumber = process.env.VONAGE_SENDER_NUMBER; // Le numéro fourni par Vonage
        this.vonage = null;

        if (this.apiKey && this.apiSecret && this.senderNumber) {
            this.isConfigured = true;
            this.vonage = new Vonage({
                apiKey: this.apiKey,
                apiSecret: this.apiSecret
            });
            console.log('📱 Service SMS Vonage configuré et activé.');
        } else {
            this.isConfigured = false;
            console.log('⚠️ Service SMS non configuré (credentials Vonage manquants).');
        }
    }

    // Envoi réel via Vonage
    async sendViaVonage(phoneNumber, message) {
        // La vérification est déjà faite dans sendAlertSms via isConfigured
        try {
            console.log(`📲 Tentative envoi via Vonage à ${phoneNumber}`);
            // Le numéro doit être au format E.164 complet (avec le '+') pour le SDK Vonage.
            const to = phoneNumber;
            const from = this.senderNumber;
            const text = message;
            
            const response = await this.vonage.sms.send({ to, from, text });
            
            if (response.messages[0].status === '0') {
                console.log(`✅ SMS envoyé avec succès à ${to}`);
                return { success: true, provider: 'vonage', simulated: false };
            } else {
                // Affiche le message d'erreur spécifique retourné par l'API Vonage
                const errorMessage = `Échec envoi SMS (${response.messages[0].status}): ${response.messages[0]['error-text']}`;
                console.error(`❌ ${errorMessage}`);
                throw new Error(errorMessage); // Lancer une erreur pour que le bloc catch la gère
            }
        } catch (error) {
            // Si l'erreur vient du SDK, elle aura une propriété 'response'
            let errorMessage = error.message;
            if (error.response && error.response.data) {
                errorMessage = JSON.stringify(error.response.data);
            }
            console.error('❌ Erreur envoi Vonage:', errorMessage);
            throw error;
        }
    }

    // Méthode principale d'envoi SMS
    async sendAlertSms(alertData, phoneNumbers) {
        if (!this.isConfigured) {
            console.log('⚠️ Service SMS désactivé, aucun envoi.');
            return phoneNumbers.map(phoneNumber => ({ phoneNumber, success: false, error: 'Service SMS désactivé' }));
        }

        if (!phoneNumbers || phoneNumbers.length === 0) {
            console.log('⚠️ Aucun numéro à notifier');
            return [];
        }

        const message = this.formatAlertMessage(alertData);
        const results = [];

        for (const phoneNumber of phoneNumbers) {
            try {
                // Formatage du numéro pour le Mali
                const formattedNumber = this.formatMaliPhoneNumber(phoneNumber);
                const result = await this.sendViaVonage(formattedNumber, message);
                results.push({ phoneNumber, success: true, ...result });
            } catch (error) {
                console.error(`❌ Échec envoi à ${phoneNumber}:`, error.message);
                results.push({ phoneNumber, success: false, error: error.message });
            }
        }

        return results;
    }

    // Formatage du message d'alerte
    formatAlertMessage(alertData) {
        const emojis = {
            high: '🚨',
            critical: '🔥',
            medium: '⚠️',
            low: '📋'
        };

        const emoji = emojis[alertData.severity] || '⚠️';
        
        return `${emoji} ALERTE SAHEL GUARD ${emoji}
        
Type: ${alertData.type}
Niveau: ${alertData.severity.toUpperCase()}
Source: ${alertData.source}
Lieu: ${alertData.location}

${alertData.description}

🕒 ${new Date().toLocaleString('fr-FR')}

➡️ Contacter l'admin réseau si nécessaire`;
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
        smsService = new VonageSmsService();
    }
    return smsService;
}

module.exports = {
    getSmsService,
    VonageSmsService
};