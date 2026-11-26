# Ambiente Node.js (NVM)

- Este projeto exige obrigatoriamente o **Node.js v26.13.1** gerenciado via NVM.
- Como subshells não-interativos não carregam o NVM automaticamente, **sempre** inicialize o NVM e ative a versão antes de executar qualquer comando `node`, `npm`, `npx` ou `ng`:

```bash
export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" && nvm use 26.13.1 && <comando>
```

- Nunca execute `ng` ou `npm` sem garantir que a saída de `node -v` na mesma sessão seja `v26.13.1`.
