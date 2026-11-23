# 🧭 Visão Geral do Projeto
* * *

A **Medicore-Clínica** é um sistema de gestão de clínica médica. O projeto foi construído para demonstrar o domínio de fundamentos de engenharia de software aplicados ao framework Angular.

## ⚙️ Configuração do Ambiente
* * *

Todo o ambiente foi gerado automáticamente com o comando `ng new <nome-projeto>`, sem nenhuma alteração de versão dos pacotes instalados.

- **Framework:** Angular (v22)
- **Typescript:** Versão 6.0.2
- **NodeJS:** Versão 26.13.1
- **Biblioteca de UI:** Optimus UI (`@openng/optimus-ui`) com tema Aura e suporte a Dark/Light mode via seletor `.app-dark`
- **Backend / Persistência:** Supabase (PostgreSQL, GoTrue Auth, PostgREST, RLS e RPCs transacionais)
- **Testes:** Vitest com `TestBed` e `HttpTestingController`

## 🏗️ Arquitetura e Organização
* * *

Foi adotada uma arquitetura baseada em features com o padrão **LIFT** (Locate, Identify, Flat, Try to be DRY), que é uma abordagem utilizada com frequência em projetos Angular e que facilita a escalabilidade e navegação entre as funcionalidades do sistema.

Segue abaixo uma exemplificação da estrutura do projeto e os seus diretórios:

```text
src/app/
├── core/                         # Singleton global: carregado 1x no arranque da app
│   ├── auth/                     # AuthService, RoleGuard, AuthInterceptor
│   ├── http/                     # ErrorInterceptor, LoadingInterceptor, BaseApiService
│   ├── layout/                   # Shell principal (Sidebar, Topbar, MainLayoutComponent)
│   └── models/                   # Interfaces globais (User, ApiResponse, PaginatedResult)
│
├── shared/                       # Reutilizável em qualquer feature (sem regra de negócio)
│   ├── components/               # Dumb components (StatusBadge, ConfirmDialog, PageHeader)
│   ├── directives/               # Diretivas customizadas (HasRoleDirective, HighlightDirective)
│   ├── pipes/                    # Pipes customizados (CurrencyBrlPipe, StatusLabelPipe)
│   └── validators/               # Validadores reutilizáveis de Reactive Forms
│
├── features/                     # Domínios de negócio (cada pasta vira um Lazy Route)
│   ├── dashboard/
│   │   ├── components/           # Componentes exclusivos do dashboard (KpiCard, SalesChart)
│   │   ├── pages/                # Smart component da rota (DashboardPageComponent)
│   │   ├── services/             # DashboardFacade / DashboardService
│   │   └── dashboard.routes.ts
│   │
│   ├── orders/                   # Gestão (Clientes, Pedidos, Produtos)
│   │   ├── components/           # OrderFormComponent, OrderItemsTableComponent
│   │   ├── models/               # Order, OrderItem, Customer, Product
│   │   ├── pages/                # OrdersListPage, OrderDetailPage, OrderCreatePage
│   │   ├── services/             # OrdersService, ProductsService
│   │   └── orders.routes.ts
│   │
│   └── tickets/                  # Atendimento / Workflow
│       ├── components/           # TicketCard, TicketStatusStepper
│       ├── models/               # Ticket, TicketStatus, WorkflowTransition
│       ├── pages/                # TicketsBoardPage, TicketDetailPage
│       ├── services/             # TicketsService
│       └── tickets.routes.ts
│
├── app.config.ts                 # Providers globais (Router, HttpClient + Interceptors, Optimus UI)
├── app.routes.ts                 # Rotas raiz apontando via loadChildren para features/*
└── app.ts                        # Root component (<router-outlet />)
```

## 🧩 Modelagem e Tipagem
* * *

O projeto utiliza configuração estrita no `tsconfig.json` (`strict`, `strictTemplates`, `noUncheckedIndexedAccess` e `exactOptionalPropertyTypes`), eliminando o uso de `any` e forçando *type narrowing* explícito em respostas HTTP e propriedades opcionais.

- **Contratos de Domínio:** União literal para papéis (`UserRole = 'PACIENTE' | 'MEDICO' | 'GERENTE_ESTOQUE' | 'RECEPCIONISTA'`) e DTOs separados para criação, atualização e movimentação de estoque (`Medicamento`, `PedidoEstoque`, `EstoqueMovimentacao`).
- **Extração Segura no `BaseApiService`:** Os métodos `postOne<T>` e `patchOne<T>` tratam o retorno em array do PostgREST (`Prefer: return=representation`), garantindo falha explícita quando nenhum registro é retornado em vez de recorrer a *non-null assertions* (`!`).


## ✅ Validações e Gerenciamento de Erros
* * *

As validações seguem a estratégia de defesa em profundidade (camada de interface, serviços e banco de dados):

- **Integridade no Servidor (PostgreSQL):** Triggers impedem alteração indevida de `perfis.role`, alteração direta de saldo em `medicamentos` e recebimento de pedidos fora do fluxo transacional. As operações críticas (`registrar_movimentacao_estoque` e `receber_pedido_estoque`) executam como RPCs atômicas com bloqueio de linha (`FOR UPDATE`), evitando condições de corrida e garantindo registro imutável em `estoque_movimentacoes`.
- **Segurança de Sessão e HTTP:** O `AuthService` consulta a tabela `public.perfis` como fonte autoritativa de papel no login, valida integralmente o JSON restaurado do `sessionStorage` e agenda a expiração reativa da sessão por temporizador vinculado ao `DestroyRef`. O `supabaseInterceptor` valida a origem exata (`new URL().origin`) antes de anexar o JWT e trata respostas `401` de forma idempotente.
- **Validação em Tempo de Execução:** Os serviços de estoque rejeitam entradas vazias, quantidades fracionárias (`Number.isInteger`) e saídas superiores ao saldo antes mesmo de disparar chamadas de rede.

## ⚙️ Outras Decisões Técnicas
* * *

- **Autenticação e Autorização:** Em ambientes corporativos de produção, o fluxo Resource Owner Password Credentials (`grant_type=password`) foi descontinuado pela especificação OAuth 2.1 em favor do Authorization Code Flow com PKCE + OIDC, mitigando a exposição direta de credenciais à aplicação cliente. Neste projeto, optei deliberadamente pela autenticação direta via Supabase Auth (`grant_type=password`) combinada com JWT em `sessionStorage`, expiração validada no cliente e políticas de Row Level Security (RLS) no PostgreSQL, garantindo reprodutibilidade imediata e validação determinística das quatro roles sem dependência de provedores OIDC externos.
- **Padrões Modernos do Angular v22+:** Adoção integral de componentes standalone, detecção de mudanças `OnPush` como padrão, gerenciamento de estado reativo com Signals (`signal`, `computed`, `input`, `output`, `viewChild`), injeção via `inject()`, decorator `@Service()` para singletons, novo fluxo de controle (`@if`, `@for`) e *lazy loading* de rotas.
- **Acessibilidade (WCAG AA) e Design System:** Interface padronizada com Optimus UI (tema Aura) e tokens CSS semânticos (`--app-*`) para troca síncrona entre Light/Dark mode. Implementação de atributos `aria-invalid`, `aria-describedby` (via `[pt]` no `<p-password>`), `role="alert"`, *skip link* no layout principal, atributo `[inert]` no conteúdo de fundo ao abrir o drawer mobile e gerenciamento/restauração de foco por teclado.
- **Qualidade e Testes:** Suíte automatizada em Vitest cobrindo serviços HTTP (`HttpTestingController`), guards, tema, breadcrumbs, acessibilidade de formulários e interações do shell responsivo.

## 🤖️ Uso de IA
* * *

Ferramentas de IA foram utilizadas como apoio em arquitetura, refatoração e varredura estática de segurança/acessibilidade. Todas as sugestões passaram por análise crítica antes de serem incorporadas:

1. **Atomicidade no Estoque (Risco de Integridade):** A primeira implementação orquestrava atualização de saldo (`PATCH`) e inserção de auditoria (`POST`) em duas chamadas HTTP sequenciais no cliente. A revisão crítica apontou que falhas intermediárias ou acessos concorrentes poderiam corromper o inventário. A lógica foi migrada para RPCs transacionais no PostgreSQL com `FOR UPDATE` e triggers bloqueando bypass via REST.
2. **Escalada de Privilégio em RLS e `AuthService` (Risco de Segurança):** A versão inicial lia `role` de `user_metadata` no JWT — metadado editável pelo usuário no Supabase Auth. O risco foi mitigado alterando `current_app_role()` para consultar `public.perfis` com `SECURITY DEFINER`, bloqueando alteração da coluna `role` via trigger e removendo o fallback de papel no cliente.
3. **Validação de Expiração em `computed()` (Bug de Reatividade):** Utilizar `Date.now()` dentro de um `computed()` não reavalia o estado conforme o tempo passa. O problema foi corrigido substituindo a checagem por um temporizador controlado via `DestroyRef` que invalida a sessão no momento exato da expiração.
4. **Coesão de Serviços (Manutenibilidade):** A concentração de medicamentos, pedidos e auditoria em um único `EstoqueService` aumentava o acoplamento e dificultava os testes. O módulo foi refatorado em três serviços de responsabilidade única, alinhando-se ao padrão LIFT.
5. **Acessibilidade Mobile e Consistência Visual (UX/WCAG AA):** Uma primeira versão do shell utilizava botões nativos fora do padrão Optimus UI e apenas deslocava o drawer mobile fora da tela (mantendo links focáveis via teclado). Os componentes foram padronizados com `Button`, `Tag`, `Avatar` e `Card` do Optimus UI, adicionando `visibility: hidden`, `[inert]` no conteúdo de fundo e restauração de foco.
