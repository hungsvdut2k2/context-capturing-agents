#!/usr/bin/env node
import "dotenv/config";
import path from "path";
import { initProject } from "./mcp-tools/init-project.js";
import { searchContext } from "./mcp-tools/search-context.js";

const args = process.argv.slice(2);
const command = args[0];

function parseFlags(args: string[]): Record<string, string | boolean> {
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const nextArg = args[i + 1];
      if (nextArg && !nextArg.startsWith("-")) {
        flags[key] = nextArg;
        i++;
      } else {
        flags[key] = true;
      }
    } else if (arg.startsWith("-") && arg.length === 2) {
      const key = arg.slice(1);
      const nextArg = args[i + 1];
      if (nextArg && !nextArg.startsWith("-")) {
        flags[key] = nextArg;
        i++;
      } else {
        flags[key] = true;
      }
    }
  }
  return flags;
}

function printUsage() {
  console.log(`
Usage: cca <command> [options]

Commands:
  init [path]         Initialize context capture for a project
                      If no path provided, uses current directory

  search              Search captured context for relevant knowledge
    --query, -q       The search query (required)
    --dir, -d         Project directory or name (optional, auto-detects from cwd)

Options:
  --help, -h          Show this help message

Examples:
  cca init                              # Initialize current directory
  cca init /path/to/project             # Initialize specific project
  cca search --query "authentication"   # Search in auto-detected project
  cca search -q "API endpoints" -d .    # Search in current directory project
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
  } else if (command === "search") {
    const flags = parseFlags(args.slice(1));

    // Support both --query and -q, --dir and -d
    const query = (flags.query || flags.q) as string | undefined;
    const dir = (flags.dir || flags.d) as string | undefined;

    if (!query) {
      console.error("\n❌ Error: --query (-q) is required for search\n");
      printUsage();
      process.exit(1);
    }

    // Resolve project info from directory if provided
    let projectName: string | undefined;
    let projectPath: string | undefined;

    if (dir) {
      projectPath = path.resolve(dir);
      projectName = path.basename(projectPath);
    }

    console.log(`\n🔍 Searching for: "${query}"\n`);

    const result = await searchContext({
      query,
      projectName,
      projectPath,
    });

    if (result.success) {
      console.log(`\n📚 Results from project: ${result.projectName}\n`);
      console.log("─".repeat(50));
      console.log(result.result);
      console.log("─".repeat(50) + "\n");
    } else {
      console.error(`\n❌ Search failed: ${result.error}\n`);
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
