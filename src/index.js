#!/usr/bin/env node
'use strict';

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = require('zod');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);

const MAX_BUFFER = 10 * 1024 * 1024; // 10 MB

function parseArgs(argv) {
  const args = {};
  for (const arg of argv.slice(2)) {
    const eqIndex = arg.indexOf('=');
    const key = eqIndex === -1 ? arg : arg.slice(0, eqIndex);
    const value = eqIndex === -1 ? undefined : arg.slice(eqIndex + 1);
    if (key === '--container') args.container = value;
    else if (key === '--command') args.command = value;
    else if (key === '--host-path') args.hostPath = value;
    else if (key === '--container-path') args.containerPath = value;
  }
  return args;
}

const { container: CONTAINER_NAME, command: DEFAULT_COMMAND, hostPath: DEFAULT_HOST_PATH, containerPath: DEFAULT_CONTAINER_PATH } = parseArgs(process.argv);

/**
 * Build and execute the docker run command, returning combined output.
 */
async function runTests({ containerName, command, testFile, hostPath, containerPath }) {
  const resolvedHostPath = hostPath || process.cwd();
  const resolvedContainerPath = containerPath || '/var/www';

  const args = ['run', '--rm', '-v', resolvedHostPath + ':' + resolvedContainerPath, '-w', resolvedContainerPath, containerName, 'composer', command];

  if (testFile) {
    args.push('--', testFile);
  }

  process.stderr.write('[php-container-test-mcp] Running: docker ' + args.join(' ') + '\n');

  try {
    const { stdout, stderr } = await execFileAsync('docker', args, {
      maxBuffer: MAX_BUFFER,
    });
    const output = stdout + (stderr ? '\n--- stderr ---\n' + stderr : '');
    return { success: true, output };
  } catch (err) {
    // execFile rejects on non-zero exit; stdout/stderr are still populated
    const raw = (err.stdout || '') + (err.stderr ? '\n--- stderr ---\n' + err.stderr : '');
    return { success: false, output: raw || err.message };
  }
}

const server = new McpServer({ name: 'php-container-test-mcp', version: '1.0.0' });

server.registerTool(
  'run_container_php_tests',
  {
    title: 'Run PHP Container Tests',
    description:
      'Run PHP unit or integration tests inside a Docker container using Composer. ' +
      'Use this tool whenever the user wants to: run tests, run unit tests, run integration tests, ' +
      'test the code, test an endpoint, check if the code is working, validate a feature, or verify a bug fix. ' +
      'Returns the full test output so you can evaluate whether tests passed or failed.',
    inputSchema: {
      container_name: z.string().describe('The Docker image name to run (e.g. "my-php-app:latest").'),
      command: z.string().optional().describe('Composer script name to execute (e.g. "test", "test:unit"). Defaults to "test".'),
      test_file: z.string().optional().describe('Optional path to a specific test file inside the container (e.g. "tests/Unit/UserTest.php").'),
      host_path: z.string().optional().describe('Absolute path to the project on the host machine to mount into the container. Defaults to the server argument or current working directory.'),
      container_path: z.string().optional().describe('Path inside the container where the project will be mounted. Defaults to the server argument or "/var/www".'),
    },
  },
  async ({ container_name = CONTAINER_NAME, command = DEFAULT_COMMAND ?? 'test', test_file, host_path, container_path }) => {
    const result = await runTests({
      containerName: container_name,
      command,
      testFile: test_file,
      hostPath: DEFAULT_HOST_PATH || host_path,
      containerPath: DEFAULT_CONTAINER_PATH || container_path,
    });
    return {
      content: [{ type: 'text', text: result.output || '(no output)' }],
      isError: !result.success,
    };
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write('[php-container-test-mcp] Server started and listening\n');
}

main().catch((err) => {
  process.stderr.write('Fatal: ' + err.message + '\n');
  process.exit(1);
});
