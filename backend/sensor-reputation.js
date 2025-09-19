/**
 * sensor-reputation.js
 * 
 * Gère la réputation, l'XP et les niveaux des capteurs du réseau.
 */

const SENSOR_LEVELS = [
    { name: 'Bronze', xpThreshold: 0, multiplier: 1.0, color: '#cd7f32' },
    { name: 'Silver', xpThreshold: 100, multiplier: 1.1, color: '#c0c0c0' },
    { name: 'Gold', xpThreshold: 500, multiplier: 1.25, color: '#ffd700' },
    { name: 'Diamond', xpThreshold: 2000, multiplier: 1.5, color: '#00aaff' }
];

// Simule une base de données pour la réputation des capteurs.
const sensorDataStore = new Map();

function getSensorData(sensorId) {
    if (!sensorDataStore.has(sensorId)) {
        sensorDataStore.set(sensorId, {
            id: sensorId,
            xp: 0,
            level: SENSOR_LEVELS[0].name,
            alerts: 0,
            multiplier: SENSOR_LEVELS[0].multiplier,
            color: SENSOR_LEVELS[0].color
        });
    }
    return sensorDataStore.get(sensorId);
}

function getLevelForXp(xp) {
    let currentLevel = SENSOR_LEVELS[0];
    for (const level of SENSOR_LEVELS) {
        if (xp >= level.xpThreshold) {
            currentLevel = level;
        } else {
            break;
        }
    }
    return currentLevel;
}

class SensorReputationService {
    constructor() {
        console.log('🎮 Service de Réputation des Capteurs initialisé.');
    }

    addXpForAlert(sensorId, alertData) {
        const xpValues = { low: 5, medium: 10, high: 25, critical: 50 };
        const xpToAdd = xpValues[alertData.severity] || 5;

        const data = getSensorData(sensorId);
        data.xp += xpToAdd;
        data.alerts += 1;

        const newLevel = getLevelForXp(data.xp);
        data.level = newLevel.name;
        data.multiplier = newLevel.multiplier;
        data.color = newLevel.color;

        console.log(`Sensor #${sensorId} a gagné ${xpToAdd} XP. Total: ${data.xp} XP. Niveau: ${data.level}`);
        return data;
    }

    getReputation(sensorId) {
        return getSensorData(sensorId);
    }

    getAllReputations() {
        return Array.from(sensorDataStore.values());
    }
}

module.exports = new SensorReputationService();