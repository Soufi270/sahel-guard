// Connexion au serveur WebSocket
const socket = io();

// Éléments DOM
const hederaStatusElement = document.getElementById('hedera-status');
const topicIdElement = document.getElementById('topic-id');
const tokenStatusElement = document.getElementById('token-status');
const tokenStatusTextElement = document.getElementById('token-status-text');
const alertsListElement = document.getElementById('alerts-list');
const rewardsListElement = document.getElementById('rewards-list');
const noAlertsElement = document.getElementById('no-alerts');
const noRewardsElement = document.getElementById('no-rewards');
const alertForm = document.getElementById('alert-form');
const totalAlertsElement = document.getElementById('total-alerts');
const totalRewardsElement = document.getElementById('total-rewards');
const rewardsCountElement = document.getElementById('rewards-count');

// Variables globales
let totalAlerts = 0;
let totalRewards = 0;

// Écoute des événements WebSocket
socket.on('connect', () => {
    console.log('Connecté au serveur');
    hederaStatusElement.textContent = 'Connecté';
    hederaStatusElement.style.color = 'green';
});

socket.on('disconnect', () => {
    console.log('Déconnecté du serveur');
    hederaStatusElement.textContent = 'Déconnecté';
    hederaStatusElement.style.color = 'red';
});

socket.on('topic-info', (data) => {
    topicIdElement.textContent = data.topicId;
});

socket.on('token-info', (data) => {
    tokenStatusElement.textContent = data.status;
    tokenStatusTextElement.textContent = data.status;
    if (data.message) {
        tokenStatusTextElement.textContent += ' - ' + data.message;
    }
});

socket.on('new-alert', (alertData) => {
    console.log('Nouvelle alerte reçue:', alertData);
    addAlertToUI(alertData);
    addHcsLogToUI(alertData);
});

socket.on('reward-distributed', (rewardData) => {
    console.log('🎉 Récompense reçue:', rewardData);
    handleRewardNotification(rewardData);
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
    
    // Masquer le message "Aucune alerte"
    if (noAlertsElement) {
        noAlertsElement.style.display = 'none';
    }
    
    // Créer un nouvel élément d'alerte
    const alertElement = document.createElement('li');
    alertElement.className = `alert ${alertData.severity}`;
    
    // Formater la date
    const date = new Date(alertData.timestamp || Date.now());
    const formattedDate = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
    
    // Déterminer l'icône et le titre en fonction du type
    let icon, title;
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
            icon = '🚨'; // Correction de l'icône
            title = 'Intrusion Réseau';
            break;
        case 'malware':
            icon = '🦠';
            title = 'Malware Détecté';
            break;
        case 'reward':
            icon = '🎉';
            title = 'Récompense Distribuée';
            break;
        default:
            icon = '⚠️';
            title = 'Alerte de Sécurité';
    }
    
    alertElement.innerHTML = `
        <h3>${icon} ${title}</h3>
        <p><strong>Source:</strong> ${alertData.source}</p>
        <p><strong>Niveau:</strong> ${alertData.severity}</p>
        <p>${alertData.description || 'Aucune description fournie'}</p>
        <p class="timestamp">${formattedDate}</p>
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
    totalRewards++;
    updateStats();
    
    if (rewardsCountElement) {
        rewardsCountElement.textContent = totalRewards;
    }
    
    // Créer un élément de récompense
    const rewardElement = document.createElement('li');
    rewardElement.className = 'reward-item';
    
    rewardElement.innerHTML = `
        <h4>🎉 Récompense Distribuée</h4>
        <div class="reward-details">
            <div><span>Montant:</span> ${rewardData.amount} SAHEL</div>
            <div><span>À:</span> ${rewardData.recipient}</div>
            <div><span>Raison:</span> ${rewardData.reason}</div>
            <div><span>Statut:</span> ${rewardData.simulated ? 'Simulation' : 'Réussi'}</div>
        </div>
        <p class="timestamp">${new Date().toLocaleString('fr-FR')}</p>
    `;
    
    // Ajouter à la liste des récompenses
    if (noRewardsElement) {
        noRewardsElement.style.display = 'none';
    }
    
    if (rewardsListElement) {
        rewardsListElement.insertBefore(rewardElement, rewardsListElement.firstChild);
        
        // Limiter à 10 récompenses affichées
        if (rewardsListElement.children.length > 10) {
            rewardsListElement.removeChild(rewardsListElement.lastChild);
        }
    }
    
    // Ajouter également comme une alerte normale
    addAlertToUI({
        type: 'reward',
        severity: 'low',
        source: 'Système de Récompenses',
        description: `Distribution de ${rewardData.amount} SAHEL à ${rewardData.recipient} - ${rewardData.reason}`,
        timestamp: Date.now()
    });
}

// Chargement initial: récupérer les infos du topic et du token
async function loadInitialData() {
    try {
        // Récupérer les infos du topic
        const topicResponse = await fetch('/api/topic-info');
        const topicData = await topicResponse.json();
        
        topicIdElement.textContent = topicData.topicId;
        hederaStatusElement.textContent = topicData.status === 'Actif' ? 'Connecté' : 'Déconnecté';
        hederaStatusElement.style.color = topicData.status === 'Actif' ? 'green' : 'orange';
        
        // Récupérer les infos du token
        const tokenResponse = await fetch('/api/token-info');
        const tokenData = await tokenResponse.json();
        
        tokenStatusElement.textContent = tokenData.status;
        tokenStatusTextElement.textContent = tokenData.status;
        if (tokenData.message) {
            tokenStatusTextElement.textContent += ' - ' + tokenData.message;
        }
        
    } catch (error) {
        console.error('Erreur lors du chargement des données initiales:', error);
        hederaStatusElement.textContent = 'Erreur';
        hederaStatusElement.style.color = 'red';
        tokenStatusElement.textContent = 'Erreur';
        tokenStatusTextElement.textContent = 'Erreur de chargement';
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

// Fonction pour mettre à jour les statistiques
function updateStats() {
    if (totalAlertsElement) {
        totalAlertsElement.textContent = totalAlerts;
    }
    if (totalRewardsElement) {
        totalRewardsElement.textContent = totalRewards;
    }
    if (rewardsCountElement) {
        rewardsCountElement.textContent = totalRewards;
    }
}

// Fonction pour tester manuellement une récompense (pour debug)
window.testReward = function() {
    const testData = {
        amount: 25,
        recipient: "0.0.1001",
        reason: "Test manuel",
        simulated: true
    };
    handleRewardNotification(testData);
};