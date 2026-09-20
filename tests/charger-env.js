// Charge .env pour les tests d'API (Metro ne le fait que pour l'app).
const fs = require('fs');
const path = require('path');

try {
  const contenu = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
  for (const ligne of contenu.split('\n')) {
    const correspondance = ligne.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (correspondance && !(correspondance[1] in process.env)) {
      process.env[correspondance[1]] = correspondance[2];
    }
  }
} catch {
  // Pas de .env : les variables doivent déjà être dans l'environnement.
}
