/**
 * governance-service.js
 * 
 * Simule la gestion des propositions de gouvernance.
 * Dans une version complète, chaque action (création, vote) serait une transaction HCS.
 */

let proposals = [
    {
        id: 1,
        title: "Augmenter la récompense pour la détection de malwares",
        description: "Proposition pour augmenter de 20% les récompenses HTS pour les alertes de type 'malware' confirmées, afin d'inciter à une surveillance plus accrue de ce type de menace.",
        proposer: "0.0.1234",
        status: "active", // active, passed, failed
        votes: {
            for: 1250,
            against: 150
        },
        createdAt: new Date(Date.now() - 86400000 * 2).toISOString() // 2 jours avant
    },
    {
        id: 2,
        title: "Ajouter une nouvelle règle de détection pour les attaques 'zero-day'",
        description: "Intégrer un nouveau modèle d'IA expérimental pour la détection proactive des menaces de type 'zero-day'.",
        proposer: "0.0.5678",
        status: "active",
        votes: {
            for: 800,
            against: 450
        },
        createdAt: new Date(Date.now() - 86400000 * 1).toISOString() // 1 jour avant
    }
];
let nextProposalId = 3;

class GovernanceService {
    constructor() {
        console.log("🏛️ Service de Gouvernance initialisé (simulation).");
    }

    getProposals() {
        return proposals;
    }

    createProposal(proposalData) {
        const newProposal = {
            id: nextProposalId++,
            ...proposalData,
            status: 'active',
            votes: { for: 0, against: 0 },
            createdAt: new Date().toISOString()
        };
        proposals.unshift(newProposal);
        console.log(`Nouvelle proposition créée: "${newProposal.title}"`);
        return newProposal;
    }

    vote(proposalId, voteType) {
        const proposal = proposals.find(p => p.id === parseInt(proposalId));
        if (proposal && voteType in proposal.votes) {
            proposal.votes[voteType] += Math.floor(Math.random() * 100) + 10; // Simule un vote avec un certain poids
            console.log(`Vote enregistré pour la proposition #${proposalId}: ${voteType}`);
            return proposal;
        }
        return null;
    }
}

module.exports = new GovernanceService();