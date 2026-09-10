const { Client } = require('pg');
const fs = require('fs');
require('dotenv').config();

async function runPreflight() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to production database');

    const sql = fs.readFileSync('preflight-verification.sql', 'utf8');
    
    // Split by \echo commands and execute sections
    const sections = sql.split(/\\echo\s+'[^']+'/);
    const echoMatches = sql.match(/\\echo\s+'([^']+)'/g) || [];
    
    for (let i = 0; i < sections.length; i++) {
      if (echoMatches[i]) {
        const header = echoMatches[i].replace(/\\echo\s+'(.+)'/, '$1');
        console.log('\n' + '='.repeat(80));
        console.log(header);
        console.log('='.repeat(80));
      }
      
      const section = sections[i].trim();
      if (!section) continue;
      
      // Execute each statement in the section
      const statements = section.split(';').filter(s => s.trim() && !s.trim().startsWith('--'));
      
      for (const stmt of statements) {
        const trimmed = stmt.trim();
        if (!trimmed) continue;
        
        try {
          const result = await client.query(trimmed);
          if (result.rows && result.rows.length > 0) {
            console.table(result.rows);
          } else if (result.command === 'DO') {
            // DO blocks print via NOTICE
          }
        } catch (err) {
          // Some queries are expected to fail (e.g., missing tables in catalog queries)
          if (err.message.includes('does not exist')) {
            console.log(`⚠️  ${err.message}`);
          } else {
            console.error(`Error: ${err.message}`);
          }
        }
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('PREFLIGHT VERIFICATION COMPLETE');
    console.log('='.repeat(80));
    
  } catch (err) {
    console.error('Fatal error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runPreflight();
