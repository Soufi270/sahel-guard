/**
 * @file admin.js
 * Gère toute la logique du tableau de bord administrateur de SAHEL GUARD.
 * - Établit la connexion WebSocket avec le serveur.
 * - Met à jour l'interface en temps réel en réponse aux événements du serveur.
 * - Gère les interactions utilisateur (navigation, formulaires, modales).
 */

const socket = io();

// Éléments DOM
const hederaStatusElement = document.getElementById('hedera-status');
const topicIdElement = document.getElementById('topic-id');
const tokenStatusElement = document.getElementById('token-status');
const tokenStatusTextElement = document.getElementById('token-status-text');
const alertsListElement = document.getElementById('alerts-list');
const rewardsListElement = document.getElementById('rewards-list');
const alertForm = document.getElementById('alert-form');
const totalAlertsElement = document.getElementById('total-alerts');
const totalRewardsElement = document.getElementById('total-rewards');
const totalAlertsCardElement = document.getElementById('total-alerts-card');
const totalRewardsCardElement = document.getElementById('total-rewards-card');

// Variables globales
let totalAlerts = 0;
let totalRewards = 0;

// Store pour le statut des capteurs
let sensorStatus = {};

// Store pour la réputation des capteurs
const sensorReputations = new Map();

// ===================================================================================
// GESTION DES ÉVÉNEMENTS WEBSOCKET
// ===================================================================================

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

socket.on('hcs-log-entry', (logData) => {
    addHcsLogToUI(logData);
});

socket.on('new-signature', (signatureData) => {
    addSignatureToUI(signatureData);
});

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

socket.on('threat-flow', (flowData) => {
    console.log('🌊 Nouveau flux de menace détecté:', flowData);
    drawThreatFlow(flowData);
});

socket.on('sensor-status-update', (data) => {
    console.log('🛰️ Statut capteur mis à jour:', data);
    updateSensorStatus(data.sensorId, data.status);
});

socket.on('reputations-init', (reputations) => {
    console.log('Réputations initiales reçues:', reputations);
    reputations.forEach(rep => sensorReputations.set(rep.id.toString(), rep));
});

socket.on('reputation-updated', (data) => {
    console.log('Réputation mise à jour:', data);
    sensorReputations.set(data.sensorId.toString(), data.reputation);
    updateSensorReputationVisual(data.sensorId, data.reputation.color);
});

socket.on('counter-measure-executed', (actionData) => {
    console.log('🛡️ Contre-mesure exécutée:', actionData);
    addCounterMeasureToUI(actionData);
});

socket.on('email-sent', (emailLogEntry) => { // <-- NOUVEAU
    console.log('📧 Email envoyé:', emailLogEntry);
    addEmailToUI(emailLogEntry);
});

// ===================================================================================
// GESTION DES INTERACTIONS UTILISATEUR
// ===================================================================================

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

// ===================================================================================
// FONCTIONS DE MISE À JOUR DE L'INTERFACE (UI)
// ===================================================================================

/**
 * Met à jour les cartes de statistiques principales (Total des alertes et récompenses).
 */
function updateStats() {
    if (totalAlertsElement) {
        totalAlertsElement.textContent = totalAlerts;
    }
    if (totalAlertsCardElement) {
        totalAlertsCardElement.textContent = totalAlerts;
    }
    if (totalRewardsElement) {
        totalRewardsElement.textContent = Math.round(totalRewards);
    }
    if (totalRewardsCardElement) {
        totalRewardsCardElement.textContent = Math.round(totalRewards);
    }
}

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
    
    // Déterminer l'icône et le titre en fonction du type
    let icon, title, bgColor, iconColor;
    switch(alertData.type) {
        case 'phishing':
            icon = 'fa-envelope';
            title = 'Tentative de Phishing';
            bgColor = 'rgba(231, 76, 60, 0.2)';
            iconColor = '#e74c3c';
            break;
        case 'ddos':
            icon = 'fa-globe';
            title = 'Attaque DDoS';
            bgColor = 'rgba(230, 126, 34, 0.2)';
            iconColor = '#e67e22';
            break;
        case 'intrusion':
            icon = 'fa-shield-alt';
            title = 'Intrusion Réseau';
            bgColor = 'rgba(241, 196, 15, 0.2)';
            iconColor = '#f1c40f';
            break;
        case 'malware':
            icon = 'fa-virus';
            title = 'Malware Détecté';
            bgColor = 'rgba(155, 89, 182, 0.2)';
            iconColor = '#9b59b6';
            break;
        case 'reward':
            icon = 'fa-gift';
            title = 'Récompense Distribuée';
            bgColor = 'rgba(46, 204, 113, 0.2)';
            iconColor = '#2ecc71';
            break;
        default:
            icon = 'fa-exclamation-triangle';
            title = 'Alerte de Sécurité';
            bgColor = 'rgba(52, 152, 219, 0.2)';
            iconColor = '#3498db';
    }
    
    alertElement.innerHTML = `
        <div class="alert-icon" style="background: ${bgColor}; color: ${iconColor};">
            <i class="fas ${icon}"></i>
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

/**
 * Gère l'affichage d'une notification de récompense et met à jour les statistiques.
 * @param {object} rewardData - Les données de la récompense.
 */
// Fonction pour gérer les notifications de récompense
function handleRewardNotification(rewardData) {
    // Utiliser le montant réel pour le total
    totalRewards += rewardData.amount;
    updateStats();
    
    // Créer un élément de récompense avec le nouveau style
    const rewardElement = document.createElement('div');
    rewardElement.className = 'reward-item slide-in';
    
    rewardElement.innerHTML = `
        <div class="reward-icon">
            <i class="fas fa-coins"></i>
        </div>
        <div class="reward-content">
            <div class="reward-title">Récompense Distribuée</div>
            <div class="reward-details">
                <div class="reward-detail"><span>Montant:</span> ${rewardData.amount} HBAR</div>
                <div class="reward-detail"><span>À:</span> ${rewardData.recipient}</div>
                <div class="reward-detail"><span>Raison:</span> ${rewardData.reason}</div>
                <div class="reward-detail"><span>Statut:</span> ${rewardData.simulated ? 'Simulation' : 'Réussi'}</div>
            </div>
            <div class="alert-meta">
                <span class="alert-time"><i class="fas fa-clock"></i> ${new Date().toLocaleString('fr-FR')}</span>
            </div>
        </div>
    `;
    
    // Ajouter à la liste des récompenses
    if (rewardsListElement) {
        rewardsListElement.insertBefore(rewardElement, rewardsListElement.firstChild);
        if (rewardsListElement.children.length > 10) {
            rewardsListElement.removeChild(rewardsListElement.lastChild);
        }
    }
}

/**
 * Ajoute une entrée de log pour une contre-mesure exécutée à l'interface.
 * @param {object} actionData - Les données de l'action de contre-mesure.
 * @param {boolean} [animate=true] - Indique si l'ajout doit être animé.
 */
// Fonction pour ajouter une contre-mesure à l'UI
function addCounterMeasureToUI(actionData, animate = true) {
    const list = document.getElementById('counter-measures-list');
    if (!list) return;

    // Vider le message d'initialisation
    const placeholder = list.querySelector('.placeholder');
    if (placeholder) placeholder.remove();

    const item = document.createElement('div');
    item.className = `counter-measure-item ${animate ? 'slide-in' : ''}`;
    const formattedDate = new Date(actionData.timestamp).toLocaleTimeString('fr-FR');

    let icon = 'fa-ban';
    let actionText = `Blocage IP`;

    item.innerHTML = `
        <div class="cm-icon"><i class="fas ${icon}"></i></div>
        <div class="cm-details">
            <div class="cm-title">${actionText}: <span class="cm-target">${actionData.target}</span></div>
            <div class="cm-reason">Raison: ${actionData.reason}</div>
        </div>
        <div class="cm-time">${formattedDate}</div>
    `;

    list.insertBefore(item, list.firstChild);
    if (list.children.length > 20) list.removeChild(list.lastChild);
}

/**
 * Ajoute une entrée de log pour un email envoyé à l'interface.
 * @param {object} emailLogEntry - Les données du log de l'email.
 * @param {boolean} [animate=true] - Indique si l'ajout doit être animé.
 */
// Fonction pour ajouter un email à l'UI
function addEmailToUI(emailLogEntry, animate = true) { // <-- NOUVEAU
    const list = document.getElementById('email-list');
    if (!list) return;

    // Vider le message d'initialisation
    const placeholder = list.querySelector('.placeholder');
    if (placeholder) placeholder.remove();


    const item = document.createElement('div');
    item.className = `email-item ${animate ? 'slide-in' : ''}`;
    const formattedDate = new Date(emailLogEntry.alertData.timestamp).toLocaleTimeString('fr-FR');

    const successCount = emailLogEntry.emailResults.filter(r => r.success).length;
    const totalCount = emailLogEntry.emailResults.length;

    item.innerHTML = `
        <div class="email-icon"><i class="fas fa-envelope"></i></div>
        <div class="email-content">
            <div class="email-title">Notification Email envoyée</div>
            <div class="email-details">
                <div class="email-detail"><span>Type:</span> ${emailLogEntry.alertData.type}</div>
                <div class="email-detail"><span>Sévérité:</span> ${emailLogEntry.alertData.severity}</div>
                <div class="email-detail"><span>Destinataires:</span> ${successCount}/${totalCount}</div>
            </div>
            <div class="alert-meta"><span class="alert-time"><i class="fas fa-clock"></i> ${formattedDate}</span></div>
        </div>
    `;
    list.insertBefore(item, list.firstChild);
    if (list.children.length > 20) list.removeChild(list.lastChild);
}

/**
 * Charge les informations initiales (Topic ID, Token Info) depuis le serveur.
 */
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

// ===================================================================================
// LOGIQUE DE VISUALISATION (CARTE, STATS, ETC.)
// ===================================================================================

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

function updateSensorReputationVisual(sensorId, color) {
    const sensorElement = document.querySelector(`.sensor-point[data-id="${sensorId}"] circle`);
    if (sensorElement) {
        // Applique la couleur de réputation, mais seulement si le capteur n'est pas en alerte
        if (!sensorElement.parentElement.classList.contains('status-alert'))
            sensorElement.style.fill = color;
    }
}

function addHcsLogToUI(logData, animate = true) {
    const list = document.getElementById('hcs-log-list');
    if (!list) return;

    // Vider le message d'initialisation
    if (list.children.length === 1 && list.firstChild.textContent?.includes('Initialisation')) {
        list.innerHTML = '';
    }

    const item = document.createElement('div');
    item.className = `hcs-log-item ${animate ? 'slide-in' : ''}`;
    const formattedDate = new Date(logData.timestamp || Date.now()).toLocaleTimeString('fr-FR');
    const message = JSON.stringify({ type: logData.type, severity: logData.severity, source: logData.source });
    item.innerHTML = `<span class="log-time">[${formattedDate}]</span> <span class="log-type">${logData.type}</span> <span class="log-message">${message}</span>`;
    list.insertBefore(item, list.firstChild);
    if (list.children.length > 50) list.removeChild(list.lastChild);
}

// ===================================================================================
// INITIALISATION DE LA PAGE
// ===================================================================================

// --- CONSOLIDATION DE L'INITIALISATION ---
document.addEventListener('DOMContentLoaded', () => {
    console.log('Page SAHEL GUARD initialisée');
    loadInitialData();
    updateStats();

    // Gestion des erreurs globales
    window.addEventListener('error', (event) => {
        console.error('Erreur globale:', event.error);
    });

    // --- Logique de Navigation du Menu Latéral ---
    const mainContent = document.querySelector('main');
    const settingsSection = document.getElementById('settings-section');
    const allMenuItems = document.querySelectorAll('.sidebar-menu .menu-item');

    function setActiveMenuItem(clickedItem) {
        allMenuItems.forEach(item => item.classList.remove('active'));
        if (clickedItem) clickedItem.classList.add('active');
    }

    function showSection(sectionId) {
        if (sectionId === 'settings-section') {
            mainContent.style.display = 'none';
            settingsSection.style.display = 'block';
        } else {
            mainContent.style.display = 'block';
            settingsSection.style.display = 'none';
            const section = document.getElementById(sectionId);
            if (section) {
                section.scrollIntoView({ behavior: 'smooth' });
            }
        }
    }

    const menuMapping = {
        'menu-alerts': 'alert-section',
        'menu-hcs': 'hcs-section',
        'menu-signatures': 'signatures-section',
        'menu-rewards': 'rewards-section',
        'menu-email': 'email-section',
        'menu-map': 'map-section',
        'menu-counter-measures': 'counter-measures-section'
    };

    Object.keys(menuMapping).forEach(menuId => {
        const menuItem = document.getElementById(menuId);
        if (menuItem) menuItem.addEventListener('click', (e) => {
            e.preventDefault();
            setActiveMenuItem(menuItem);
            showSection(menuMapping[menuId]);
        });
    });

    const settingsMenu = document.getElementById('menu-settings');
    if (settingsMenu) settingsMenu.addEventListener('click', (e) => {
        e.preventDefault();
        setActiveMenuItem(settingsMenu);
        showSection('settings-section');
    });

    const dashboardMenu = document.querySelector('.sidebar-menu .menu-item:first-child');
    if (dashboardMenu) dashboardMenu.addEventListener('click', (e) => {
        e.preventDefault();
        setActiveMenuItem(dashboardMenu);
        mainContent.style.display = 'block';
        settingsSection.style.display = 'none';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // --- Initialisation des autres écouteurs d'événements ---
    initializeHeaderButtons();
    initializeSettingsPanel();
    initializeSensorModal();
    initializeLogoutButton();
});

function initializeHeaderButtons() {
    const newAlertBtn = document.getElementById('new-alert-btn');
    const formPanel = document.getElementById('form-panel');
    if (newAlertBtn && formPanel) {
        newAlertBtn.addEventListener('click', (e) => {
            e.preventDefault();
            formPanel.scrollIntoView({ behavior: 'smooth' });
        });
    }
}

function initializeLogoutButton() {
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                const response = await fetch('/api/logout', { method: 'POST' });
                if (response.redirected) {
                    window.location.href = response.url;
                } else {
                    window.location.href = '/login';
                }
            } catch (error) {
                console.error('Erreur lors de la déconnexion:', error);
            }
        });
    }
}

function initializeSettingsPanel() {
    const emailToggle = document.getElementById('email-enabled-toggle');
    const emailAddressesInput = document.getElementById('email-addresses');
    const emailDigestMinutesInput = document.getElementById('email-digest-minutes');
    const aiThresholdSlider = document.getElementById('ai-threshold-slider');
    const aiThresholdValue = document.getElementById('ai-threshold-value');
    const themeToggle = document.getElementById('theme-toggle');
    const saveBtn = document.getElementById('save-settings-btn');
    const clearLogsBtn = document.getElementById('clear-logs-btn');
    // La variable activeResponseToggle n'est pas dans le HTML, donc je la commente pour éviter des erreurs.
    // const activeResponseToggle = document.getElementById('active-response-toggle');

    async function loadSettingsToUI() {
        try {
            const response = await fetch('/api/settings');
            const settings = await response.json();
            
            emailToggle.checked = settings.emailEnabled;
            emailAddressesInput.value = settings.alertEmails.join(', ');
            emailDigestMinutesInput.value = settings.emailDigestMinutes;
            aiThresholdSlider.value = settings.aiAnomalyThreshold;
            aiThresholdValue.textContent = settings.aiAnomalyThreshold;
            themeToggle.checked = settings.theme === 'dark';
            // if (activeResponseToggle) activeResponseToggle.checked = settings.activeResponseEnabled;
            
            document.body.style.setProperty('--primary', settings.theme === 'dark' ? '#0a0a1a' : '#f4f7f9');
        } catch (error) {
            console.error("Erreur chargement des paramètres:", error);
        }
    }

    if (aiThresholdSlider) {
        aiThresholdSlider.addEventListener('input', () => {
            aiThresholdValue.textContent = parseFloat(aiThresholdSlider.value).toFixed(2);
        });
    }

    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            const newSettings = {
                emailEnabled: emailToggle.checked,
                alertEmails: emailAddressesInput.value.split(',').map(email => email.trim()).filter(Boolean),
                emailDigestMinutes: parseInt(emailDigestMinutesInput.value, 10),
                aiAnomalyThreshold: parseFloat(aiThresholdSlider.value), // Correction ici
                theme: themeToggle.checked ? 'dark' : 'light',
                // activeResponseEnabled: activeResponseToggle.checked
            };

            const response = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newSettings)
            });
            const result = await response.json();
            if (result.success) {
                alert('Paramètres sauvegardés !');
                document.body.style.setProperty('--primary', newSettings.theme === 'dark' ? '#0a0a1a' : '#f4f7f9');
            } else {
                alert('Erreur lors de la sauvegarde.');
            }
        });
    }

    loadSettingsToUI();
}

function initializeSensorModal() {
    const modal = document.getElementById('sensor-modal');
    const modalCloseBtn = document.querySelector('.close-button');
    const sensorPoints = document.querySelectorAll('.sensor-point');

    sensorPoints.forEach(point => {
        point.addEventListener('click', () => {
            const sensorId = point.getAttribute('data-id');
            const location = point.getAttribute('data-location');
            const ip = point.getAttribute('data-ip');
            const reputation = sensorReputations.get(sensorId) || { xp: 0, level: 'Bronze', alerts: 0, multiplier: 1.0, color: '#cd7f32' };

            document.getElementById('modal-title').innerText = `Détails du Capteur - ${location}`;
            const modalBody = document.getElementById('modal-body');
            modalBody.innerHTML = `
                <div class="modal-grid">
                    <div class="modal-item"><span class="modal-item-label">ID du Capteur</span><span class="modal-item-value">${sensorId}</span></div>
                    <div class="modal-item"><span class="modal-item-label">Adresse IP</span><span class="modal-item-value">${ip}</span></div>
                    <div class="modal-item"><span class="modal-item-label">Niveau de Réputation</span><span class="modal-item-value" style="color: ${reputation.color || '#fff'}">${reputation.level}</span></div>
                    <div class="modal-item"><span class="modal-item-label">Points d'Expérience (XP)</span><span class="modal-item-value">${reputation.xp}</span></div>
                    <div class="modal-item"><span class="modal-item-label">Alertes Confirmées</span><span class="modal-item-value">${reputation.alerts}</span></div>
                    <div class="modal-item"><span class="modal-item-label">Bonus de Récompense</span><span class="modal-item-value">x${reputation.multiplier || 1.0}</span></div>
                </div>
            `;

            modal.style.display = 'block';
        });
    });

    if (modalCloseBtn) {
        modalCloseBtn.onclick = () => {
            modal.style.display = 'none';
        };
    }

    window.onclick = (event) => {
        if (event.target == modal) {
            modal.style.display = 'none';
        }
    };
}

// Historique des emails (pour les nouveaux clients)
socket.on('email-log-history', (history) => { // <-- NOUVEAU
    const list = document.getElementById('email-list');
    if (list) list.innerHTML = '';
    history.forEach(log => addEmailToUI(log, false));
});

function addSignatureToUI(signatureData, animate = true) {
    const list = document.getElementById('signatures-log-list');
    if (!list) return;

    if (list.children.length === 1 && list.firstChild.textContent?.includes('Initialisation')) {
        list.innerHTML = '';
    }

    const item = document.createElement('div');
    item.className = `hcs-log-item ${animate ? 'slide-in' : ''}`;
    const formattedDate = new Date(signatureData.timestamp || Date.now()).toLocaleTimeString('fr-FR');
    const message = JSON.stringify({ type: signatureData.threatType, pattern: signatureData.sourcePattern });
    item.innerHTML = `<span class="log-time">[${formattedDate}]</span> <span class="log-type">NOUVELLE SIGNATURE</span> <span class="log-message">${message}</span>`;
    list.insertBefore(item, list.firstChild);
    if (list.children.length > 50) list.removeChild(list.lastChild);
}