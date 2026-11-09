#!/usr/bin/env node

const { execSync } = require('child_process');

try {
  console.log('Adding all changes...');
  execSync('git add .', { stdio: 'inherit' });
  
  console.log('Committing with message: "feat: add git execution"');
  execSync('git commit -m "feat: add git execution"', { stdio: 'inherit' });
  
  console.log('Pushing to main...');
  execSync('git push origin main', { stdio: 'inherit' });
  
  console.log('✓ Successfully committed and pushed changes!');
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
