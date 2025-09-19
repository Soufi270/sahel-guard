const { sendHCSMessage } = require('../backend/hedera-config');
const axios = require('axios');

// Types d'attaques spécifiques au contexte Africain
const attackPatterns = [
    {
        name: "Phishing ciblant les services mobiles money",
        type: "phishing",
        source: "154.16.",
        destination: "196.0.0.", // Plage IP Mali
        pattern: () => Math.random() > 0.8 // 20% de chance
    },
    {
        name: "Scan de ports sur infrastructure critique",
        type: "port-scan", 
        source: "41.78.",
        destination: "196.202.", 
        pattern: () => Math.random() > 0.9 // 10% de chance
    },
    {
        name: "Trafic DDoS depuis l'étranger",
        type: "ddos",
        source: "154.0.", 
        destination: "196.0.0.",
        pattern: () => Math.random() > 0.95 // 5% de chance
    }
];

// Génération de données réseau réalistes
function generateRealisticNetworkData() {
    const isAttack = Math.random() > 0.85; // 15% de chance d'attaque
    let data = {
        timestamp: Date.now(),
        sourceIP: `196.202.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
        destinationIP: `8.8.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
        protocol: ['HTTP', 'HTTPS', 'DNS', 'SSH'][Math.floor(Math.random() * 4)],
        packetSize: Math.floor(Math.random() * 1500) + 1,
        packetCount: Math.floor(Math.random() * 100) + 1,
        location: 'Mali',
        isNormal: !isAttack
    };

    // Simuler une attaque si nécessaire
    if (isAttack) {
        const attack = attackPatterns[Math.floor(Math.random() * attackPatterns.length)];
        if (attack.pattern()) {
            data = {
                ...data,
                sourceIP: attack.source + Math.floor(Math.random() * 255),
                destinationIP: attack.destination + Math.floor(Math.random() * 255),
                packetCount: Math.floor(Math.random() * 1000) + 500, // Traffic élevé
                isNormal: false,
                attackType: attack.type,
                description: `Suspicion: ${attack.name}`
            };
        }
    }

    return data;
}

// Simulation de capteurs distribués au Mali
const locations = ['Bamako', 'Sikasso', 'Mopti', 'Gao', 'Kayes', 'Ségou'];
let sensorId = 1;

async function simulateSensor(sensorLocation) {
    console.log(`📡 Démarrage capteur ${sensorId} à ${sensorLocation}`);
    
    setInterval(async () => {
        try {
            const networkData = generateRealisticNetworkData();
            networkData.sensorId = sensorId;
            networkData.sensorLocation = sensorLocation;
            
            // Envoyer les données brutes à Hedera
            await sendHCSMessage({
                type: 'network-data',
                ...networkData
            });
            
            // Envoyer également pour analyse IA
            try {
                await axios.post('http://localhost:3000/api/analyze', networkData);
            } catch (analysisError) {
                console.log('Analyse IA non disponible, continuation...');
            }
            
            console.log(`📊 [${sensorLocation}] Données envoyées:`, networkData.isNormal ? 'Normal' : 'ATTENTION → ' + networkData.attackType);
            
        } catch (error) {
            console.error(`❌ Erreur capteur ${sensorId}:`, error.message);
        }
    }, 3000 + Math.random() * 4000); // Intervalle aléatoire entre 3-7s
}

// Démarrer plusieurs capteurs simulés
console.log('🚀 Démarrage de la simulation de capteurs SAHEL GUARD...\n');

locations.forEach((location, index) => {
    setTimeout(() => {
        simulateSensor(location);
        sensorId++;
    }, index * 2000); // Démarrage échelonné
});

// Gestion propre de l'arrêt
process.on('SIGINT', () => {
    console.log('\n🛑 Arrêt des capteurs simulés...');
    process.exit(0);
});