#!/usr/bin/env node

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_FILE_PATH = path.join(__dirname, '..', 'app-config.json');
const SAMPLE_CONFIG_PATH = path.join(__dirname, '..', 'app-config.sample.json');

async function checkConfigFile() {
  try {
    // Check if config file exists
    await fs.access(CONFIG_FILE_PATH);
    console.log('✅ Configuration file found at', CONFIG_FILE_PATH);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.error('❌ Configuration file not found at', CONFIG_FILE_PATH);
      console.error('');
      console.error('To fix this issue:');
      console.error('1. Copy app-config.sample.json to app-config.json');
      console.error('2. Configure the application settings in app-config.json');
      console.error('');
      
      try {
        // Check if sample file exists
        await fs.access(SAMPLE_CONFIG_PATH);
        console.error('Example:');
        console.error('  cp app-config.sample.json app-config.json');
      } catch (sampleError) {
        console.error('⚠️  Sample configuration file also not found at', SAMPLE_CONFIG_PATH);
      }
      
      console.error('');
      console.error('Shutting down to prevent infinite redirect loops...');
      return false;
    } else {
      console.error('❌ Error checking configuration file:', error.message);
      return false;
    }
  }
}

// Run the check
const configExists = await checkConfigFile();
if (!configExists) {
  process.exit(1);
}