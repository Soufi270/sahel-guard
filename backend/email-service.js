const sgMail = require('@sendgrid/mail');

class EmailService {
    constructor() {
        this.isConfigured = false;
        this.senderEmail = process.env.EMAIL_SENDER_ADDRESS;

        if (process.env.SENDGRID_API_KEY && this.senderEmail) {
            sgMail.setApiKey(process.env.SENDGRID_API_KEY);
            this.isConfigured = true;
            console.log('📧 Service Email configuré avec SendGrid.');
        } else {
            console.warn('⚠️ Service Email non configuré (SENDGRID_API_KEY ou EMAIL_SENDER_ADDRESS manquant).');
        }
    }

    /**
     * Envoie un email d'alerte.
     * @param {object} alertData - Les données de l'alerte.
     * @param {string[]} recipientEmails - Liste des adresses email des destinataires.
     * @returns {Promise<object[]>} Résultats de l'envoi pour chaque destinataire.
     */
    async sendAlertEmail(alertData, recipientEmails) {
        if (!this.isConfigured) {
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
                const msg = {
                    to: email,
                    from: this.senderEmail,
                    subject: subject,
                    text: textBody,
                    html: htmlBody,
                };
                const [response, body] = await sgMail.send(msg); // Déstructuration de la réponse
                const messageId = response.headers['x-message-id']; // Récupération de l'ID du message
                console.log(`✅ Email envoyé avec succès à ${email}. Message ID: ${messageId}`);
                results.push({ email, success: true, messageId: messageId });
            } catch (error) {
                let detailedError = error.message;
                let statusCode = '';
                if (error.response && error.response.body && error.response.body.errors) {
                    // Log plus détaillé pour le débogage
                    console.error('SendGrid API Error Body:', JSON.stringify(error.response.body, null, 2));
                    detailedError = error.response.body.errors.map(e => e.message).join(', ');
                    statusCode = error.response.statusCode ? ` (Status: ${error.response.statusCode})` : '';
                }
                console.error(`❌ Échec de l'envoi d'email à ${email}: ${detailedError}${statusCode}`);
                results.push({ email, success: false, error: detailedError + statusCode });
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
            <p style="text-align: center; margin-top: 30px; font-size: 0.8em; color: #667;">
                Ceci est un message automatique. Pour ne plus recevoir ces alertes, <a href="<%asm_group_unsubscribe_url%>" style="color: #00aaff;">cliquez ici</a>.
            </p>
        </div>
        `;
    }

    /**
     * Envoie un email de synthèse regroupant plusieurs alertes.
     * @param {object[]} bufferedAlerts - Un tableau d'objets d'alerte.
     * @param {string[]} recipientEmails - Liste des adresses email des destinataires.
     * @returns {Promise<object>} Résultat de l'envoi.
     */
    async sendDigestEmail(bufferedAlerts, recipientEmails) {
        if (!this.isConfigured || bufferedAlerts.length === 0) {
            return { success: false, error: 'Service non configuré ou pas d\'alertes à envoyer.' };
        }

        const subject = `[SAHEL GUARD - SYNTHÈSE] ${bufferedAlerts.length} nouvelles alertes détectées`;
        const htmlBody = this.formatDigestHtmlBody(bufferedAlerts);
        const textBody = this.formatDigestTextBody(bufferedAlerts);

        try {
            console.log(`📧 Tentative d'envoi d'un email de synthèse à ${recipientEmails.join(', ')}`);
            const msg = {
                to: recipientEmails,
                from: this.senderEmail,
                subject: subject,
                text: textBody,
                html: htmlBody,
            };
            const [response, body] = await sgMail.send(msg); // Déstructuration de la réponse
            const messageId = response.headers['x-message-id']; // Récupération de l'ID du message
            console.log(`✅ Email de synthèse envoyé avec succès. Message ID: ${messageId}`);
            return { success: true, messageId: messageId, alertsSent: bufferedAlerts.length };
        } catch (error) {
            let detailedError = error.message;
            let statusCode = '';
            if (error.response && error.response.body && error.response.body.errors) {
                // Log plus détaillé pour le débogage
                console.error('SendGrid API Error Body:', JSON.stringify(error.response.body, null, 2));
                detailedError = error.response.body.errors.map(e => e.message).join(', ');
                statusCode = error.response.statusCode ? ` (Status: ${error.response.statusCode})` : '';
            }
            console.error(`❌ Échec de l'envoi de l'email de synthèse: ${detailedError}${statusCode}`);
            return { success: false, error: detailedError + statusCode };
        }
    }

    formatDigestTextBody(alerts) {
        let body = `
SYNTHÈSE DES ALERTES SAHEL GUARD
---------------------------------
${alerts.length} nouvelles alertes ont été détectées.

`;
        alerts.forEach((alert, index) => {
            body += `
Alerte #${index + 1}:
  - Type: ${alert.type}
  - Sévérité: ${alert.severity.toUpperCase()}
  - Source: ${alert.source}
  - Description: ${alert.description}
  - Timestamp: ${new Date(alert.timestamp).toLocaleString()}
`;
        });

        body += `

Pour plus de détails, consultez le tableau de bord SAHEL GUARD.
`;
        return body;
    }

    formatDigestHtmlBody(alerts) {
        const alertRows = alerts.map(alert => {
            const severityColor = { critical: '#ff3333', high: '#ffaa00', medium: '#00aaff', low: '#00ff7f' }[alert.severity] || '#cccccc';
            return `
                <tr>
                    <td style="padding: 8px; border: 1px solid rgba(0, 170, 255, 0.1); color: ${severityColor}; font-weight: bold;">${alert.severity.toUpperCase()}</td>
                    <td style="padding: 8px; border: 1px solid rgba(0, 170, 255, 0.1);">${alert.type}</td>
                    <td style="padding: 8px; border: 1px solid rgba(0, 170, 255, 0.1);">${alert.source}</td>
                    <td style="padding: 8px; border: 1px solid rgba(0, 170, 255, 0.1);">${new Date(alert.timestamp).toLocaleTimeString()}</td>
                </tr>
            `;
        }).join('');

        return `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #e0e0e0; background-color: #0a0a1a; padding: 20px; border-radius: 8px; border: 1px solid rgba(0, 170, 255, 0.2);">
            <h2 style="color: #ffaa00; border-bottom: 2px solid #ffaa00; padding-bottom: 10px;">SAHEL GUARD - Synthèse des Alertes</h2>
            <p style="font-size: 1.1em; margin-bottom: 15px;">${alerts.length} nouvelles menaces ont été détectées récemment.</p>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 0.9em;">
                <thead style="background-color: #10182c;"><tr><th style="padding: 10px; border: 1px solid rgba(0, 170, 255, 0.1);">Sévérité</th><th style="padding: 10px; border: 1px solid rgba(0, 170, 255, 0.1);">Type</th><th style="padding: 10px; border: 1px solid rgba(0, 170, 255, 0.1);">Source</th><th style="padding: 10px; border: 1px solid rgba(0, 170, 255, 0.1);">Heure</th></tr></thead>
                <tbody>${alertRows}</tbody>
            </table>
            <p style="margin-top: 20px; font-size: 0.9em; color: #8c9eba;">Pour une analyse détaillée, veuillez consulter votre tableau de bord SAHEL GUARD.</p><p style="text-align: center; margin-top: 30px; font-size: 0.8em; color: #667;">
                Pour ne plus recevoir ces alertes, <a href="<%asm_group_unsubscribe_url%>" style="color: #00aaff;">cliquez ici</a>.
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