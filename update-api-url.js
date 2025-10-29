#!/usr/bin/env node

// Simple script to update the API URL in the frontend
const fs = require('fs');
const path = require('path');

const newApiUrl = process.argv[2];

if (!newApiUrl) {
  console.log('Usage: node update-api-url.js <your-railway-url>');
  console.log('Example: node update-api-url.js https://sports-betting-production.railway.app');
  process.exit(1);
}

const userStorePath = path.join(__dirname, 'src', 'stores', 'userStore.js');

try {
  let content = fs.readFileSync(userStorePath, 'utf8');
  
  // Replace the API_BASE_URL
  content = content.replace(
    /const API_BASE_URL = 'http:\/\/localhost:3001\/api'/,
    `const API_BASE_URL = '${newApiUrl}/api'`
  );
  
  fs.writeFileSync(userStorePath, content);
  
  console.log('✅ API URL updated successfully!');
  console.log(`Frontend will now use: ${newApiUrl}/api`);
  console.log('\nNext steps:');
  console.log('1. Deploy your frontend to Vercel/Netlify');
  console.log('2. Test your deployed app!');
  
} catch (error) {
  console.error('❌ Error updating API URL:', error.message);
  process.exit(1);
}
