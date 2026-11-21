# 🧭 Visão Geral do Projeto
* * *

A **Medicore-Clínica** é um sistema de gestão de clínica médica. O projeto foi construído para demonstrar o domínio de fundamentos de engenharia de software aplicados ao framework Angular.

## ⚙️ Configuração do Ambiente
* * *

Todo o ambiente foi gerado automáticamente com o comando `ng new <nome-projeto>`, sem nenhuma alteração de versão dos pacotes instalados.

- **Framework:** Angular (v22)
- **Typescript:** Versão 6.0.2
- **NodeJS:** Versão 26.13.1

## 🏗️ Arquitetura e Organização
* * *

Foi adotada uma arquitetura baseada em features com o padrão **LIFT** (Locate, Identify, Flat, Try to be DRY), que é uma abordagem utilizada com frequência em projetos Angular e que facilita a escalabilidade e navegação entre as funcionalidades do sistema.

Segue abaixo uma exemplificação da estrutura do projeto e os seus diretórios:



## 🧩 Modelagem e Tipagem
* * *


## ✅ Validações e Gerenciamento de Erros
* * *

## ⚙️ Outras Decisões Técnicas
* * *

- **Autenticação e Autorização:** Em ambientes corporativos de produção, o fluxo Resource Owner Password Credentials (`grant_type=password`) foi descontinuado pela especificação OAuth 2.1 em favor do Authorization Code Flow com PKCE + OIDC, mitigando a exposição direta de credenciais à aplicação cliente. Neste projeto, optei deliberadamente pela autenticação direta via Supabase Auth (`grant_type=password`) combinada com JWT em `sessionStorage`, expiração validada no cliente e políticas de Row Level Security (RLS) no PostgreSQL, garantindo reprodutibilidade imediata e validação determinística das quatro roles sem dependência de provedores OIDC externos.

## 🤖️ Uso de IA
* * *

