# 🧭 Visão Geral do Projeto

A **Medicore-Clínica (MediCore ERP)** é um sistema de gestão de clínica médica com controle de acesso por perfil (RBAC), módulo completo de estoque de medicamentos com auditoria imutável e fluxo de pedidos de re-estoque. O projeto foi construído para demonstrar o domínio de fundamentos de engenharia de software aplicados ao Angular moderno.

## ⚙️ Configuração do Ambiente

Todo o ambiente foi gerado automáticamente com o comando `ng new <nome-projeto>`, sem nenhuma alteração de versão dos pacotes instalados.

- **Framework:** Angular (v22.2+) com builder `@angular/build:application`
- **Typescript:** Versão 6.0.2
- **NodeJS:** Versão 26.13.1
- **Biblioteca de UI:** Optimus UI (`@openng/optimus-ui` v2) com tema Aura e suporte a Dark/Light mode via seletor `.app-dark`
- **Backend / Persistência:** Supabase (PostgreSQL, GoTrue Auth, PostgREST, RLS e RPCs transacionais)
- **Qualidade e Testes:** Vitest 5 (`@angular/build:unit-test`) com `TestBed` e `HttpTestingController`, além de `angular-eslint` v22 com regras de acessibilidade em templates

## 🏗️ Arquitetura e Organização

Foi adotada uma arquitetura baseada em features com o padrão **LIFT** (Locate, Identify, Flat, Try to be DRY), que é uma abordagem utilizada com frequência em projetos Angular e que facilita a escalabilidade e navegação entre as funcionalidades do sistema.

Segue abaixo uma exemplificação da estrutura do projeto e os seus diretórios:

```text
src/
├── database/
│   ├── init.sql                      # Schema idempotente, triggers, RPCs atômicas, RLS e seeds
│   └── queries.ts                    # Projeções PostgREST centralizadas (PEDIDOS_SELECT, MOVIMENTACOES_SELECT)
│
├── styles/                           # Tokens SCSS (_variables), mixins, reset, layout e utilitários
│
└── app/
    ├── core/                         # Singletons globais carregados uma vez no bootstrap
    │   ├── auth/                     # AuthService, authGuard e roleGuard
    │   ├── http/                     # BaseApiService e supabaseInterceptor
    │   ├── layout/                   # Shell responsivo (MainLayout, Sidebar, Topbar, BreadcrumbService, FeaturePlaceholder)
    │   ├── models/                   # Contratos globais (UserProfile, UserRole)
    │   └── theme/                    # ThemeService (persistência + View Transitions API)
    │
    ├── shared/                       # Componentes, diretivas e pipes reutilizáveis (sem regra de negócio)
    │   ├── components/               # PageHeader, StatusBadge
    │   ├── directives/               # HasRoleDirective (*appHasRole)
    │   └── pipes/                    # StatusLabelPipe e mapeamento de severidade
    │
    ├── features/                     # Domínios de negócio (Lazy Loading)
    │   ├── auth/
    │   │   └── pages/login/          # Tela de autenticação e acesso rápido por perfil de avaliação
    │   └── estoque/
    │       ├── components/           # Diálogos com Signal Forms (MedicamentoFormDialog, MovimentacaoDialog, PedidoFormDialog)
    │       ├── models/               # Entidades de domínio e pasta dtos/
    │       ├── pages/                # EstoqueListPage, MedicamentoDetailPage, PedidosEstoquePage, AuditoriaEstoquePage
    │       ├── services/             # MedicamentosService, PedidosEstoqueService, AuditoriaEstoqueService
    │       └── estoque.routes.ts
    │
    ├── app.config.ts                 # Providers globais (Router + InputBinding, HttpClient + Fetch, Optimus UI)
    ├── app.routes.ts                 # Rotas raiz com guards e lazy loading (loadComponent / loadChildren)
    └── app.ts                        # Root component (<router-outlet />)
```

## 🧩 Modelagem e Tipagem

O projeto utiliza configuração estrita no `tsconfig.json` (`strict`, `strictTemplates`, `noUncheckedIndexedAccess` e `exactOptionalPropertyTypes`), eliminando o uso de `any` e forçando _type narrowing_ explícito em respostas HTTP e propriedades opcionais.

- **Contratos de Domínio:** União literal para papéis (`UserRole = 'PACIENTE' | 'MEDICO' | 'GERENTE_ESTOQUE' | 'RECEPCIONISTA'`), tipos literais para estados (`EstoqueStatus`, `TipoMovimentacao`, `PedidoStaus`) e DTOs dedicados para criação, atualização e movimentação de estoque (`CreateMedicamentoDto`, `UpdateMedicamentoDto`, `CreatePedidoEstoqueDto`, `RegistrarMovimentacaoDto`).
- **Tipagem Derivada e Reúso:** Uso de utilitários do TypeScript como `Omit<BreadcrumbItem, 'isLast'>` e `Exclude<PedidoStatus, 'PENDENTE'>`, garantindo que transições inválidas de estado sejam bloqueadas já em tempo de compilação.
- **Extração Segura no `BaseApiService`:** Os métodos `postOne<T>` e `patchOne<T>` tratam o retorno em array do PostgREST (`Prefer: return=representation`), garantindo falha explícita quando nenhum registro é retornado em vez de recorrer a _non-null assertions_ (`!`).

## ✅ Validações e Gerenciamento de Erros

As validações seguem a estratégia de defesa em profundidade, replicando regras críticas nas três camadas (UI, serviços e banco de dados):

- **Integridade no Servidor (PostgreSQL):** Triggers impedem alteração indevida de `perfis.role`, alteração direta de saldo em `medicamentos` e recebimento de pedidos fora do fluxo transacional. As operações críticas (`registrar_movimentacao_estoque` e `receber_pedido_estoque`) executam como RPCs atômicas com bloqueio de linha (`FOR UPDATE`), validam `ativo = TRUE` para impedir operações em itens descontinuados e gravam trilha imutável (append-only) em `estoque_movimentacoes`. A policy `pedidos_estoque_insercao` também valida via `EXISTS` que o medicamento referenciado esteja ativo.
- **Segurança de Sessão, RBAC e HTTP:** O `AuthService` consulta a tabela `public.perfis` como fonte autoritativa de papel no login, valida o JSON restaurado do `sessionStorage` e agenda a expiração reativa da sessão por temporizador vinculado ao `DestroyRef`. O `supabaseInterceptor` valida a origem exata (`new URL().origin`) antes de anexar o JWT e trata respostas `401` de forma idempotente. O RBAC está alinhado entre menu lateral `Sidebar`, guardas de rota (`roleGuard`), diretiva estrutural (`*appHasRole`) e políticas RLS no PostgreSQL.
- **Validação em Tempo de Execução e Formulários:** Os serviços rejeitam entradas vazias, quantidades fracionárias (`Number.isInteger`) e saídas superiores ao saldo antes mesmo de disparar chamadas de rede. Os diálogos do módulo de estoque validam em tempo real com **Signal Forms** (`@angular/forms/signals`), exibindo prévia reativa do saldo e do status resultante (`NORMAL` | `REPOSICAO`).

## ⚙️ Outras Decisões Técnicas

- **Autenticação e Autorização:** Em ambientes corporativos de produção, o fluxo Resource Owner Password Credentials (`grant_type=password`) foi descontinuado pela especificação OAuth 2.1 em favor do Authorization Code Flow com PKCE + OIDC, mitigando a exposição direta de credenciais à aplicação cliente. Neste projeto, optei deliberadamente pela autenticação direta via Supabase Auth (`grant_type=password`) combinada com JWT em `sessionStorage`, expiração validada no cliente e políticas de Row Level Security (RLS) no PostgreSQL, garantindo reprodutibilidade imediata e validação determinística das quatro roles sem dependência de provedores OIDC externos.
- **Padrões Modernos do Angular v22+:** Adoção integral de componentes standalone, `OnPush` como padrão antivo, estado reativo com Signals (`signal`, `computed`, `input`, `output`, `model`, `viewChild`), injeção funcional (`inject()`), decorator `@Service()` para singletons, controle de fluxo nativo (`@if`, `@for`), `withComponentInputBinding()` para receber parâmetros de rota direto via `input()` (como na `MedicamentoDetailsPage`).
- **Design System, Dark Mode e Transições Suaves:** Interface padronizada com Optimus UI (tema Aura) integrada a tokens CSS semânticos (`--app-*`) e `color-scheme: light/dark`. A troca de tema utiliza a View Transitions API (`document.startViewTransition`) no `ThemeService` com animação de revelação radial acelerada por GPU originada no ponto de clique/foco do botão, fallback CSS controlado e desativação automática via `prefers-reduced-motion: reduce`.
- **Acessibilidade (WCAG AA):** Atributos `aria-invalid`, `aria-describedby`, `role="alert"`, `aria-live="polite"`, _skip link_ no layout principal, atributo `[inert]` no conteúdo de fundo ao abrir o drawer mobile, contraste revisado para Light/Dark mode e restauração de foco por teclado.
- **Qualidade e Testes:** Suíte automatizada em Vitest cobrindo serviços HTTP (`HttpTestingController`), fluxos de integração das 4 páginas de estoque (incluindo filtros, KPIs, transições PATCH/RPC e restrições de RBAC no DOM), tema, breadcrumbs, acessibilidade de formulários e shell responsivo.

## 🚧 Barreiras Encontradas e Soluções Adotadas

Ao longo do desenvolvimento com Angular v22+ e bibliotecas de UI recentes, surgiram barreiras técnicas concretas que exigiram diagnóstico e caminhos alternativos pragmáticos:

1. **Incompatibilidade da diretiva `pTextarea` (Optimus UI) com Signal Forms (`@angular/forms/signals`)**
   - **Barreira:** Ao subir os testes de integração das páginas que montam `MovimentacaoDialog` e `PedidoFormDialog`, o componente quebrava na inicialização com `TypeError: Cannot read properties of undefined (reading 'subscribe')` em `Textarea.onInit`. A diretiva `pTextarea` do `@openng/optimus-ui` ainda espera um controle clássico do `@angular/forms` com `valueChanges` (RxJS), inexistente na diretiva `[formField]` do Signal Forms.
   - **Solução / Caminho alternativo:** Remoção da diretiva `pTextarea` nos diálogos com Signal Forms, substituindo-a por `<textarea>` nativo estilizado via classe `.dialog-form__textarea` com os tokens `--app-*` (mesmo padrão adotado nos elementos `<select>`). Isso preservou a aparência, o suporte a foco/acessibilidade e 100% da reatividade dos Signal Forms sem precisar recuar para `ReactiveFormsModule`. Pelo mesmo diagnóstico, manteve-se `ReactiveFormsModule` na tela de Login para não quebrar a integração com o componente `<p-password>`.
2. **Contaminação em cascata do `TestBed` no Vitest em falhas de testes HTTP**
   - **Barreira:** Quando a falha acima interrompia um teste de página antes do `.flush()` no `HttpTestingController`, o `httpMock.verify()` no `afterEach` lançava exceção e impedia o teardown limpo do `TestBed`, fazendo testes saudáveis que rodavam na mesma worker (`topbar.spec.ts` e `auditoria-estoque.service.spec.ts`) falharem falsamente com `Cannot configure the test module when the test module has already been instantiated`.
   - **Solução:** Em vez de alterar testes que não tinham defeito, rastreou-se a pilha até a exceção primária no `Textarea.onInit.` Resolvida a causa raiz, todos os testes voltaram a passar de forma isolada e determinística.
3. **Desconexão de tokens de cor no Dark Mode e contraste insuficiente em mensagens de erro**
   - **Barreira:** As páginas iniciais do módulo de estoque não reagiam ao modo escuro porque `src/styles/_variables.scss` ainda referenciava variáveis `--p-*` com fallbacks claros fixos, enquanto o `styles.scss` alternava `--app-*` em `:root.app-dark.` Além disso, mensagens de erro em `estoque-dialog.scss` utilizavam `#ef4444` fixo (contraste ~3.76:1 sobre fundo branco, abaixo do mínimo WCAG AA de 4.5:1).
   - **Solução:** Unificação da fonte de verdade de cores em `_variables.scss` apontando para os tokens `--app-*`, criação de variáveis semânticas de tabela e status (`--app-table-*`, `--app-status-*`) com valores calibrados para Light e Dark mode e inclusão de `color-scheme` no `:root` para estilizar controles nativos do navegador.
4. **Troca abrupta de tema ("Flashbang" visual entre Light e Dark mode)**
   - **Barreira:** Alternar a classe `.app-dark` no `<html>` trocava toda a paleta em um único frame, causando desconforto visual. Aplicar `transition: all` globalmente via seletor `*` foi descartado por degradar performance, interferir em micro-interações de hover e não interpolar o `linear-gradient` da topbar.
   - **Solução:** Implementação da View Transitions API no `ThemeService`, capturando a coordenada do botão acionado (mouse ou centro do elemento via teclado) para animar um `clip-path: circle(...)` suave em GPU, mantendo um fallback CSS leve para ambientes sem suporte e execução síncrona no `jsdom` (preservando os testes unitários).
5. **Divergências sutis de RBAC, foco mobile e requisições redundantes**
   - **Barreira:** Uma revisão técnica completa apontou que `/pedidos-estoque` aparecia na sidebar para `MEDICO` mas tinha rota restrita a `GERENTE_ESTOQUE`; a restauração de foco do menu mobile em `Topbar` continha typos no seletor CSS (`.button` e `_menu-btn`); a barra de busca das 3 telas de estoque não importava a diretiva `InputText`; e a `MedicamentoDetailPage` disparava consulta de auditoria mesmo para perfis bloqueados por RLS, além de duplicar o reload da auditoria após movimentações.
   - **Solução:** Alinhamento do `roleGuard` em `app.routes.ts`, correção do seletor de foco no `Topbar`, adição de `InputText` aos imports das páginas, centralização das queries em `src/database/queries.ts` e refatoração da `MedicamentoDetailPage` com `input()` de rota + checagem de permissão (`canViewAuditoria` / `canViewPedidos`) antes de disparar requisições.

## 🤖️ Uso de IA

Ferramentas de IA foram utilizadas como apoio em arquitetura, refatoração e varredura estática de segurança, acessibilidade e conformidade com Angular v22+. Todas as sugestões passaram por triagem técnica crítica antes de serem incorporadas:

1. **Atomicidade no Estoque (Risco de Integridade):** A primeira implementação orquestrava atualização de saldo (`PATCH`) e inserção de auditoria (`POST`) em duas chamadas HTTP sequenciais no cliente. A revisão apontou risco de corrupção em falhas intermediárias ou concorrência, motivando a migração para RPCs transacionais no PostgreSQL com `FOR UPDATE` e triggers bloqueando bypass via REST.
2. **Escalada de Privilégio em RLS e `AuthService` (Risco de Segurança):** A versão inicial lia `role` de `user_metadata` no JWT — metadado editável pelo usuário no Supabase Auth. O risco foi mitigado alterando `current_app_role()` para consultar `public.perfis` com `SECURITY DEFINER`, bloqueando alteração da coluna `role` via trigger e removendo o fallback de papel no cliente.
3. **Validação de Expiração em `computed()` (Bug de Reatividade):** Utilizar `Date.now()` dentro de um `computed()` não reavalia o estado conforme o tempo passa. O problema foi corrigido substituindo a checagem por um temporizador controlado via `DestroyRef` que invalida a sessão no momento exato da expiração.
4. **Coesão de Serviços (Manutenibilidade):** A concentração de medicamentos, pedidos e auditoria em um único `EstoqueService` aumentava o acoplamento e dificultava os testes. O módulo foi refatorado em três serviços de responsabilidade única, alinhando-se ao padrão LIFT.
5. **Acessibilidade Mobile e Consistência Visual (UX/WCAG AA):** Uma primeira versão do shell utilizava botões nativos fora do padrão Optimus UI e apenas deslocava o drawer mobile fora da tela (mantendo links focáveis via teclado). Os componentes foram padronizados com `Button`, `Tag`, `Avatar` e `Card` do Optimus UI, adicionando `visibility: hidden`, `[inert]` no conteúdo de fundo e restauração de foco.
6. **Auditoria Estática e Triagem Pragmática (Anti-Over-Engineering):** Após a conclusão do módulo de estoque, uma varredura automatizada levantou tanto bugs reais quanto sugestões de refatoração. Os defeitos objetivos (RBAC da rota de pedidos, proteção de `ativo = TRUE` no PostgreSQL, seletor de foco do topbar, contraste WCAG AA e requests duplicadas) foram corrigidos imediatamente; por outro lado, sugestões com alto risco de regressão e baixo retorno — como forçar Signal Forms no `<p-password>` da tela de login ou sobrescrever o cache global de medicamentos com buscas pontuais por ID — foram conscientemente descartadas para preservar estabilidade e simplicidade arquitetural.
