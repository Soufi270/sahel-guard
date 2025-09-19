const { getHederaClient } = require("./hedera-config");
require('dotenv').config();

class SimpleRewardTokenService {
    constructor() {
        this.tokenId = null;
        this.treasuryAccountId = process.env.OPERATOR_ID;
        this.tokenSymbol = "SAHEL";
        this.tokenName = "SAHEL Guard Reward Token";
        this.simulatedMode = true; // Mode simulation pour hackathon
    }

    // Simulation pour le hackathon
    async distributeReward(accountId, amount, reason) {
        console.log(`🎁 [SIMULATION] Distribution de ${amount} ${this.tokenSymbol} à ${accountId} pour: ${reason}`);
        
        // Simulation de délai
        await new Promise(resolve => setTimeout(resolve, 500));
        
        return {
            success: true,
            simulated: true,
            amount: amount,
            recipient: accountId,
            reason: reason,
            message: "Simulation pour hackathon - transaction réelle sur mainnet"
        };
    }

    async rewardAnomalyDetection(sensorAccountId, alertData) {
        const rewardAmounts = {
            critical: 100,
            high: 50,
            medium: 25,
            low: 10
        };

        const amount = rewardAmounts[alertData.severity] || 10;
        const reason = `Détection ${alertData.type} - Niveau ${alertData.severity}`;

        return await this.distributeReward(sensorAccountId, amount, reason);
    }

    getTokenInfo() {
        return {
            tokenId: this.simulatedMode ? "Simulation pour Hackathon" : (this.tokenId ? this.tokenId.toString() : "Non créé"),
            symbol: this.tokenSymbol,
            name: this.tokenName,
            treasury: this.treasuryAccountId,
            status: this.simulatedMode ? "Mode Simulation" : (this.tokenId ? "Actif" : "Inactif"),
            message: this.simulatedMode ? "Transactions réelles possibles en production" : ""
        };
    }
}

// Singleton
let tokenService = null;

function getTokenService() {
    if (!tokenService) {
        tokenService = new SimpleRewardTokenService();
    }
    return tokenService;
}

module.exports = {
    getTokenService,
    SimpleRewardTokenService
};