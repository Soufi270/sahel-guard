const nodemailer = require('nodemailer');

class EmailService {
    constructor() {
        this.transporter = null;
        this.senderEmail = process.env.EMAIL_SENDER_ADDRESS;

        if (process.env.EMAIL_HOST && process.env.EMAIL_PORT && process.env.EMAIL_USER && process.env.EMAIL_PASS && this.senderEmail) {
            this.transporter = nodemailer.createTransport({
                host: process.env.EMAIL_HOST,
                port: parseInt(process.env.EMAIL_PORT, 10),
                secure: process.env.EMAIL_SECURE === 'true', // Use 'true' or 'false' in .env
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASS,
                },
            });
            console.log('📧 Service Email configuré et activé.');
        } else {
            console.warn('⚠️ Service Email non configuré (variables d\'environnement manquantes pour Nodemailer).');
        }
    }

    isConfigured() {
        return this.transporter !== null;
    }

    /**
     * Envoie un email d'alerte.
     * @param {object} alertData - Les données de l'alerte.
     * @param {string[]} recipientEmails - Liste des adresses email des destinataires.
     * @returns {Promise<object[]>} Résultats de l'envoi pour chaque destinataire.
     */
    async sendAlertEmail(alertData, recipientEmails) {
        if (!this.isConfigured()) {
            console.error('❌ Impossible d\'envoyer l\'email: le service n\'est pas configuré.');
            return recipientEmails.map(email => ({ email, success: false, error: 'Email service not configured' }));
        }

        if (!recipientEmails || recipientEmails.length === 0) {
            console.warn('⚠️ Aucune adresse email de destinataire fournie.');
            return [];
        }

        const subject = this.formatAlertSubject(alertData);
        const htmlBody = this.formatAlertHtmlBody(alertData);
        const textBody = this.formatAlertTextBody(alertData);

        const results = [];
        for (const email of recipientEmails) {
            try {
                console.log(`📧 Tentative d'envoi d'email à ${email}`);
                const info = await this.transporter.sendMail({
                    from: this.senderEmail,
                    to: email,
                    subject: subject,
                    text: textBody,
                    html: htmlBody,
                });
                console.log(`✅ Email envoyé avec succès à ${email}. Message ID: ${info.messageId}`);
                results.push({ email, success: true, messageId: info.messageId });
            } catch (error) {
                console.error(`❌ Échec de l'envoi d'email à ${email}: ${error.message}`);
                results.push({ email, success: false, error: error.message });
            }
        }
        return results;
    }

    formatAlertSubject(alertData) {
        return `[SAHEL GUARD - ALERTE ${alertData.severity.toUpperCase()}] ${alertData.type} depuis ${alertData.source}`;
    }

    formatAlertTextBody(alertData) {
        return `
        ALERTE SAHEL GUARD
        ------------------
        Type: ${alertData.type}
        Sévérité: ${alertData.severity.toUpperCase()}
        Source: ${alertData.source}
        Description: ${alertData.description}
        Confiance: ${alertData.confidence ? (alertData.confidence * 100).toFixed(0) + '%' : 'N/A'}
        Localisation: ${alertData.location}
        Timestamp: ${new Date(alertData.timestamp).toLocaleString()}

        ${alertData.aiAnalysis?.prediction?.isPredicted ? `
        Prédiction IA:
        Type: ${alertData.aiAnalysis.prediction.predictionType}
        Raison: ${alertData.aiAnalysis.prediction.reason}
        Confiance: ${alertData.aiAnalysis.prediction.predictionConfidence}%
        ` : ''}

        Pour plus de détails, consultez le tableau de bord SAHEL GUARD.
        `;
    }

    formatAlertHtmlBody(alertData) {
        const severityColor = {
            critical: '#ff3333',
            high: '#ffaa00',
            medium: '#00aaff',
            low: '#00ff7f'
        }[alertData.severity] || '#cccccc';

        return `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #e0e0e0; background-color: #0a0a1a; padding: 20px; border-radius: 8px; border: 1px solid rgba(0, 170, 255, 0.2);">
            <h2 style="color: ${severityColor}; border-bottom: 2px solid ${severityColor}; padding-bottom: 10px;">
                <i class="fas fa-shield-alt" style="margin-right: 10px;"></i> SAHEL GUARD - ALERTE DE SÉCURITÉ
            </h2>
            <p style="font-size: 1.1em; margin-bottom: 15px;">Une nouvelle menace a été détectée par votre système SAHEL GUARD.</p>

            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                <tr><td style="padding: 8px; border: 1px solid rgba(0, 170, 255, 0.1); background-color: #10182c;"><strong>Type de Menace:</strong></td><td style="padding: 8px; border: 1px solid rgba(0, 170, 255, 0.1);">${alertData.type}</td></tr>
                <tr><td style="padding: 8px; border: 1px solid rgba(0, 170, 255, 0.1); background-color: #10182c;"><strong>Sévérité:</strong></td><td style="padding: 8px; border: 1px solid rgba(0, 170, 255, 0.1); color: ${severityColor}; font-weight: bold;">${alertData.severity.toUpperCase()}</td></tr>
                <tr><td style="padding: 8px; border: 1px solid rgba(0, 170, 255, 0.1); background-color: #10182c;"><strong>Source:</strong></td><td style="padding: 8px; border: 1px solid rgba(0, 170, 255, 0.1);">${alertData.source}</td></tr>
                <tr><td style="padding: 8px; border: 1px solid rgba(0, 170, 255, 0.1); background-color: #10182c;"><strong>Description:</strong></td><td style="padding: 8px; border: 1px solid rgba(0, 170, 255, 0.1);">${alertData.description}</td></tr>
                <tr><td style="padding: 8px; border: 1px solid rgba(0, 170, 255, 0.1); background-color: #10182c;"><strong>Confiance:</strong></td><td style="padding: 8px; border: 1px solid rgba(0, 170, 255, 0.1);">${alertData.confidence ? (alertData.confidence * 100).toFixed(0) + '%' : 'N/A'}</td></tr>
                <tr><td style="padding: 8px; border: 1px solid rgba(0, 170, 255, 0.1); background-color: #10182c;"><strong>Localisation:</strong></td><td style="padding: 8px; border: 1px solid rgba(0, 170, 255, 0.1);">${alertData.location}</td></tr>
                <tr><td style="padding: 8px; border: 1px solid rgba(0, 170, 255, 0.1); background-color: #10182c;"><strong>Timestamp:</strong></td><td style="padding: 8px; border: 1px solid rgba(0, 170, 255, 0.1);">${new Date(alertData.timestamp).toLocaleString()}</td></tr>
            </table>

            ${alertData.aiAnalysis?.prediction?.isPredicted ? `
            <h3 style="color: #00aaff; border-bottom: 1px solid rgba(0, 170, 255, 0.2); padding-bottom: 5px; margin-top: 20px;">Prédiction de l'IA</h3>
            <p><strong>Type de Prédiction:</strong> ${alertData.aiAnalysis.prediction.predictionType}</p>
            <p><strong>Raison:</strong> ${alertData.aiAnalysis.prediction.reason}</p>
            <p><strong>Confiance:</strong> ${alertData.aiAnalysis.prediction.predictionConfidence}%</p>
            ` : ''}

            <p style="margin-top: 20px; font-size: 0.9em; color: #8c9eba;">
                Pour une analyse plus approfondie et des actions correctives, veuillez consulter votre tableau de bord SAHEL GUARD.
            </p>
            <p style="text-align: center; margin-top: 30px; font-size: 0.8em; color: #555;">
                Ceci est un message automatique. Veuillez ne pas y répondre.
            </p>
        </div>
        `;
    }
}

let emailServiceInstance = null;

function getEmailService() {
    if (!emailServiceInstance) {
        emailServiceInstance = new EmailService();
    }
    return emailServiceInstance;
}

module.exports = {
    getEmailService
};