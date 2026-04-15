# php-container-test-mcp

An MCP (Model Context Protocol) server that lets AI agents run PHP unit and integration tests inside Docker containers — no local PHP or Composer installation required on the host.

## What it does

Exposes two MCP tools:

- **`run_php_tests`** — runs the full test suite
- **`run_php_test_file`** — runs a single test file

Both execute `docker run --rm -v <host_path>:<container_path> -w <container_path> <image> composer <command> [-- <test_file>]` and return the full stdout + stderr so the caller can evaluate pass/fail.

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

### Via npm (recommended)

```bash
npm install -g php-container-test-mcp
```

### From source

```bash
git clone https://github.com/your-user/php-container-test-mcp
cd php-container-test-mcp
npm install
```

## Registering with Claude Code

Add the server to your project's `.mcp.json` for project-scoped access, or to `~/.claude/claude_desktop_config.json` for global access.

The server accepts named arguments to configure defaults. All three can also be overridden per tool call.

| Argument | Description | Default |
|---|---|---|
| `--container` | Docker image name | (required) |
| `--command` | Composer script name to execute | `test` |
| `--host-path` | Host project path to mount | current working directory |
| `--container-path` | Mount path inside the container | `/var/www` |

### Using the npm package (after `npm install -g`)

```json
{
  "mcpServers": {
    "php-container-test": {
      "command": "php-container-test-mcp",
      "args": ["--container=my-php-app:latest", "--command=test", "--host-path=/home/user/my-project", "--container-path=/var/www"]
    }
  }
}
```

### Using npx (no install required)

```json
{
  "mcpServers": {
    "php-container-test": {
      "command": "npx",
      "args": ["-y", "php-container-test-mcp", "--container=my-php-app:latest", "--command=test", "--host-path=/home/user/my-project", "--container-path=/var/www"]
    }
  }
}
```

### From source (local path)

```json
{
  "mcpServers": {
    "php-container-test": {
      "command": "node",
      "args": ["/absolute/path/to/php-container-test-mcp/src/index.js", "--container=my-php-app:latest", "--command=test", "--host-path=/home/user/my-project", "--container-path=/var/www"]
    }
  }
}
```

Then restart Claude Code. The `run_php_tests` and `run_php_test_file` tools will be available automatically.

## Tool reference

### `run_php_tests` — run the full test suite

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `container_name` | string | Yes | server arg | Docker image to run (e.g. `my-php-app:latest`) |
| `command` | string | No | `"test"` | Composer script name to execute |
| `host_path` | string | No | server arg or cwd | Absolute path to the project on the host to mount into the container |
| `container_path` | string | No | server arg or `/var/www` | Path inside the container where the project will be mounted |

### `run_php_test_file` — run a single test file

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `container_name` | string | Yes | server arg | Docker image to run (e.g. `my-php-app:latest`) |
| `test_file` | string | Yes | — | Path to the test file inside the container (e.g. `tests/Unit/UserTest.php`) |
| `command` | string | No | `"test"` | Composer script name to execute |
| `host_path` | string | No | server arg or cwd | Absolute path to the project on the host to mount into the container |
| `container_path` | string | No | server arg or `/var/www` | Path inside the container where the project will be mounted |

## Example prompts

Run all tests:
```
Run the tests for the my-php-app:latest container.
```

Run only unit tests using a specific Composer script:
```
Run only the unit tests using the test:unit script for container my-php-app:latest.
```

Run a single test file:
```
Run tests/Unit/UserTest.php in the my-php-app:latest container.
```

Override mount paths:
```
Run the tests for my-php-app:latest, mounting /home/user/my-project on the host to /app inside the container.
```

## Example tool calls

**`run_php_tests`** — full suite with defaults:
```json
{
  "container_name": "my-php-app:latest"
}
```

**`run_php_tests`** — specific Composer script:
```json
{
  "container_name": "my-php-app:latest",
  "command": "test:unit"
}
```

**`run_php_test_file`** — single test file:
```json
{
  "container_name": "my-php-app:latest",
  "test_file": "tests/Unit/UserTest.php"
}
```

**`run_php_tests`** — override mount paths:
```json
{
  "container_name": "my-php-app:latest",
  "host_path": "/home/user/my-project",
  "container_path": "/app"
}
```

## How it works

1. The server is launched by the MCP host (Claude Code) and communicates over stdin/stdout using the JSON-RPC 2.0 MCP protocol.
2. When a tool is called, the server executes:
   ```
   docker run --rm -v <host_path>:<container_path> -w <container_path> <image> composer <command> [-- <test_file>]
   ```
3. `--rm` ensures the container is automatically removed after each run.
4. The combined stdout + stderr is returned to the calling agent.

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
