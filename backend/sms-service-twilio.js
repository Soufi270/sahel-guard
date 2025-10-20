const twilio = require('twilio');

class TwilioSmsService {
    constructor() {
        this.accountSid = process.env.TWILIO_ACCOUNT_SID;
        this.authToken = process.env.TWILIO_AUTH_TOKEN;
        this.senderNumber = process.env.TWILIO_PHONE_NUMBER;
        this.client = null;

        if (this.accountSid && this.authToken && this.senderNumber) {
            this.isConfigured = true;
            this.client = twilio(this.accountSid, this.authToken);
            console.log('📱 Service SMS Twilio configuré et activé.');
        } else {
            this.isConfigured = false;
            console.log('⚠️ Service SMS Twilio non configuré (credentials manquants).');
        }
    }

    /**
     * Envoi d'un SMS via Twilio.
     * @param {string} phoneNumber - Numéro au format E.164 (ex: +223...)
     * @param {string} message - Le contenu du SMS.
     */
    async send(phoneNumber, message) {
        if (!this.isConfigured) {
            throw new Error("Twilio service is not configured.");
        }
        try {
            console.log(`📲 Tentative envoi via Twilio à ${phoneNumber}`);
            const response = await this.client.messages.create({
                body: message,
                from: this.senderNumber,
                to: phoneNumber
            });
            console.log(`✅ SMS envoyé avec succès via Twilio. SID: ${response.sid}`);
            return { success: true, provider: 'twilio', simulated: false, messageId: response.sid };
        } catch (error) {
            console.error('❌ Erreur envoi Twilio:', error.message);
            throw error;
        }
    }
}

module.exports = { TwilioSmsService };