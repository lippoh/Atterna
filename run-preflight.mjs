import pg from 'pg';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;

async function runPreflight() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✓ Connected to production database\n');

    const sql = fs.readFileSync('preflight-verification.sql', 'utf8');
    
    // Remove \echo commands and extract headers
    const lines = sql.split('\n');
    let currentSection = '';
    let statements = [];
    
    for (const line of lines) {
      if (line.trim().startsWith('\\echo')) {
        // Execute previous section
        if (statements.length > 0) {
          await executeStatements(client, statements.join('\n'));
          statements = [];
        }
        // Print header
        const header = line.match(/\\echo '(.+)'/)?.[1] || '';
        console.log('\n' + header);
        console.log('-'.repeat(80));
      } else if (line.trim() && !line.trim().startsWith('--')) {
        statements.push(line);
      }
    }
    
    // Execute final section
    if (statements.length > 0) {
      await executeStatements(client, statements.join('\n'));
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('PREFLIGHT VERIFICATION COMPLETE - Review output above');
    console.log('='.repeat(80));
    
  } catch (err) {
    console.error('Fatal error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

async function executeStatements(client, sqlBlock) {
  const trimmed = sqlBlock.trim();
  if (!trimmed) return;
  
  try {
    const result = await client.query(trimmed);
    if (result.rows && result.rows.length > 0) {
      console.table(result.rows);
    }
  } catch (err) {
    if (err.message.includes('does not exist') || err.message.includes('relation')) {
      console.log(`⚠️  ${err.message.split('\n')[0]}`);
    } else {
      console.error(`❌ Error: ${err.message}`);
    }
  }
}

// Handle client notices (for DO blocks with RAISE NOTICE)
process.on('uncaughtException', (err) => {
  if (!err.message.includes('notice')) {
    throw err;
  }
});

runPreflight();
