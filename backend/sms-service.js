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
        try {
            console.log(`📲 Tentative envoi via Vonage à ${phoneNumber}`);
            // Le numéro doit être au format E.164, mais sans le '+' pour le SDK Vonage
            const to = phoneNumber.replace('+', '');
            const from = this.senderNumber;
            const text = message;
            
            const response = await this.vonage.sms.send({ to, from, text });
            
            if (response.messages[0].status === '0') {
                console.log(`✅ SMS envoyé avec succès à ${to}`);
                return { success: true, provider: 'vonage', simulated: false };
            } else {
                const errorMessage = `Échec envoi SMS: ${response.messages[0]['error-text']}`;
                console.error(`❌ ${errorMessage}`);
                // Lancer une erreur pour que le bloc catch la gère
                throw new Error(errorMessage);
            }
        } catch (error) {
            // Si l'erreur vient du SDK, elle aura une propriété 'response'
            const errorMessage = error.response ? JSON.stringify(error.response.data) : error.message;
            console.error('❌ Erreur envoi Vonage:', errorMessage);
            throw error;
        }
    }

    // Méthode principale d'envoi SMS
    async sendAlertSms(alertData, phoneNumbers) {
        if (!this.isConfigured) {
            console.log('⚠️ Service SMS désactivé');
            return { sent: 0, skipped: phoneNumbers.length };
        }

        if (!phoneNumbers || phoneNumbers.length === 0) {
            console.log('⚠️ Aucun numéro à notifier');
            return { sent: 0, skipped: 0 };
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
        // Nettoyage du numéro
        let cleaned = phoneNumber.replace(/\D/g, '');
        
        // Si le numéro commence par 0, le convertir en format international
        if (cleaned.startsWith('0')) {
            cleaned = '223' + cleaned.substring(1);
        }
        
        // Si le numéro n'a pas l'indicatif, l'ajouter
        if (!cleaned.startsWith('223')) {
            cleaned = '223' + cleaned;
        }
        
        return '+' + cleaned;
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