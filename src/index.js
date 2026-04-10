#!/usr/bin/env node
'use strict';

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = require('zod');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);

const MAX_BUFFER = 10 * 1024 * 1024; // 10 MB

/**
 * Build and execute the docker run command, returning combined output.
 */
async function runTests(containerName, command, testFile) {
  const args = ['run', '--rm', containerName, 'composer', command];

  if (testFile) {
    args.push('--', testFile);
  }

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
      'Returns the full test output so you can evaluate whether tests passed or failed.',
    inputSchema: {
      container_name: z.string().describe('The Docker image name to run (e.g. "my-php-app:latest").'),
      command: z.string().optional().describe('Composer script name to execute (e.g. "test", "test:unit"). Defaults to "test".'),
      test_file: z.string().optional().describe('Optional path to a specific test file inside the container (e.g. "tests/Unit/UserTest.php").'),
    },
  },
  async ({ container_name, command = 'test', test_file }) => {
    const result = await runTests(container_name, command, test_file);
    return {
      content: [{ type: 'text', text: result.output || '(no output)' }],
      isError: !result.success,
    };
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  process.stderr.write('Fatal: ' + err.message + '\n');
  process.exit(1);
});
