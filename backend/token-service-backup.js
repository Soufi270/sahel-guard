const { Client, TokenCreateTransaction, TokenType, TokenSupplyType, PrivateKey, AccountId, TransferTransaction, Hbar, AccountBalanceQuery } = require("@hashgraph/sdk");
const { getHederaClient } = require("./hedera-config");
require('dotenv').config();

class RewardTokenService {
    constructor() {
        this.tokenId = null;
        this.treasuryAccountId = process.env.OPERATOR_ID;
        this.treasuryKey = PrivateKey.fromString(process.env.OPERATOR_KEY);
        this.tokenSymbol = "SAHEL";
        this.tokenName = "SAHEL Guard Reward Token";
    }

    // Création du token HTS
    async createRewardToken() {
        const client = getHederaClient();

        try {
            console.log("🪙 Création du token de récompense SAHEL...");

            const transaction = new TokenCreateTransaction()
                .setTokenName(this.tokenName)
                .setTokenSymbol(this.tokenSymbol)
                .setTokenType(TokenType.FungibleCommon)
                .setDecimals(2)
                .setInitialSupply(1000000) // 1,000,000 tokens
                .setTreasuryAccountId(this.treasuryAccountId)
                .setSupplyType(TokenSupplyType.Infinite) // On peut créer plus de tokens plus tard
                .setSupplyKey(this.treasuryKey)
                .setAdminKey(this.treasuryKey);

            const txResponse = await transaction.execute(client);
            const receipt = await txResponse.getReceipt(client);

            this.tokenId = receipt.tokenId;
            console.log("✅ Token créé avec succès! Token ID:", this.tokenId.toString());
            
            return this.tokenId;

        } catch (error) {
            console.error("❌ Erreur création token:", error.message);
            throw error;
        }
    }

    // Distribution de récompenses
    async distributeReward(accountId, amount, reason) {
        if (!this.tokenId) {
            await this.createRewardToken();
        }

        const client = getHederaClient();

        try {
            console.log(`🎁 Distribution de ${amount} ${this.tokenSymbol} à ${accountId} pour: ${reason}`);

            const transaction = new TransferTransaction()
                .addTokenTransfer(this.tokenId, this.treasuryAccountId, -amount * 100) // Multiply by 100 for decimals
                .addTokenTransfer(this.tokenId, accountId, amount * 100)
                .setTransactionMemo(`Récompense: ${reason}`);

            const txResponse = await transaction.execute(client);
            const receipt = await txResponse.getReceipt(client);

            console.log("✅ Récompense distribuée! Transaction:", receipt.status.toString());
            
            return {
                success: true,
                transactionId: receipt.transactionId.toString(),
                amount: amount,
                recipient: accountId,
                reason: reason
            };

        } catch (error) {
            console.error("❌ Erreur distribution récompense:", error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Vérification du solde d'un compte
    async getAccountBalance(accountId) {
        const client = getHederaClient();

        try {
            const query = new AccountBalanceQuery()
                .setAccountId(accountId);

            const balance = await query.execute(client);
            const tokenBalance = balance.tokens.get(this.tokenId) || 0;
            
            return {
                accountId: accountId,
                hbarBalance: balance.hbars.toString(),
                tokenBalance: (tokenBalance / 100).toFixed(2), // Divide by 100 for decimals
                tokenSymbol: this.tokenSymbol
            };

        } catch (error) {
            console.error("❌ Erreur vérification solde:", error.message);
            throw error;
        }
    }

    // Récompense automatique pour détection d'anomalie
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

    // Récupération des informations du token
    getTokenInfo() {
        return {
            tokenId: this.tokenId ? this.tokenId.toString() : "Non créé",
            symbol: this.tokenSymbol,
            name: this.tokenName,
            treasury: this.treasuryAccountId,
            status: this.tokenId ? "Actif" : "Inactif"
        };
    }
}

// Singleton
let tokenService = null;

function getTokenService() {
    if (!tokenService) {
        tokenService = new RewardTokenService();
    }
    return tokenService;
}

module.exports = {
    getTokenService,
    RewardTokenService
};