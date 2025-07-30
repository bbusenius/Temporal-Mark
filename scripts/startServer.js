#!/usr/bin/env node

/**
 * @fileoverview API server launcher script
 * Simple script to start the Temporal Mark REST API server
 */

const ApiServer = require('./apiServer');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {};

args.forEach((arg) => {
  if (arg.startsWith('--port=')) {
    options.port = parseInt(arg.split('=')[1], 10);
  } else if (arg.startsWith('--host=')) {
    options.host = arg.split('=')[1];
  } else if (arg === '--no-cors') {
    options.enableCors = false;
  } else if (arg === '--no-security') {
    options.enableSecurity = false;
  }
});

// Create and start server
const server = new ApiServer(options);

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  await server.stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down gracefully...');
  await server.stop();
  process.exit(0);
});

// Start the server
server.start().catch((error) => {
  console.error('Failed to start server:', error.message);
  process.exit(1);
});
