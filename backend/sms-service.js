const axios = require('axios');

// Service SMS pour les opérateurs maliens
class MaliSmsService {
    constructor() {
        this.providers = {
            orange: {
                name: 'Orange Mali',
                apiUrl: 'https://api.orange.com/smsmessaging/v1/outbound/',
                // Vous devrez obtenir ces credentials sur le portail développeur Orange
                clientId: process.env.ORANGE_CLIENT_ID,
                clientSecret: process.env.ORANGE_CLIENT_SECRET
            },
            malitel: {
                name: 'Malitel',
                apiUrl: 'https://api.malitel.ml/sms/send',
                // Credentials Malitel (à configurer)
                username: process.env.MALITEL_USERNAME,
                password: process.env.MALITEL_PASSWORD
            }
        };
        
        this.isEnabled = process.env.SMS_ENABLED === 'true';
        console.log(`📱 Service SMS ${this.isEnabled ? 'activé' : 'désactivé'}`);
    }

    // Simulation d'envoi SMS (pour le prototype)
    async sendSmsSimulation(phoneNumber, message) {
        console.log(`📲 [SIMULATION] SMS à ${phoneNumber}: ${message}`);
        return {
            success: true,
            provider: 'simulation',
            messageId: 'sim-' + Date.now(),
            simulated: true
        };
    }

    // Envoi réel via Orange Mali (à configurer avec de vraies credentials)
    async sendViaOrange(phoneNumber, message) {
        try {
            // Note: Cette implémentation nécessite un compte développeur Orange
            console.log(`📲 Tentative envoi via Orange Mali à ${phoneNumber}`);
            
            // Ici viendrait le vrai code d'intégration API Orange
            // Pour l'instant, on simule pour éviter les erreurs
            return await this.sendSmsSimulation(phoneNumber, `[ORANGE] ${message}`);
            
        } catch (error) {
            console.error('❌ Erreur envoi Orange:', error);
            throw error;
        }
    }

    // Envoi réel via Malitel (à configurer)
    async sendViaMalitel(phoneNumber, message) {
        try {
            console.log(`📲 Tentative envoi via Malitel à ${phoneNumber}`);
            
            // Simulation pour le prototype
            return await this.sendSmsSimulation(phoneNumber, `[MALITEL] ${message}`);
            
        } catch (error) {
            console.error('❌ Erreur envoi Malitel:', error);
            throw error;
        }
    }

    // Méthode principale d'envoi SMS
    async sendAlertSms(alertData, phoneNumbers) {
        if (!this.isEnabled) {
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
                
                // Tentative d'envoi (priorité à Orange, puis Malitel)
                let result;
                try {
                    result = await this.sendViaOrange(formattedNumber, message);
                } catch (orangeError) {
                    console.log('🔁 Fallback vers Malitel...');
                    result = await this.sendViaMalitel(formattedNumber, message);
                }
                
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