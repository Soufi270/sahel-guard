const { Client, TopicCreateTransaction, TopicMessageSubmitTransaction, PrivateKey, AccountId } = require("@hashgraph/sdk");
require('dotenv').config();

// Configuration détaillée du client Hedera
function getHederaClient() {
    try {
        // Vérification que les variables d'environnement sont définies
        if (!process.env.OPERATOR_ID || !process.env.OPERATOR_KEY) {
            throw new Error("Les variables OPERATOR_ID et OPERATOR_KEY doivent être définies dans le fichier .env");
        }

        // Création du client pour le testnet
        const client = Client.forTestnet();
        
        // Configuration de l'opérateur (votre compte)
        const operatorId = AccountId.fromString(process.env.OPERATOR_ID);
        const operatorKey = PrivateKey.fromString(process.env.OPERATOR_KEY);
        
        client.setOperator(operatorId, operatorKey);
        
        console.log("Client Hedera configuré avec l'account:", operatorId.toString());
        return client;
    } catch (error) {
        console.error("Erreur lors de la configuration du client Hedera:", error.message);
        throw error;
    }
}

// Variable globale pour stocker l'ID du topic
let topicId = null;
let signatureTopicId = null;

// Fonction pour créer un topic HCS
async function createHCSTopic() {
    const client = getHederaClient();
    
    try {
        console.log("Création d'un nouveau topic HCS...");
        
        // Création de la transaction
        const topicCreateTx = new TopicCreateTransaction()
            .setTopicMemo("SAHEL GUARD - Topic pour les alertes de sécurité");
        
        // Soumission de la transaction
        const topicCreateSubmit = await topicCreateTx.execute(client);
        
        // Obtention du reçu pour avoir l'ID du topic
        const topicCreateRx = await topicCreateSubmit.getReceipt(client);
        topicId = topicCreateRx.topicId;
        
        console.log("✅ Topic créé avec succès. ID:", topicId.toString());
        return topicId;
    } catch (error) {
        console.error("❌ Erreur lors de la création du topic:", error.message);
        throw error;
    }
}

// Fonction pour envoyer un message sur le topic
async function sendHCSMessage(messageData) {
    const client = getHederaClient();
    
    try {
        // Si on n'a pas encore de topic, on en crée un
        if (!topicId) {
            await createHCSTopic();
        }
        
        console.log("Envoi d'un message sur le topic:", topicId.toString());
        
        // Préparation du message avec timestamp
        const message = {
            ...messageData,
            timestamp: Date.now(),
            messageId: Math.random().toString(36).substring(7)
        };
        
        // Création de la transaction d'envoi de message
        const messageSubmitTx = new TopicMessageSubmitTransaction()
            .setTopicId(topicId)
            .setMessage(JSON.stringify(message));
        
        // Exécution de la transaction
        const messageSubmitSubmit = await messageSubmitTx.execute(client);
        const messageSubmitRx = await messageSubmitSubmit.getReceipt(client);
        
        console.log("✅ Message envoyé avec succès. Séquence:", messageSubmitRx.topicSequenceNumber.toString());
        
        return {
            sequenceNumber: messageSubmitRx.topicSequenceNumber.toString(),
            messageId: message.messageId
        };
    } catch (error) {
        console.error("❌ Erreur lors de l'envoi du message:", error.message);
        throw error;
    }
}

// Fonction pour créer le topic des signatures
async function createSignatureTopic() {
    const client = getHederaClient();
    try {
        console.log("Création d'un nouveau topic HCS pour les signatures...");
        const tx = await new TopicCreateTransaction()
            .setTopicMemo("SAHEL GUARD - Registre des signatures de menaces")
            .execute(client);
        const receipt = await tx.getReceipt(client);
        signatureTopicId = receipt.topicId;
        console.log("✅ Topic de signatures créé avec succès. ID:", signatureTopicId.toString());
        return signatureTopicId;
    } catch (error) {
        console.error("❌ Erreur lors de la création du topic de signatures:", error.message);
        throw error;
    }
}

// Fonction pour envoyer une signature sur le topic dédié
async function sendSignatureMessage(signatureData) {
    const client = getHederaClient();
    try {
        if (!signatureTopicId) {
            await createSignatureTopic();
        }
        const message = { ...signatureData, timestamp: Date.now() };
        await new TopicMessageSubmitTransaction()
            .setTopicId(signatureTopicId)
            .setMessage(JSON.stringify(message))
            .execute(client);
        console.log("✍️ Signature de menace envoyée sur le topic:", signatureTopicId.toString());
        return message;
    } catch (error) {
        console.error("❌ Erreur lors de l'envoi de la signature:", error.message);
        throw error;
    }
}

// Fonction pour récupérer l'ID du topic
function getTopicId() {
    return topicId;
}

module.exports = {
    getHederaClient,
    createHCSTopic,
    sendHCSMessage,
    getTopicId,
    createSignatureTopic,
    sendSignatureMessage
};