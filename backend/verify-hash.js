const bcrypt = require('bcrypt');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function generateHash() {
  rl.question('Entrez le mot de passe à hacher: ', (password) => {
    if (!password) {
      console.error('Le mot de passe ne peut pas être vide.');
      rl.close();
      return;
    }
    const saltRounds = 10;
    bcrypt.hash(password, saltRounds, (err, hash) => {
      if (err) {
        console.error('Erreur lors du hachage:', err);
      } else {
        console.log('\n--- HASH GÉNÉRÉ ---');
        console.log(hash);
        console.log('---------------------\nCopiez ce hash dans votre fichier server.js');
      }
      rl.close();
    });
  });
}

function compareHash() {
  rl.question('Entrez le mot de passe à vérifier: ', (password) => {
    rl.question('Entrez le hash à comparer: ', (hash) => {
      bcrypt.compare(password, hash, (err, result) => {
        if (err) {
          console.error('Erreur lors de la comparaison:', err);
        } else {
          console.log(`\nLe mot de passe et le hash correspondent : ${result ? '✅ OUI' : '❌ NON'}`);
        }
        rl.close();
      });
    });
  });
}

rl.question('Que voulez-vous faire ? (1: Générer un hash, 2: Comparer un hash) ', (choice) => {
  if (choice === '1') generateHash();
  else if (choice === '2') compareHash();
  else { console.log('Choix invalide.'); rl.close(); }
});