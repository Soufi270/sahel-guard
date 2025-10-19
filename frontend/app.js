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

socket.on('threat-flow', (flowData) => {
    console.log('🌊 Nouveau flux de menace détecté:', flowData);
    drawThreatFlow(flowData);
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
    
    updateStats();

    // --- Logique de Navigation du Menu Latéral ---
    const mainContent = document.querySelector('main');
    const settingsSection = document.getElementById('settings-section');
    const allMenuItems = document.querySelectorAll('.sidebar-menu .menu-item');

    function setActiveMenuItem(clickedItem) {
        allMenuItems.forEach(item => item.classList.remove('active'));
        if (clickedItem) {
            clickedItem.classList.add('active');
        }
    }

    function scrollToSection(sectionId) {
        const section = document.getElementById(sectionId);
        if (section) {
            mainContent.style.display = 'block';
            settingsSection.style.display = 'none';
            section.scrollIntoView({ behavior: 'smooth' });
        }
    }

    const menuMapping = {
        'menu-alerts': 'alert-section',
        'menu-hcs': 'hcs-section',
        'menu-signatures': 'signatures-section',
        'menu-rewards': 'rewards-section',
        'menu-sms': 'sms-section',
        'menu-map': 'map-section'
    };

    Object.keys(menuMapping).forEach(menuId => {
        const menuItem = document.getElementById(menuId);
        if (menuItem) {
            menuItem.addEventListener('click', (e) => {
                e.preventDefault();
                setActiveMenuItem(menuItem);
                scrollToSection(menuMapping[menuId]);
            });
        }
    });

    // Cas spécial pour le "Tableau de bord" (retour en haut)
    const dashboardMenu = document.querySelector('.sidebar-menu .menu-item:first-child');
    if (dashboardMenu) {
        dashboardMenu.addEventListener('click', (e) => {
            e.preventDefault();
            setActiveMenuItem(dashboardMenu);
            mainContent.style.display = 'block';
            settingsSection.style.display = 'none';
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // Cas spécial pour les "Paramètres"
    const settingsMenu = document.getElementById('menu-settings');
    if (settingsMenu) {
        settingsMenu.addEventListener('click', (e) => {
            e.preventDefault();
            setActiveMenuItem(settingsMenu);
            mainContent.style.display = 'none';
            settingsSection.style.display = 'block';
            settingsSection.scrollIntoView({ behavior: 'smooth' });
        });
    }

    // Activer le premier item du menu par défaut
    if (dashboardMenu) {
        dashboardMenu.classList.add('active');
    }
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

// --- Logique de visualisation des flux de menaces sur la carte ---
const threatFlowsGroup = document.getElementById('threat-flows-group');
const threatOrigins = Array.from(document.querySelectorAll('#threat-origins circle'));
let originIndex = 0;

function drawThreatFlow(flowData) {
    if (!threatFlowsGroup || !threatOrigins.length) return;

    const destSensor = document.querySelector(`.sensor-point[data-id="${flowData.sensorId}"]`);
    if (!destSensor) {
        console.warn(`Capteur de destination non trouvé pour l'ID: ${flowData.sensorId}`);
        return;
    }

    // Choisir un point d'origine de manière cyclique
    const originPoint = threatOrigins[originIndex % threatOrigins.length];
    originIndex++;

    const destCircle = destSensor.querySelector('circle');
    const x1 = originPoint.getAttribute('cx');
    const y1 = originPoint.getAttribute('cy');
    const x2 = destCircle.getAttribute('cx');
    const y2 = destCircle.getAttribute('cy');

    const threatColors = {
        critical: 'var(--danger)',
        high: 'var(--warning)',
        medium: 'var(--accent)',
        low: 'var(--success)'
    };
    const color = threatColors[flowData.severity] || 'var(--danger)';

    const pathData = `M${x1},${y1} L${x2},${y2}`;

    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('class', 'threat-flow-group');

    // Ligne de lueur (glow)
    const glowLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    glowLine.setAttribute('d', pathData);
    glowLine.setAttribute('stroke', color);
    glowLine.setAttribute('class', 'threat-flow-glow');
    group.appendChild(glowLine);

    // Ligne principale
    const mainLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    mainLine.setAttribute('d', pathData);
    mainLine.setAttribute('stroke', color);
    mainLine.setAttribute('class', 'threat-flow-line');
    group.appendChild(mainLine);

    // Particule animée
    const particle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    particle.setAttribute('r', '3.5');
    particle.setAttribute('class', 'flow-particle');
    const animateMotion = document.createElementNS('http://www.w3.org/2000/svg', 'animateMotion');
    animateMotion.setAttribute('dur', '1.5s');
    animateMotion.setAttribute('path', pathData);
    particle.appendChild(animateMotion);
    group.appendChild(particle);

    threatFlowsGroup.appendChild(group);

    // Nettoyer l'élément du DOM après l'animation pour éviter de surcharger la page
    setTimeout(() => { group.remove(); }, 4000); // 4s = durée de l'animation + fondu
}