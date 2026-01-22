#!/usr/bin/env node

// A script to properly handle command line arguments in yarn start
const { spawn } = require('child_process');
const args = process.argv.slice(2);

// Check if --dev flag is included
const hasDevFlag = args.includes('--dev');

// Command arguments for Expo start
const expoArgs = ['expo', 'start'];

// Add any other arguments except --dev
args.forEach(arg => {
  if (arg !== '--dev') {
    expoArgs.push(arg);
  }
});

// Set EXPO_PUBLIC_DEV_MODE environment variable
const env = {
  ...process.env,
  EXPO_PUBLIC_DEV_MODE: hasDevFlag ? 'true' : 'false'
};

// Clear console for better visibility
console.clear();

// Display prominent message about mode
if (hasDevFlag) {
  console.log('\n');
  console.log('🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢');
  console.log('🟢                                                     🟢');
  console.log('🟢              STARTING IN DEV MODE                   🟢');
  console.log('🟢                                                     🟢');
  console.log('🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢');
  console.log('\n');
} else {
  console.log('\n');
  console.log('▶️▶️▶️▶️▶️▶️▶️▶️▶️▶️▶️▶️▶️▶️▶️▶️▶️▶️▶️▶️▶️▶️▶️▶️▶️▶️▶️▶️▶️▶️');
  console.log('▶️                                                     ▶️');
  console.log('▶️            STARTING IN STANDARD MODE                ▶️');
  console.log('▶️                                                     ▶️');
  console.log('▶️▶️▶️▶️▶️▶️▶️▶️▶️▶️▶️▶️▶️▶️▶️▶️▶️▶️▶️▶️▶️▶️▶️▶️▶️▶️▶️▶️▶️▶️');
  console.log('\n');
}

// Run expo start with the correct arguments and environment variables
const expo = spawn('npx', expoArgs, { stdio: 'inherit', env });

expo.on('close', code => {
  process.exit(code);
}); 