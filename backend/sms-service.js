const axios = require('axios');

// Service SMS pour les opérateurs maliens
class MaliSmsService {
    constructor() {
        this.clientId = process.env.ORANGE_CLIENT_ID;
        this.clientSecret = process.env.ORANGE_CLIENT_SECRET;
        this.senderNumber = process.env.ORANGE_SENDER_NUMBER; // Le numéro fourni par Orange
        this.accessToken = null;
        this.tokenExpiresAt = 0;

        if (this.clientId && this.clientSecret && this.senderNumber) {
            this.isConfigured = true;
            console.log('📱 Service SMS Orange configuré et activé.');
        } else {
            this.isConfigured = false;
            console.log('⚠️ Service SMS non configuré (credentials Orange manquants).');
        }
    }

    // Obtenir un jeton d'accès auprès d'Orange
    async getAccessToken() {
        // Si le jeton existe et n'est pas expiré, on le réutilise
        if (this.accessToken && Date.now() < this.tokenExpiresAt) {
            return this.accessToken;
        }

        console.log('🔄 Obtention d\'un nouveau jeton d\'accès Orange...');
        const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
        const response = await axios.post('https://api.orange.com/oauth/v2/token', 'grant_type=client_credentials', {
            headers: {
                'Authorization': `Basic ${credentials}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        this.accessToken = response.data.access_token;
        // On garde le jeton valide pour un peu moins longtemps que sa durée de vie réelle pour être sûr
        this.tokenExpiresAt = Date.now() + (response.data.expires_in - 60) * 1000;
        console.log('✅ Jeton d\'accès Orange obtenu.');
        return this.accessToken;
    }

    // Envoi réel via Orange Mali 
    async sendViaOrange(phoneNumber, message) {
        try {
            const token = await this.getAccessToken();
            console.log(`📲 Tentative envoi via Orange Mali à ${phoneNumber}`);

            const senderAddress = `tel:+${this.senderNumber.replace(/\D/g, '')}`;
            const url = `https://api.orange.com/smsmessaging/v1/outbound/${encodeURIComponent(senderAddress)}/requests`;

            const body = {
                outboundSMSMessageRequest: {
                    address: `tel:${phoneNumber}`,
                    senderAddress: senderAddress,
                    outboundSMSTextMessage: {
                        message: message
                    }
                }
            };

            await axios.post(url, body, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            return { success: true, provider: 'orange', simulated: false };
        } catch (error) {
            console.error('❌ Erreur envoi Orange:', error.response ? error.response.data : error.message);
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
                const result = await this.sendViaOrange(formattedNumber, message);
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
        smsService = new MaliSmsService();
    }
    return smsService;
}

module.exports = {
    getSmsService,
    MaliSmsService
};