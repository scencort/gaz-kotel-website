const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const envPath = path.join(ROOT, '.env');

const requiredDeployFiles = [
  'deploy/gaz-kotel.service',
  'deploy/nginx-gaz-kotel.conf',
  'deploy/nginx-gaz-kotel-ssl.conf',
  '.env.example',
  '.env.production.example'
];

const requiredEnvVars = [
  'PORT',
  'DATABASE_URL',
  'ADMIN_API_KEY',
  'TRUST_PROXY',
  'RATE_LIMIT_WINDOW_MS',
  'RATE_LIMIT_MAX'
];

function parseEnv(text) {
  return text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))
    .reduce((acc, line) => {
      const idx = line.indexOf('=');
      if (idx === -1) return acc;
      const key = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).trim();
      acc[key] = value;
      return acc;
    }, {});
}

function checkDeployFiles() {
  const missing = requiredDeployFiles.filter(relPath => !fs.existsSync(path.join(ROOT, relPath)));
  if (!missing.length) {
    console.log('OK: deploy files are present');
    return true;
  }

  console.error('ERROR: missing deploy files:');
  missing.forEach(item => console.error(' - ' + item));
  return false;
}

function checkEnvFile() {
  if (!fs.existsSync(envPath)) {
    console.warn('WARN: .env was not found (expected for local validation before deploy).');
    return true;
  }

  const env = parseEnv(fs.readFileSync(envPath, 'utf8'));
  const missing = requiredEnvVars.filter(key => !env[key]);

  if (missing.length) {
    console.error('ERROR: missing required env vars in .env:');
    missing.forEach(key => console.error(' - ' + key));
    return false;
  }

  if (String(env.ADMIN_API_KEY || '').toLowerCase().includes('replace_with')) {
    console.error('ERROR: ADMIN_API_KEY still uses placeholder value.');
    return false;
  }

  if (!String(env.DATABASE_URL || '').startsWith('postgresql://')) {
    console.error('ERROR: DATABASE_URL should start with postgresql://');
    return false;
  }

  console.log('OK: .env basic checks passed');
  return true;
}

function main() {
  console.log('Predeploy check started...');

  const okFiles = checkDeployFiles();
  const okEnv = checkEnvFile();

  if (okFiles && okEnv) {
    console.log('Predeploy check passed.');
    process.exit(0);
  }

  console.error('Predeploy check failed.');
  process.exit(1);
}

main();
