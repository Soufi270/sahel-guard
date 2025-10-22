const socket = io();

document.addEventListener('DOMContentLoaded', () => {
    console.log('Page publique SAHEL GUARD initialisée');
});

socket.on('new-alert', (alertData) => {
    addAlertToUI(alertData);
});

socket.on('new-signature', (signatureData) => {
    addSignatureToUI(signatureData);
});

socket.on('threat-flow', (flowData) => {
    drawThreatFlow(flowData);
});

socket.on('sensor-status-update', (data) => {
    updateSensorStatus(data.sensorId, data.status);
});

function addAlertToUI(alertData, animate = true) {
    const alertsListElement = document.getElementById('alerts-list');
    if (!alertsListElement) return;

    if (alertsListElement.children.length === 1 && alertsListElement.firstChild.tagName === 'P') {
        alertsListElement.innerHTML = '';
    }

    const alertElement = document.createElement('div');
    alertElement.className = `alert-item ${alertData.severity}`;
    
    const date = new Date(alertData.timestamp || Date.now());
    const formattedDate = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
    
    const icon = 'fa-exclamation-triangle';
    const title = 'Alerte de Sécurité';
    const bgColor = { high: 'rgba(255, 170, 0, 0.2)', medium: 'rgba(0, 170, 255, 0.2)', low: 'rgba(0, 255, 127, 0.2)', critical: 'rgba(255, 51, 51, 0.2)' }[alertData.severity] || 'rgba(52, 152, 219, 0.2)';
    const iconColor = { high: '#ffaa00', medium: '#00aaff', low: '#00ff7f', critical: '#ff3333' }[alertData.severity] || '#3498db';

    alertElement.innerHTML = `
        <div class="alert-icon" style="background: ${bgColor}; color: ${iconColor};">
            <i class="fas ${icon}"></i>
        </div>
        <div class="alert-content">
            <div class="alert-title" style="color: ${iconColor};">${title}</div>
            <div class="alert-desc">${alertData.description || 'Aucune description fournie'}</div>
            <div class="alert-meta">
                <span class="alert-time"><i class="fas fa-clock"></i> ${formattedDate}</span>
                <span class="alert-severity"><i class="fas fa-signal"></i> Niveau: ${alertData.severity}</span>
                ${alertData.source ? `<span class="alert-source"><i class="fas fa-network-wired"></i> Source: ${alertData.source}</span>` : ''}
            </div>
        </div>
    `;
    
    alertsListElement.insertBefore(alertElement, alertsListElement.firstChild);
    if (alertsListElement.children.length > 20) {
        alertsListElement.removeChild(alertsListElement.lastChild);
    }
}

function addSignatureToUI(signatureData, animate = true) {
    const list = document.getElementById('signatures-log-list');
    if (!list) return;

    if (list.children.length === 1 && list.firstChild.tagName === 'P') {
        list.innerHTML = '';
    }

    const item = document.createElement('div');
    item.className = `hcs-log-item`;
    const formattedDate = new Date(signatureData.timestamp || Date.now()).toLocaleTimeString('fr-FR');
    const message = JSON.stringify({ type: signatureData.threatType, pattern: signatureData.sourcePattern });
    item.innerHTML = `<span class="log-time">[${formattedDate}]</span> <span class="log-type">NOUVELLE SIGNATURE</span> <span>${message}</span>`;
    list.insertBefore(item, list.firstChild);
    if (list.children.length > 50) list.removeChild(list.lastChild);
}

function updateSensorStatus(sensorId, status) {
    const sensorElement = document.querySelector(`.sensor-point[data-id="${sensorId}"]`);
    if (sensorElement) {
        sensorElement.classList.remove('status-active', 'status-alert');
        if (status === 'alert') {
            sensorElement.classList.add('status-alert');
        }
    }
}

function drawThreatFlow(flowData) {
    const threatFlowsGroup = document.getElementById('threat-flows-group');
    const originPoint = document.getElementById('origin-1');
    if (!threatFlowsGroup || !originPoint) return;

    const destSensor = document.querySelector(`.sensor-point[data-id="${flowData.sensorId}"]`);
    if (!destSensor) return;

    const destCircle = destSensor.querySelector('circle');
    const x1 = originPoint.getAttribute('cx');
    const y1 = originPoint.getAttribute('cy');
    const x2 = destCircle.getAttribute('cx');
    const y2 = destCircle.getAttribute('cy');

    const threatColors = {
        critical: '#ff3333',
        high: '#ffaa00',
        medium: '#00aaff',
        low: '#00ff7f'
    };
    const color = threatColors[flowData.severity] || '#ff3333';

    const pathData = `M${x1},${y1} L${x2},${y2}`;

    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    const mainLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    mainLine.setAttribute('d', pathData);
    mainLine.setAttribute('stroke', color);
    mainLine.setAttribute('class', 'threat-flow-line');
    group.appendChild(mainLine);

    threatFlowsGroup.appendChild(group);

    setTimeout(() => { group.remove(); }, 3000);
}

socket.on('log-history', (history) => {
    history.forEach(log => addAlertToUI(log, false));
});

socket.on('signature-log-history', (history) => {
    history.forEach(log => addSignatureToUI(log, false));
});