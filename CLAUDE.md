# php-container-test-mcp

## Executando testes PHP

**SEMPRE** use a ferramenta MCP `run_container_php_tests` para rodar testes PHP.
Nunca execute `php`, `composer test`, `phpunit`, `pest` ou qualquer comando de teste diretamente no terminal.

Isso vale para qualquer situação como:
- "rode os testes" / "run the tests"
- "teste esse arquivo" / "test this file"
- "verifique se os testes passam" / "check if tests pass"
- "valide o fix" / "verify the fix"
- "certifique que nada quebrou" / "make sure nothing broke"
- "execute os testes unitários/de integração"
