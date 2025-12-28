# Context Capturing Agents

An MCP (Model Context Protocol) server that automatically explores codebases and creates structured knowledge bases using AI agents. Works with Claude Code and other MCP-compatible tools.

## Features

- **Automatic Codebase Exploration**: AI agents analyze your project structure, patterns, and architecture
- **Structured Knowledge Base**: Creates organized context trees with domains and topics
- **Semantic Search**: Query your codebase knowledge in natural language
- **Context Sync**: Keep your knowledge base up-to-date as code changes
- **Multi-source Integration**: Incorporates existing AI context files (CLAUDE.md, .cursor/rules, etc.)

## Installation

```bash
# Clone the repository
git clone https://github.com/hungsvdut2k2/context-capturing-agents.git
cd context-capturing-agents

# Install dependencies
npm install

# Build the project
npm run build

# (Optional) Install CLI globally
npm link
```

## Configuration

### Environment Variables

Create a `.env` file or set these environment variables:

```bash
OPENAI_API_KEY=your-openai-api-key    # Required
OPENAI_MODEL=gpt-4o                    # Optional, default: gpt-4o
OPENAI_TEMPERATURE=0                   # Optional, default: 0
LOG_LEVEL=INFO                         # Optional: DEBUG, INFO, WARN, ERROR
```

## Usage

### CLI

The `cca` command provides direct access to all features:

```bash
# Initialize context capturing for a project
cca init                              # Current directory
cca init /path/to/project             # Specific project path

# Search the knowledge base
cca search --query "How does authentication work?"
cca search -q "API endpoints" -d /path/to/project

# Update context after making changes
cca update --context "Added JWT authentication middleware"
cca update -c "Refactored user service to repository pattern"

# Show help
cca --help
```

### MCP Server with Claude Code

#### Step 1: Configure Claude Code

Create `.mcp.json` in your project root (or `~/.claude/settings.json` for global config):

```json
{
  "mcpServers": {
    "context-capturing-agents": {
      "command": "node",
      "args": ["/absolute/path/to/context-capturing-agents/dist/index.js"],
      "env": {
        "OPENAI_API_KEY": "your-openai-api-key"
      }
    }
  }
}
```

#### Step 2: Restart Claude Code

The MCP server will be loaded automatically.

#### Step 3: Verify Connection

Run `/mcp` in Claude Code to see `context-capturing-agents` listed.

### MCP Tools

Once configured, Claude Code has access to these tools:

| Tool | Description | When to Use |
|------|-------------|-------------|
| `init_project` | Initialize context capturing for a project | First time setup, or when starting work on a new codebase |
| `search_context` | Search knowledge base for architecture and patterns | When asking "how does X work?" or understanding existing code |
| `update_context` | Sync knowledge base with code changes | After implementing features, refactoring, or changing architecture |

#### Example Interactions

```
User: "How does the authentication system work?"
Claude: [Uses search_context to find relevant knowledge]

User: "I just added a new payment module"
Claude: [Uses update_context to record the change]

User: "Set up context capturing for this project"
Claude: [Uses init_project to explore and build knowledge base]
```

## How It Works

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      MCP Server                              │
│  ┌─────────────┐  ┌────────────────┐  ┌──────────────────┐  │
│  │ init_project│  │ search_context │  │ update_context   │  │
│  └──────┬──────┘  └───────┬────────┘  └────────┬─────────┘  │
└─────────┼─────────────────┼────────────────────┼────────────┘
          │                 │                    │
          ▼                 ▼                    ▼
┌─────────────────┐ ┌───────────────┐ ┌───────────────────────┐
│ Explorer Agent  │ │ Searcher Agent│ │ Updater Agent         │
│ + Writer Agent  │ │               │ │                       │
└────────┬────────┘ └───────┬───────┘ └───────────┬───────────┘
         │                  │                     │
         ▼                  ▼                     ▼
┌─────────────────────────────────────────────────────────────┐
│                   Knowledge Base                             │
│  ~/.context-capturing-agents/{project}/                      │
│    ├── Architecture/                                         │
│    │   ├── overview.md                                       │
│    │   └── patterns.md                                       │
│    ├── API/                                                  │
│    │   ├── endpoints.md                                      │
│    │   └── authentication.md                                 │
│    └── Frontend/                                             │
│        └── components.md                                     │
└─────────────────────────────────────────────────────────────┘
```

### Agents

1. **Explorer Agent**: Reads project structure, key files, and existing AI context files. Creates exploration notes.

2. **Writer Agent**: Organizes exploration findings into structured domains and topics.

3. **Searcher Agent**: Understands natural language queries and finds relevant knowledge.

4. **Updater Agent**: Analyzes code changes and decides what to update, create, or delete in the knowledge base.

### Knowledge Base Structure

```
~/.context-capturing-agents/
└── {project-name}/
    └── {domain}/           # e.g., Architecture, API, Frontend
        └── {topic}.md      # e.g., authentication.md, components.md
```

## Development

```bash
# Build
npm run build

# Watch mode
npm run dev

# Run MCP server
npm start

# Enable debug logging
LOG_LEVEL=DEBUG npm start
```

## Dependencies

- `@modelcontextprotocol/sdk` - MCP server SDK
- `@langchain/langgraph` - Agent orchestration
- `@langchain/openai` - OpenAI LLM integration
- `zod` - Schema validation

## License

ISC

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.
