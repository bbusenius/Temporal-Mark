#!/usr/bin/env node

/**
 * @fileoverview MCP Server for Temporal Mark
 * Exposes time tracking functionality through the Model Context Protocol
 * Enables AI assistants to interact with Temporal Mark via standardized tools
 * @version 1.0.0
 */

const path = require('path');
const fs = require('fs');

// Ensure we're running from the correct directory
const scriptDir = __dirname;
const projectDir = path.dirname(scriptDir);

// Change to project directory if we're not already there
if (process.cwd() !== projectDir) {
  if (fs.existsSync(path.join(projectDir, 'package.json'))) {
    process.chdir(projectDir);
  } else {
    console.error(
      `Error: Could not find Temporal Mark project at ${projectDir}`
    );
    process.exit(1);
  }
}

// Import CommonJS modules
const MCPIntegration = require('./mcpIntegration');

// Dynamic imports for ES modules
let Server;
let StdioServerTransport;
let CallToolRequestSchema;
let ListToolsRequestSchema;
let ListResourcesRequestSchema;
let ReadResourceRequestSchema;

async function loadMCPDependencies() {
  // Import from the package exports
  const serverModule = await import(
    // eslint-disable-next-line import/no-unresolved, import/extensions
    '@modelcontextprotocol/sdk/server/index.js'
  );
  // eslint-disable-next-line import/no-unresolved, import/extensions
  const stdioModule = await import('@modelcontextprotocol/sdk/server/stdio.js');
  // eslint-disable-next-line import/no-unresolved, import/extensions
  const typesModule = await import('@modelcontextprotocol/sdk/types.js');

  Server = serverModule.Server;
  StdioServerTransport = stdioModule.StdioServerTransport;
  CallToolRequestSchema = typesModule.CallToolRequestSchema;
  ListToolsRequestSchema = typesModule.ListToolsRequestSchema;
  ListResourcesRequestSchema = typesModule.ListResourcesRequestSchema;
  ReadResourceRequestSchema = typesModule.ReadResourceRequestSchema;
}

/**
 * Temporal Mark MCP Server
 * Provides standardized AI assistant access to time tracking functionality
 */
class TemporalMarkMCPServer {
  constructor() {
    this.mcpIntegration = new MCPIntegration({
      enableLogging: false, // Disable console logs for MCP
      logLevel: 'error',
    });
    this.server = null; // Will be initialized in start()
  }

  /**
   * Initialize the server after loading MCP dependencies
   */
  async initializeServer() {
    this.server = new Server(
      {
        name: 'temporal-mark',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );

    this.setupHandlers();
  }

  /**
   * Set up MCP protocol handlers
   */
  setupHandlers() {
    // Handle tool listing requests
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const capabilities = this.mcpIntegration.getCapabilities();
      return {
        tools: capabilities.tools,
      };
    });

    // Handle tool execution requests
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        const result = await this.mcpIntegration.executeTool(name, args || {});

        // For fiscal year reports, return the markdown directly to avoid JSON truncation
        if (
          name === 'temporal_mark_generate_report' &&
          result.success &&
          result.data &&
          result.data.reportType === 'markdown'
        ) {
          return {
            content: [
              {
                type: 'text',
                text: result.data.report,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: false,
                  error: error.message,
                  toolName: name,
                  mcpCompatible: true,
                },
                null,
                2
              ),
            },
          ],
          isError: true,
        };
      }
    });

    // Handle resource listing requests
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      const capabilities = this.mcpIntegration.getCapabilities();
      return {
        resources: capabilities.resources,
      };
    });

    // Handle resource reading requests
    this.server.setRequestHandler(
      ReadResourceRequestSchema,
      async (request) => {
        const { uri } = request.params;

        try {
          const resource = await this.mcpIntegration.getResource(uri);
          return {
            contents: [
              {
                uri,
                mimeType: resource.mimeType,
                text: resource.content,
              },
            ],
          };
        } catch (error) {
          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(
                  {
                    error: error.message,
                    uri,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }
      }
    );
  }

  /**
   * Start the MCP server
   */
  async start() {
    try {
      // Load MCP dependencies first
      await loadMCPDependencies();

      // Initialize server after loading dependencies
      await this.initializeServer();

      // Initialize the MCP integration layer
      await this.mcpIntegration.initialize();

      // Create and connect transport
      const transport = new StdioServerTransport();
      await this.server.connect(transport);

      // Log startup (to stderr so it doesn't interfere with MCP protocol)
      console.error('Temporal Mark MCP Server started successfully');
      console.error(`Working directory: ${process.cwd()}`);
      console.error(
        `Available tools: ${this.mcpIntegration.getCapabilities().tools.length}`
      );
      console.error(
        `Available resources: ${
          this.mcpIntegration.getCapabilities().resources.length
        }`
      );
    } catch (error) {
      console.error('Failed to start Temporal Mark MCP Server:', error);
      process.exit(1);
    }
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown() {
    try {
      await this.mcpIntegration.cleanup();
      console.error('Temporal Mark MCP Server shutdown complete');
    } catch (error) {
      console.error('Error during MCP server shutdown:', error);
    }
  }
}

// Handle graceful shutdown
async function handleShutdown(server) {
  console.error('Received shutdown signal, cleaning up...');
  await server.shutdown();
  process.exit(0);
}

// Main execution
async function main() {
  const server = new TemporalMarkMCPServer();

  // Set up signal handlers for graceful shutdown
  process.on('SIGINT', () => handleShutdown(server));
  process.on('SIGTERM', () => handleShutdown(server));
  process.on('SIGUSR2', () => handleShutdown(server)); // For nodemon

  // Handle uncaught errors
  process.on('uncaughtException', async (error) => {
    console.error('Uncaught exception in MCP server:', error);
    await server.shutdown();
    process.exit(1);
  });

  process.on('unhandledRejection', async (reason, _promise) => {
    console.error('Unhandled rejection in MCP server:', reason);
    await server.shutdown();
    process.exit(1);
  });

  // Start the server
  await server.start();
}

// Run the server if this file is executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error starting MCP server:', error);
    process.exit(1);
  });
}

module.exports = TemporalMarkMCPServer;
