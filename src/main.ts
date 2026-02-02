/**
 * Kaldi - Your Loyal AI Coding Companion
 *
 * A BYOK (Bring Your Own Key) CLI coding assistant.
 * Named after the Great Pyrenees who loves coffee.
 */

import { parseArgs, getHelpText, REPL } from "./cli/index.js";
import { handleBeans, handleDoctor, handleRefill, handleRoast } from "./cli/commands.js";
import { initializeProviders } from "./providers/index.js";
import { initializeMCP } from "./mcp/index.js";
import { c } from "./ui/theme/colors.js";

const VERSION = "1.0.0";

/**
 * Main entry point
 */
async function main(): Promise<void> {
  // Parse command line arguments
  const options = parseArgs(process.argv.slice(2));

  // Handle --help
  if (options.help) {
    console.log(getHelpText());
    process.exit(0);
  }

  // Handle --version
  if (options.version) {
    console.log(`Kaldi v${VERSION}`);
    process.exit(0);
  }

  // Handle subcommands
  if (options.command) {
    switch (options.command) {
      case "beans":
        await handleBeans(options);
        process.exit(0);
      case "doctor":
        await handleDoctor(options);
        process.exit(0);
      case "refill":
        await handleRefill(options);
        process.exit(0);
      case "roast":
        await handleRoast(options);
        process.exit(0);
    }
  }

  try {
    // Initialize providers
    await initializeProviders();

    // Initialize MCP (non-blocking)
    initializeMCP().catch((err) => {
      if (options.verbose) {
        console.error(c.dim(`MCP initialization warning: ${err.message}`));
      }
    });

    // Create REPL
    const repl = new REPL(options);

    // Run single prompt or start interactive mode
    if (options.prompt) {
      await repl.runOnce(options.prompt);
      process.exit(0);
    } else {
      await repl.start();
    }
  } catch (error) {
    console.error(c.error(`Error: ${error instanceof Error ? error.message : String(error)}`));
    process.exit(1);
  }
}

// Handle uncaught errors
process.on("uncaughtException", (error) => {
  console.error(c.error(`Uncaught error: ${error.message}`));
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error(c.error(`Unhandled rejection: ${reason}`));
  process.exit(1);
});

// Run main
main();
