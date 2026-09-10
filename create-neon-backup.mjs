import dotenv from 'dotenv';
dotenv.config();

// Extract Neon project details from DATABASE_URL
const dbUrl = process.env.DATABASE_URL;
const match = dbUrl.match(/https:\/\/(.+?)@(.+?)\.(.+?)\.neon\.tech/);

if (!match) {
  console.error('❌ Could not parse Neon connection string');
  process.exit(1);
}

const [, , projectId, region] = match;

console.log('⚠️  BACKUP REQUIREMENT');
console.log('================================================================================');
console.log('Before proceeding with the production migration, create a Neon restore point:');
console.log('');
console.log('1. Go to: https://console.neon.tech/app/projects/' + projectId);
console.log('2. Navigate to "Restore" → "Create restore point"');
console.log('3. Name it: "pre-reconciliation-' + new Date().toISOString().split('T')[0] + '"');
console.log('4. Confirm the restore point was created successfully');
console.log('');
console.log('Alternatively, use the Neon API:');
console.log('');
console.log('  curl -X POST https://console.neon.tech/api/v2/projects/' + projectId + '/branches \\');
console.log('    -H "Authorization: Bearer $NEON_API_KEY" \\');
console.log('    -H "Content-Type: application/json" \\');
console.log('    -d \'{"branch":{"name":"backup-' + Date.now() + '"}}\'');
console.log('');
console.log('================================================================================');
console.log('');
console.log('✓ Preflight passed - ready to proceed after backup is confirmed');
