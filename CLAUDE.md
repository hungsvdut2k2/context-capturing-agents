# Context Capturing Agents - MCP Server

An MCP (Model Context Protocol) server for Claude Code that automatically explores codebases and creates structured context trees using AI agents.

## Project Structure

```
src/
├── index.ts                    # MCP server entry point
├── state/
│   └── index.ts                # LangGraph state definition (AgentStateType)
├── prompts/
│   ├── index.ts                # Prompts exports
│   ├── explorer.ts             # Explorer agent system prompt
│   └── writer.ts               # Writer agent system prompt
├── tools/
│   ├── index.ts                # Tools exports
│   ├── explorer.ts             # Explorer agent tools (read_file, list_directory, search_files, write_exploration, update_exploration)
│   └── writer.ts               # Writer agent tools (read_exploration, write_context, update_context, list_context, read_context)
├── agents/
│   ├── index.ts                # Agents exports
│   ├── explorer.ts             # Explorer agent (LangGraph React Agent)
│   └── writer.ts               # Writer agent (LangGraph React Agent)
├── mcp-tools/
│   ├── index.ts                # MCP tools exports
│   └── init-project.ts         # init_project tool orchestration
├── memory/
│   ├── index.ts                # Memory module exports + getMemoryBasePath()
│   ├── read.ts                 # Read operations (readContext, readDomain, listProjectStructure, listProjects)
│   ├── write.ts                # Write operations (writeContext, createDomain, initProject)
│   ├── update.ts               # Update operations (updateContext, appendContext, renameTopic, renameDomain)
│   └── delete.ts               # Delete operations (deleteContext, deleteDomain, deleteProject)
└── utils/
    ├── openai.ts               # OpenAI client (legacy, not currently used - using @langchain/openai instead)
    ├── filesystem.ts           # File system helpers (getDirectoryStructure, findKeyFiles, findSourceFiles, etc.)
    └── logger.ts               # Logging utility with configurable log levels
```

## Architecture

### Flow
1. User calls `init_project` MCP tool with a project path
2. State is created with: `projectPath`, `projectName`, `memoryPath`, `explorationPath`
3. Explorer agent runs:
   - Uses tools to read project structure, key files, source files
   - Writes findings to `EXPLORATION.md`
4. Writer agent runs:
   - Reads `EXPLORATION.md`
   - Organizes content into Domain/Topic structure
   - Creates markdown files in the context tree

### State (injected into tools)
```typescript
interface AgentStateType {
  messages: BaseMessage[];
  projectPath: string;      // Path to project being analyzed
  projectName: string;      // Project directory name
  memoryPath: string;       // ~/.context-capturing-agents/{projectName}/
  explorationPath: string;  // {memoryPath}/EXPLORATION.md
}
```

### Context Tree Structure
```
~/.context-capturing-agents/
└── {project-name}/
    ├── EXPLORATION.md          # Raw exploration findings
    └── {domain}/               # e.g., Architecture, API, Frontend
        └── {topic}.md          # e.g., authentication.md, components.md
```

## Key Design Decisions

1. **State injection into tools**: Tools receive state directly so agents don't need to pass paths in messages
2. **Separation of concerns**:
   - `prompts/` - System prompts only
   - `tools/` - Tool definitions with state injection
   - `agents/` - Integrated agents (prompts + tools)
3. **Memory module is internal**: CRUD operations not exposed as MCP tools, only used by agents
4. **Single exploration file**: `EXPLORATION.md` per project, not multiple research files
5. **LangGraph React Agent**: Using `@langchain/langgraph` for agent implementation with OpenAI

## Dependencies

- `@modelcontextprotocol/sdk` - MCP server SDK
- `@langchain/langgraph` - Agent framework
- `@langchain/openai` - OpenAI LLM integration
- `@langchain/core` - LangChain core utilities
- `openai` - OpenAI SDK (for potential direct API use)
- `glob` - File pattern matching
- `fs-extra` - Enhanced file system operations
- `zod` - Schema validation for tools

## Usage

### Build
```bash
npm run build
```

### Run
```bash
npm start
```

### Environment Variables
- `OPENAI_API_KEY` - Required for AI agent functionality
- `LOG_LEVEL` - Controls logging verbosity (DEBUG, INFO, WARN, ERROR). Default: INFO

### Debugging

The project includes comprehensive logging throughout all components. Logs are written to stderr (since MCP uses stdout for communication).

**Log Levels:**
- `DEBUG` - Detailed information for debugging (tool calls, file operations, agent steps)
- `INFO` - General operational information (agent start/stop, file writes)
- `WARN` - Warning conditions (file not found, permission issues)
- `ERROR` - Error conditions that don't stop execution

**Enable debug logging:**
```bash
LOG_LEVEL=DEBUG npm start
```

**Log format:**
```
[2025-01-15T10:30:45.123Z] [INFO] [agent:explorer] Running explorer agent {"projectName":"my-project"}
```

**Logged components:**
- `mcp-server` - Server startup, tool calls
- `init-project` - Project initialization orchestration
- `agent:explorer` - Explorer agent lifecycle
- `agent:writer` - Writer agent lifecycle
- `tools:explorer` - Explorer tool invocations (read_file, list_directory, search_files, etc.)
- `tools:writer` - Writer tool invocations (write_context, update_context, etc.)
- `utils:filesystem` - File system operations

## TODO / Future Work

- [ ] Add more MCP tools for reading/querying the context tree
- [ ] Add project update/sync functionality
- [ ] Add configuration options (model selection, depth limits, etc.)
- [ ] Add error handling and retry logic for agent failures
- [ ] Consider adding vector embeddings for semantic search
- [ ] Add tests