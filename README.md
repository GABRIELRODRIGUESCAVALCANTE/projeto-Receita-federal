# RTC Studio

Plataforma web e API unificada para simulação, validação e auditoria da Reforma Tributária (LC 214/2025), construída sobre os três motores oficiais open-source da Receita Federal do Brasil.

## Motores oficiais integrados

Os cálculos tributários, validações de XSD e geração de PDF não são reimplementados no projeto: todas as operações são delegadas aos repositórios oficiais da Receita Federal (licença MIT), executados localmente via Docker Compose.

| Serviço | Repositório oficial | Stack | Porta API | Health |
|---|---|---|---|---|
| Regime Regular | `ReceitaFederal/calculadora-rtc-regime-regular` | Java 25, Spring Boot 4, SQLite/Flyway | `:8080` | `:9101/health` |
| Simples Nacional | `ReceitaFederal/calculadora-rtc-simples-nacional` | Java 25, Spring Boot 4, SQLite | `:8082` | `:9103/health` |
| Gerador DANFSe | `ReceitaFederal/calculadora-rtc-gerador-danfse` | Go 1.27, Echo | `:8083` | `:8083/health/ready` |

Um container auxiliar (`rtc-db-init`) executa as migrations Flyway do repositório do Regime Regular e gera o volume compartilhado `rtc_sqlite_db` montado em modo somente leitura pelos motores Java.

## Arquitetura

```text
apps/web (React 19 + Vite + Tailwind 4)  :5173
                │  proxy /api
                ▼
apps/api (Fastify 5 + SQLite local)      :3001
      │                │                │
      ▼                ▼                ▼
Regime Regular   Simples Nacional  Gerador DANFSe
    :8080             :8082            :8083
      └────────┬────────┘
               ▼
      rtc_sqlite_db (Flyway)
```

## Módulos da aplicação

1. **Estúdio Interativo**
   - Simulação comparativa em paralelo entre Regime Regular (CBS, IBS, IS) e Simples Nacional (PGDAS).
   - Cenários prontos (Serviço de Educação com redução de 60%, Consultoria de TI e Mercadoria NCM) e histórico persistido em SQLite.
   - Busca em tempo real de códigos NCM e NBS nos Dados Abertos da Receita.
   - Geração e validação do grupo XML contra o schema XSD oficial, preview/download de DANFSe em PDF e exportação de snippets (`cURL`, `TypeScript`, `Python`).
2. **Raio-X em Lote**
   - Upload com drag-and-drop de múltiplos arquivos `.xml` (NFS-e / NF-e) ou planilha `.csv`, além de lote de demonstração.
   - Comparativo consolidado entre regimes, gráfico por UF e taxa de conformidade do lote, isolando itens com erro sem interromper o processamento.
3. **Auditor Fiscal**
   - Conciliação centavo a centavo entre tributos declarados no ERP e o retorno do motor oficial.
   - Filtros por status (`Todas`, `Conformes`, `Divergentes`, `Erros REG/VSN`), diagnóstico de códigos `REG-*` e `VSN-*` e abertura direta de qualquer nota no Estúdio.
4. **Copiloto Tributário**
   - Chat em linguagem natural com *tool calling* determinístico: todos os números vêm das APIs da Receita, com auditoria das chamadas executadas, fundamentação legal e envio direto do cenário para o Estúdio ou DANFSe.
   - Suporte opcional a anexos `.xml` e provedores `ollama`, `gemini` ou `openai`.

A interface conta com alternância de tema claro e escuro (persistida em `localStorage`) e monitoramento contínuo da latência e disponibilidade dos três motores.

## Estrutura do repositório

```text
.
├── apps/
│   ├── api/            # BFF Fastify, clientes HTTP dos motores, SQLite local e testes
│   └── web/            # Interface React + TypeScript + Vite + Tailwind CSS v4
├── packages/
│   └── shared/         # Contratos e tipos TypeScript compartilhados entre API e Web
├── docker/             # Dockerfiles para build dos serviços Java e init do Flyway
├── scripts/
│   ├── setup-services.sh   # Clona os 3 repositórios oficiais em ./services
│   └── smoke-test.sh       # Valida saúde e endpoints principais dos motores
├── samples/            # Arquivos de exemplo (.csv e .xml) para testes em lote
├── docker-compose.yml
└── .env.example
```

## Pré-requisitos

- Node.js 22+ e npm
- Docker e Docker Compose
- Git

## Como executar localmente

### 1. Clonar os motores oficiais da Receita Federal

Os repositórios upstream ficam em `services/` (ignorado pelo Git):

```bash
./scripts/setup-services.sh
```

### 2. Configurar variáveis de ambiente

```bash
cp .env.example .env
```

Os valores padrão já apontam para as portas locais do `docker-compose.yml`. Se quiser usar o Copiloto com LLM externo ou local, ajuste `AI_PROVIDER` e a respectiva chave ou URL no `.env`.

### 3. Subir os três motores via Docker Compose

```bash
npm run engines:up
```

> Se receber `permission denied` em `/var/run/docker.sock` no Linux, adicione seu usuário ao grupo `docker`:
> `sudo usermod -aG docker $USER && newgrp docker`

Verifique se os containers ficaram saudáveis e rode o smoke test:

```bash
docker compose ps
npm run engines:smoke
```

### 4. Instalar dependências e iniciar API + Web

```bash
npm install
npm run dev
```

Endereços locais:

- **RTC Studio (Web):** http://localhost:5173
- **API Unificada (BFF):** http://localhost:3001
- **Swagger — Regime Regular:** http://localhost:8080/api/swagger-ui.html
- **Swagger — Simples Nacional:** http://localhost:8082/api/swagger-ui.html

Para testar o upload em lote rapidamente, use os arquivos em `samples/lote-exemplo.csv` e `samples/nfse-exemplo-sp.xml`.

## Scripts disponíveis

| Comando | Descrição |
|---|---|
| `npm run dev` | Inicia API (`:3001`) e Web (`:5173`) em paralelo |
| `npm run build` | Compila `shared`, `api` e gera o bundle de produção do `web` |
| `npm run typecheck` | Executa `tsc --noEmit` nos três workspaces |
| `npm run test` | Executa a suíte de testes de integração da API (com motores mockados, sem exigir Docker) |
| `npm run engines:up` | Sobe e constrói os motores oficiais no Docker Compose |
| `npm run engines:down` | Encerra os containers dos motores |
| `npm run engines:smoke` | Executa `scripts/smoke-test.sh` contra os motores em execução |

## Variáveis de ambiente

| Variável | Padrão | Uso |
|---|---|---|
| `API_PORT` / `WEB_PORT` | `3001` / `5173` | Portas do backend Fastify e do servidor Vite |
| `APP_DB_PATH` | `./data/app.db` | Banco SQLite local para histórico de simulações e lotes |
| `RTC_REGIME_REGULAR_URL` | `http://localhost:8080/api` | Endpoint do motor de Regime Regular |
| `RTC_SIMPLES_NACIONAL_URL` | `http://localhost:8082/api` | Endpoint do motor do Simples Nacional |
| `RTC_GERADOR_DANFSE_URL` | `http://localhost:8083` | Endpoint do gerador de PDF DANFSe |
| `AI_PROVIDER` | `ollama` | Provedor do Copiloto (`ollama`, `gemini` ou `openai`) |
| `GEMINI_API_KEY` / `GEMINI_MODEL` | `gemini-2.5-flash` | Credencial e modelo quando `AI_PROVIDER=gemini` |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | `gpt-4o-mini` | Credencial e modelo quando `AI_PROVIDER=openai` |
| `OLLAMA_BASE_URL` / `OLLAMA_MODEL` | `http://localhost:11434` / `llama3.1` | Host e modelo quando `AI_PROVIDER=ollama` |

## Principais rotas da API (`apps/api`)

| Método e rota | Função |
|---|---|
| `GET /api/health` | Status, versão e latência dos 3 motores da Receita |
| `GET /api/catalog/{ufs,municipios,ncm,nbs,classificacoes,atividades-simples,erro}` | Consulta aos Dados Abertos e códigos `REG-*`/`VSN-*` |
| `POST /api/studio/simulate` | Simulação comparativa Regular vs. Simples com gravação no histórico |
| `GET /api/studio/history` e `GET /api/studio/history/:id` | Listagem e recuperação de simulações salvas |
| `POST /api/studio/xml/generate` e `POST /api/studio/xml/validate` | Geração e validação XSD do grupo XML oficial |
| `POST /api/studio/nfse-sample-xml` e `POST /api/studio/danfse` | Montagem de XML exemplo e renderização do DANFSe em PDF |
| `POST /api/batches/analyze` | Raio-X e auditoria em lote (JSON, múltiplos XMLs ou CSV) |
| `GET /api/batches/history` e `GET /api/batches/history/:id` | Histórico de análises em lote |
| `POST /api/copilot/chat` | Consulta determinística em linguagem natural com rastreabilidade |

## Licença

Código aberto sob licença MIT. Os motores tributários integrados seguem os termos dos respectivos repositórios oficiais da Receita Federal.
