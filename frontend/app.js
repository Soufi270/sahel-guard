// Connexion au serveur WebSocket
const socket = io();

// Éléments DOM
const hederaStatusElement = document.getElementById('hedera-status');
const topicIdElement = document.getElementById('topic-id');
const tokenStatusElement = document.getElementById('token-status');
const smsStatusElement = document.getElementById('sms-status');
const aiStatusElement = document.getElementById('ai-status');
const alertsListElement = document.getElementById('alerts-list');
const rewardsListElement = document.getElementById('rewards-list');
const alertForm = document.getElementById('alert-form');
const totalAlertsElement = document.getElementById('total-alerts');
const totalRewardsElement = document.getElementById('total-rewards');
const totalAlertsCard = document.getElementById('total-alerts-card');
const totalRewardsCard = document.getElementById('total-rewards-card');

// Variables globales
let totalAlerts = 0;
let totalRewards = 0;

// Écoute des événements WebSocket
socket.on('connect', () => {
    console.log('Connecté au serveur');
    updateStatus(hederaStatusElement, 'Connecté', 'connected');
    updateStatus(aiStatusElement, 'Active', 'connected');
    updateStatus(smsStatusElement, 'Actif', 'connected');
});

socket.on('disconnect', () => {
    console.log('Déconnecté du serveur');
    updateStatus(hederaStatusElement, 'Déconnecté', 'disconnected');
    updateStatus(aiStatusElement, 'Inactive', 'disconnected');
    updateStatus(smsStatusElement, 'Inactif', 'disconnected');
});

socket.on('topic-info', (data) => {
    [topicIdElement, document.getElementById('hcs-topic-id')].forEach(el => el.textContent = data.topicId);
});

socket.on('token-info', (data) => {
    tokenStatusElement.textContent = data.status;
});

socket.on('new-alert', (alertData) => {
    console.log('Nouvelle alerte reçue:', alertData);
    addAlertToUI(alertData);
});

socket.on('reward-distributed', (rewardData) => {
    console.log('🎉 Récompense reçue:', rewardData);
    handleRewardNotification(rewardData);
});

socket.on('sms-sent', (smsData) => {
    console.log('📱 Notification SMS reçue:', smsData);
    addSmsToUI(smsData);
});

socket.on('hcs-log-entry', (logData) => {
    addHcsLogToUI(logData);
});

socket.on('new-signature', (signatureData) => {
    addSignatureToUI(signatureData);
});

// --- Gestion des historiques ---
socket.on('log-history', (history) => {
    const list = document.getElementById('hcs-log-list');
    if (list) list.innerHTML = '';
    history.forEach(log => addHcsLogToUI(log, false));
});
socket.on('signature-log-history', (history) => {
    const list = document.getElementById('signatures-log-list');
    if (list) list.innerHTML = '';
    history.forEach(log => addSignatureToUI(log, false));
});
socket.on('sms-log-history', (history) => {
    const list = document.getElementById('sms-list');
    if (list) list.innerHTML = '';
    history.forEach(log => addSmsToUI(log, false));
});
socket.on('rewards-log-history', (history) => {
    const list = document.getElementById('rewards-list');
    if (list) list.innerHTML = '';
    history.forEach(log => addRewardToUI(log, false));
});

// Gestion de l'envoi du formulaire
alertForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = {
        type: document.getElementById('alert-type').value,
        severity: document.getElementById('alert-severity').value,
        source: document.getElementById('alert-source').value,
        description: document.getElementById('alert-description').value,
        location: 'Mali'
    };
    
    try {
        const response = await fetch('/api/alert', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            console.log('Alerte envoyée avec succès:', result);
            alertForm.reset();
        } else {
            console.error('Erreur lors de l\'envoi:', result.error);
            alert('Erreur: ' + result.error);
        }
    } catch (error) {
        console.error('Erreur:', error);
        alert('Une erreur s\'est produite lors de l\'envoi de l\'alerte');
    }
});

// Fonction pour ajouter une alerte à l'interface
function addAlertToUI(alertData, animate = true) {
    totalAlerts++;
    updateStats();
    
    // Créer un nouvel élément d'alerte
    const alertElement = document.createElement('div');
    alertElement.className = `alert-item ${alertData.severity} ${animate ? 'slide-in' : ''}`;
    
    // Formater la date
    const date = new Date(alertData.timestamp || Date.now());
    const formattedDate = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
    
    // Déterminer l'icône, le titre et les couleurs
    let icon, title, bgColor, iconColor;
    switch(alertData.type) {
        case 'phishing':
            icon = '📧';
            title = 'Tentative de Phishing';
            break;
        case 'ddos':
            icon = '🌐';
            title = 'Attaque DDoS';
            break;
        case 'intrusion':
            icon = '🚨';
            title = 'Intrusion Réseau';
            break;
        case 'malware':
            icon = '🦠';
            title = 'Malware Détecté';
            break;
        case 'reward':
            icon = '🎉';
            title = 'Récompense';
            break;
        default:
            icon = '⚠️';
            title = 'Alerte de Sécurité';
    }
    
    // Logique de couleur basée sur la sévérité
    const severityColors = { critical: '#ff3333', high: '#ffaa00', medium: '#00aaff', low: '#00ff7f', reward: '#9b59b6' };
    iconColor = severityColors[alertData.severity] || severityColors.medium;
    bgColor = `${iconColor}33`; // Ajoute de la transparence

    alertElement.innerHTML = `
        <div class="alert-icon" style="background: ${bgColor}; color: ${iconColor};">
            <i class="fas fa-${icon === '📧' ? 'envelope' : (icon === '🌐' ? 'globe' : (icon === '🚨' ? 'shield-alt' : (icon === '🦠' ? 'virus' : 'exclamation-triangle')))}"></i>
        </div>
        <div class="alert-content">
            <div class="alert-title">${title}</div>
            <div class="alert-desc">${alertData.description || 'Aucune description fournie'}</div>
            <div class="alert-meta">
                <span class="alert-time"><i class="fas fa-clock"></i> ${formattedDate}</span>
                <span class="alert-severity"><i class="fas fa-signal"></i> Niveau: ${alertData.severity}</span>
                ${alertData.source ? `<span class="alert-source"><i class="fas fa-network-wired"></i> Source: ${alertData.source}</span>` : ''}
            </div>
        </div>
    `;
    
    // Ajouter l'alerte en haut de la liste
    if (alertsListElement) {
        alertsListElement.insertBefore(alertElement, alertsListElement.firstChild);
        
        // Limiter à 10 alertes affichées
        if (alertsListElement.children.length > 10) {
            alertsListElement.removeChild(alertsListElement.lastChild);
        }
    }
}

// Fonction pour gérer les notifications de récompense
function handleRewardNotification(rewardData) {
     totalRewards += rewardData.amount;
     updateStats();
     addRewardToUI(rewardData);
}

function addRewardToUI(rewardData, animate = true) {
    const rewardElement = document.createElement('div');
    rewardElement.className = `reward-item ${animate ? 'slide-in' : ''}`;

    rewardElement.innerHTML = `
        <div class="reward-icon"><i class="fas fa-coins"></i></div>
        <div class="reward-content">
            <div class="reward-title">Récompense Distribuée</div>
            <div class="reward-details">
                <div class="reward-detail"><span>Montant:</span> ${rewardData.amount} HBAR</div>
                <div class="reward-detail"><span>À:</span> ${rewardData.recipient}</div>
                <div class="reward-detail"><span>Raison:</span> ${rewardData.reason}</div>
                <div class="reward-detail"><span>Statut:</span> ${rewardData.simulated ? 'Simulation' : 'Réussi'}</div>
            </div>
            <div class="alert-meta"><span class="alert-time"><i class="fas fa-clock"></i> ${new Date().toLocaleString('fr-FR')}</span></div>
        </div>
    `;

    if (rewardsListElement) {
        rewardsListElement.insertBefore(rewardElement, rewardsListElement.firstChild);
        if (rewardsListElement.children.length > 10) {
            rewardsListElement.removeChild(rewardsListElement.lastChild);
        }
    }
    
    // Ajouter également comme une alerte normale
    addAlertToUI({
        type: 'reward', severity: 'reward', source: 'Système de Récompenses',
        description: `Distribution de ${rewardData.amount} HBAR à ${rewardData.recipient}`,
        timestamp: Date.now()
    });
}

// Chargement initial: récupérer les infos du topic et du token
async function loadInitialData() {
    try {
        // Récupérer les infos du topic
        const topicResponse = await fetch('/api/topic-info');
        const topicData = await topicResponse.json();
        
        [topicIdElement, document.getElementById('hcs-topic-id')].forEach(el => el.textContent = topicData.topicId);
        updateStatus(hederaStatusElement, topicData.status === 'Actif' ? 'Connecté' : 'Déconnecté', topicData.status === 'Actif' ? 'connected' : 'disconnected');
        
        // Récupérer les infos du token
        const tokenResponse = await fetch('/api/token-info');
        const tokenData = await tokenResponse.json();
        tokenStatusElement.textContent = tokenData.status;
        
    } catch (error) {
        console.error('Erreur lors du chargement des données initiales:', error);
        hederaStatusElement.textContent = 'Erreur';
        hederaStatusElement.style.color = 'red';
        tokenStatusElement.textContent = 'Erreur';
    }
}

// Initialisation au chargement de la page
document.addEventListener('DOMContentLoaded', () => {
    console.log('Page SAHEL GUARD initialisée');
    loadInitialData();
    
    // Mettre à jour les stats initiales
    updateStats();
});

// Gestion des erreurs globales
window.addEventListener('error', (event) => {
    console.error('Erreur globale:', event.error);
});

// --- Fonctions utilitaires pour l'UI ---

function updateStatus(element, text, statusClass) {
    if (element) {
        element.textContent = text;
        element.className = `status-value ${statusClass}`;
    }
}

function updateStats() {
    animateCount(totalAlertsElement, totalAlerts);
    animateCount(totalAlertsCard, totalAlerts);
    animateCount(totalRewardsElement, Math.round(totalRewards));
    animateCount(totalRewardsCard, Math.round(totalRewards));
}

function animateCount(element, targetValue) {
    if (!element) return;
    const startValue = parseInt(element.textContent.replace(/,/g, '')) || 0;
    const duration = 1000;
    let startTime = null;

    function animation(currentTime) {
        if (startTime === null) startTime = currentTime;
        const progress = Math.min((currentTime - startTime) / duration, 1);
        const currentValue = Math.floor(progress * (targetValue - startValue) + startValue);
        element.textContent = currentValue.toLocaleString('fr-FR');
        if (progress < 1) requestAnimationFrame(animation);
    }
    requestAnimationFrame(animation);
}

function addSmsToUI(smsData, animate = true) {
    const list = document.getElementById('sms-list');
    if (!list) return;
    const item = document.createElement('div');
    item.className = `sms-item ${animate ? 'slide-in' : ''}`;
    const successfulSends = smsData.smsResults.filter(r => r.success).length;
    item.innerHTML = `
        <div class="sms-icon"><i class="fas fa-mobile-alt"></i></div>
        <div class="sms-content">
            <div class="sms-title">Notification SMS envoyée</div>
            <div class="sms-details">
                <div class="sms-detail"><span>Type:</span> ${smsData.alertData.type}</div>
                <div class="sms-detail"><span>Niveau:</span> ${smsData.alertData.severity}</div>
                <div class="sms-detail"><span>Destinataires:</span> ${successfulSends}/${smsData.smsResults.length}</div>
                <div class="sms-detail"><span>Statut:</span> ${smsData.smsResults[0]?.simulated ? 'Simulation' : 'Réel'}</div>
            </div>
            <div class="alert-meta"><span class="alert-time"><i class="fas fa-clock"></i> ${new Date().toLocaleString('fr-FR')}</span></div>
        </div>`;
    list.insertBefore(item, list.firstChild);
    if (list.children.length > 10) list.removeChild(list.lastChild);
}

function addHcsLogToUI(logData, animate = true) {
    const list = document.getElementById('hcs-log-list');
    if (!list) return;
    const item = document.createElement('div');
    item.className = `hcs-log-item ${animate ? 'slide-in' : ''}`;
    const formattedDate = new Date(logData.timestamp || Date.now()).toLocaleTimeString('fr-FR');
    const message = JSON.stringify({ type: logData.type, severity: logData.severity, source: logData.source });
    item.innerHTML = `<span class="log-time">[${formattedDate}]</span> <span class="log-type">${logData.type}</span> <span class="log-message">${message}</span>`;
    list.insertBefore(item, list.firstChild);
    if (list.children.length > 50) list.removeChild(list.lastChild);
}

function addSignatureToUI(signatureData, animate = true) {
    const list = document.getElementById('signatures-log-list');
    if (!list) return;
    const item = document.createElement('div');
    item.className = `hcs-log-item ${animate ? 'slide-in' : ''}`;
    const formattedDate = new Date(signatureData.timestamp || Date.now()).toLocaleTimeString('fr-FR');
    const message = JSON.stringify({ type: signatureData.threatType, pattern: signatureData.sourcePattern });
    item.innerHTML = `<span class="log-time">[${formattedDate}]</span> <span class="log-type">NOUVELLE SIGNATURE</span> <span class="log-message">${message}</span>`;
    list.insertBefore(item, list.firstChild);
    if (list.children.length > 50) list.removeChild(list.lastChild);
}