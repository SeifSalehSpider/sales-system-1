// Run on the developer/licensing machine only; never ship the private key.
// Usage: node tools/generate-license.js --create-keys
//        node tools/generate-license.js --issue <private-key.pem> CUSTOMER-001
const fs = require('fs');
const crypto = require('crypto');

const args = process.argv.slice(2);
if (args[0] === '--create-keys') {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });
  fs.writeFileSync('license-private.pem', privateKey, { mode: 0o600 });
  fs.writeFileSync('license-public.pem', publicKey);
  console.log('Created license-private.pem and license-public.pem');
  console.log('Copy only license-public.pem into main.js. Keep license-private.pem offline.');
  process.exit(0);
}

if (args[0] === '--issue' && args[1] && args[2]) {
  const privateKey = fs.readFileSync(args[1], 'utf8');
  const days = Number(args[3] || 3650);
  const payload = JSON.stringify({ customer: args[2], issuedAt: new Date().toISOString(), expiresAt: Date.now() + days * 86400000 });
  const signature = crypto.sign(null, Buffer.from(payload), privateKey).toString('base64url');
  console.log(Buffer.from(JSON.stringify({ payload, signature })).toString('base64url'));
  process.exit(0);
}

console.error('Usage: --create-keys OR --issue <private-key.pem> CUSTOMER-ID [DAYS]');
process.exit(1);
