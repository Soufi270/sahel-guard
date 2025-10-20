const { Vonage } = require('@vonage/server-sdk');
const { TwilioSmsService } = require('./sms-service-twilio');

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
    async send(phoneNumber, message) {
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
                const errorDetails = response.messages[0];
                const errorMessage = `Échec envoi SMS (Code: ${errorDetails.status}) - ${errorDetails['error-text']}`;
                throw new Error(errorMessage);
            }
        } catch (error) {
            // Si l'erreur vient du SDK, elle aura une propriété 'response'
            let errorMessage = error.message;
            if (error.response && error.response.data) {
                errorMessage = JSON.stringify(error.response.data);
            }
            // On relance une erreur qui sera capturée par le SmsManager
            // et qui contiendra le message détaillé.
            throw new Error(errorMessage);
        }
    }
}

/**
 * Classe principale qui gère les services SMS avec une logique de fallback.
 */
class SmsManager {
    constructor() {
        this.providers = [];
        const vonageService = new VonageSmsService();
        if (vonageService.isConfigured) {
            this.providers.push(vonageService);
        }
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
        const results = [];

        for (const phoneNumber of phoneNumbers) {
            const formattedNumber = this.formatMaliPhoneNumber(phoneNumber);
            let sent = false;
            for (const provider of this.providers) {
                try {
                    const result = await provider.send(formattedNumber, message);
                    results.push({ phoneNumber, ...result });
                    sent = true;
                    break; // Succès, on passe au numéro suivant
                } catch (error) {
                    console.error(`❌ Échec de l'envoi avec ${provider.constructor.name} à ${formattedNumber}: ${error.message}`);
                    // On ne fait rien, la boucle va essayer le prochain fournisseur
                }
            }
            if (!sent) {
                results.push({ phoneNumber, success: false, error: 'All SMS providers failed' });
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
        smsService = new SmsManager();
    }
    return smsService;
}

module.exports = {
    getSmsService
};