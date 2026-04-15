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
  'run_php_tests',
  {
    title: 'Run All PHP Tests',
    description:
      'ALWAYS use this tool to run the full PHP test suite inside a Docker container — ' +
      'never run composer or phpunit directly on the host. ' +
      'Use when the user says: run tests, run all tests, run unit tests, run integration tests, ' +
      'execute tests, check if tests pass, make sure nothing broke, validate the feature, verify the fix, ' +
      'rodar testes, rodar todos os testes, executar testes, verificar se os testes passam. ' +
      'Returns the full test output (stdout + stderr) so you can evaluate pass/fail.',
    inputSchema: {
      container_name: z.string().describe('Docker image name (e.g. "my-php-app:latest").'),
      command: z.string().optional().describe('Composer script to run (e.g. "test", "test:unit"). Defaults to "test".'),
      host_path: z.string().optional().describe('Absolute path to the project on the host. Defaults to the server argument or current working directory.'),
      container_path: z.string().optional().describe('Mount path inside the container. Defaults to the server argument or "/var/www".'),
    },
  },
  async ({ container_name = CONTAINER_NAME, command = DEFAULT_COMMAND ?? 'test', host_path, container_path }) => {
    const result = await runTests({
      containerName: container_name,
      command,
      hostPath: DEFAULT_HOST_PATH || host_path,
      containerPath: DEFAULT_CONTAINER_PATH || container_path,
    });
    return {
      content: [{ type: 'text', text: result.output || '(no output)' }],
      isError: !result.success,
    };
  },
);

server.registerTool(
  'run_php_test_file',
  {
    title: 'Run a Specific PHP Test File',
    description:
      'ALWAYS use this tool to run a single PHP test file inside a Docker container — ' +
      'never run phpunit directly on the host. ' +
      'Use when the user says: run this test, test this file, run UserTest, run tests for this class, ' +
      'rodar esse teste, testar esse arquivo, rodar o teste do UserController. ' +
      'Returns the full test output (stdout + stderr) so you can evaluate pass/fail.',
    inputSchema: {
      container_name: z.string().describe('Docker image name (e.g. "my-php-app:latest").'),
      test_file: z.string().describe('Path to the test file inside the container (e.g. "tests/Unit/UserTest.php").'),
      command: z.string().optional().describe('Composer script to run (e.g. "test", "test:unit"). Defaults to "test".'),
      host_path: z.string().optional().describe('Absolute path to the project on the host. Defaults to the server argument or current working directory.'),
      container_path: z.string().optional().describe('Mount path inside the container. Defaults to the server argument or "/var/www".'),
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
