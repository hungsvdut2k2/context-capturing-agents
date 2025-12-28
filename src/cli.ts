#!/usr/bin/env node
import "dotenv/config";
import path from "path";
import { initProject } from "./mcp-tools/init-project.js";

const args = process.argv.slice(2);
const command = args[0];

function printUsage() {
  console.log(`
Usage: cca <command> [options]

Commands:
  init [path]    Initialize context capture for a project
                 If no path provided, uses current directory

Options:
  --help, -h     Show this help message

Examples:
  cca init                    # Initialize current directory
  cca init /path/to/project   # Initialize specific project
  cca init .                  # Initialize current directory
`);
}

async function main() {
  if (!command || command === "--help" || command === "-h") {
    printUsage();
    process.exit(0);
  }

  if (command === "init") {
    const projectPath = args[1] ? path.resolve(args[1]) : process.cwd();

    console.log(`\n🚀 Initializing context capture for: ${projectPath}\n`);

    const result = await initProject(projectPath);

    if (result.success) {
      console.log(`\n✅ Project initialized successfully!`);
      console.log(`   Project: ${result.projectName}`);
      console.log(`   Memory:  ${result.memoryPath}\n`);
    } else {
      console.error(`\n❌ Initialization failed: ${result.error}\n`);
      process.exit(1);
    }
  } else {
    console.error(`Unknown command: ${command}`);
    printUsage();
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
