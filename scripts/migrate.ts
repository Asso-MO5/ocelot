import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { spawn } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Déterminer quel fichier .env utiliser
// Si NODE_ENV=production ou si --prod est passé, utiliser .env.prod
// Sinon utiliser .env.local
const isProd = process.env.NODE_ENV === 'production' || process.argv.includes('--prod');
const envFileName = isProd ? '.env.prod' : '.env.local';
const envPath = join(__dirname, `../${envFileName}`);
try {
  const envContent = readFileSync(envPath, 'utf-8');
  const envLines = envContent.split('\n');

  for (const line of envLines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').replace(/^["']|["']$/g, '');
        process.env[key.trim()] = value.trim();
      }
    }
  }
} catch (err) {
  console.error(`Erreur lors du chargement de ${envFileName}:`, err);
  process.exit(1);
}

console.log(`📦 Chargement des variables depuis ${envFileName}`);

// Exécuter node-pg-migrate avec les arguments passés
// Filtrer --prod des arguments car c'est juste pour nous
const args = process.argv.slice(2).filter(arg => arg !== '--prod');
const migrateProcess = spawn('npx', ['node-pg-migrate', ...args], {
  stdio: 'inherit',
  shell: true,
});

migrateProcess.on('close', (code) => {
  process.exit(code || 0);
});

migrateProcess.on('error', (err) => {
  console.error('Erreur lors de l\'exécution de node-pg-migrate:', err);
  process.exit(1);
});

