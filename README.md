# RTC Studio — Plataforma Unificada da Reforma Tributária (LC 214/2025)

Plataforma construída sobre os três repositórios oficiais open-source (licença MIT) da Receita Federal do Brasil:

- **Regime Regular (`:8080`)** — `ReceitaFederal/calculadora-rtc-regime-regular` (Java 25 + Spring Boot 4 + SQLite/Flyway)
- **Simples Nacional (`:8082`)** — `ReceitaFederal/calculadora-rtc-simples-nacional` (Java 25 + Spring Boot 4 + SQLite)
- **Gerador DANFSe (`:8083`)** — `ReceitaFederal/calculadora-rtc-gerador-danfse` (Go 1.27 + Echo)

## Módulos

1. **Estúdio Interativo:** simulação comparativa Regime Regular vs. Simples Nacional, autocomplete nos Dados Abertos da Receita, geração/validação de XML e preview ao vivo do DANFSe em PDF.
2. **Raio-X em Lote:** upload de múltiplos XMLs/CSV com processamento paralelo via observabilidade e dashboard comparativo.
3. **Auditor Fiscal:** comparação ERP vs. motor oficial da Receita com diff detalhado e resolução de códigos `REG-*` / `VSN-*`.
4. **Copiloto Tributário:** chat em linguagem natural com *tool calling* determinístico (zero alucinação de cálculo) e fundamentação legal oficial.

## Início Rápido

### 1. Clonar os repositórios oficiais (se ainda não clonados)
```bash
./scripts/setup-services.sh
```

### 2. Configurar variáveis de ambiente
```bash
cp .env.example .env
```

### 3. Subir os 3 motores oficiais via Docker Compose
> Caso receba `permission denied` no `/var/run/docker.sock`, adicione seu usuário ao grupo `docker`:
> `sudo usermod -aG docker $USER && newgrp docker`

```bash
docker compose up -d --build
```

Acompanhe o status e execute o smoke test:
```bash
docker compose ps
./scripts/smoke-test.sh
```

### 4. Subir Backend + Frontend (RTC Studio)
```bash
npm install
npm run dev
```
- **Web (RTC Studio):** http://localhost:5173
- **API Unificada (BFF):** http://localhost:3001
- **Swagger Regime Regular:** http://localhost:8080/api/swagger-ui.html
- **Swagger Simples Nacional:** http://localhost:8082/api/swagger-ui.html

