# php-container-test

An MCP (Model Context Protocol) server that lets AI agents run PHP unit and integration tests inside Docker containers — no local PHP or Composer installation required on the host.

## What it does

Exposes a single MCP tool, `run_php_tests`, that:

1. Accepts a Docker image name, an optional Composer script name, and an optional test file path.
2. Optionally checks whether the test file exists inside the container before running.
3. Executes `docker run --rm <image> composer <command> [-- <test_file>]`.
4. Returns the full stdout + stderr output so the caller can evaluate pass/fail.

## Prerequisites

- **Node.js** ≥ 18
- **Docker** installed and running on the host
- A Docker image that includes PHP, Composer, and a Composer script for running tests (e.g. `phpunit`, `pest`)

### Example `composer.json` scripts section inside your PHP image

```json
"scripts": {
  "test": "vendor/bin/phpunit",
  "test:unit": "vendor/bin/phpunit --testsuite unit",
  "test:integration": "vendor/bin/phpunit --testsuite integration"
}
```

## Installation

```bash
git clone <this-repo>
cd php-container-test
npm install
```

## Registering with Claude Code

Add the server to your project's `.mcp.json` (or `~/.claude/claude_desktop_config.json` for global registration):

```json
{
  "mcpServers": {
    "php-container-test": {
      "command": "node",
      "args": ["/absolute/path/to/php-container-test/src/index.js"]
    }
  }
}
```

Then restart Claude Code. The `run_php_tests` tool will be available automatically.

## Tool reference

**Tool name:** `run_php_tests`

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `container_name` | string | Yes | — | Docker image to run (e.g. `my-php-app:latest`) |
| `command` | string | No | `"test"` | Composer script name to execute |
| `test_file` | string | No | — | Path to a specific test file inside the container |

### Behavior for `test_file`

- If provided, the server first checks whether the file exists inside the container.
- **File found:** runs `composer <command> -- <test_file>`.
- **File not found:** runs `composer <command>` (full suite) and prepends a notice to the output.

## Example prompts

```
Run the tests for the my-php-app:latest container.
```

```
Run only the unit tests using the test:unit script for container my-php-app:latest.
```

```
Run tests/Unit/UserTest.php in the my-php-app:latest container.
```

## How it works

1. The server is launched by the MCP host (Claude Code) and communicates over stdin/stdout using the JSON-RPC 2.0 MCP protocol.
2. When `run_php_tests` is called, if a `test_file` was provided the server runs:
   ```
   docker run --rm --entrypoint test <image> -f <test_file>
   ```
   to determine file existence without executing the test suite.
3. The main command is then:
   ```
   docker run --rm <image> composer <command> [-- <test_file>]
   ```
4. `--rm` ensures the container is automatically removed after each run.
5. The combined stdout + stderr is returned to the calling agent.

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `docker: command not found` | Ensure Docker is installed and in `$PATH` for the user running the MCP server |
| `Unable to find image '...' locally` | Pull the image first: `docker pull <image>` |
| `Script "test" is not defined` | Add a `test` script to `composer.json` inside your Docker image |
| No output returned | The container may have exited immediately — check the image entrypoint |
| Tests time out for large suites | The server uses a 10 MB output buffer; the process itself has no hard timeout — Docker will run until the suite finishes |

## License

MIT
