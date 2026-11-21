import assert from 'node:assert/strict';
import http from 'node:http';
import { after, before, describe, it } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './server.js';

describe('RTC Studio API — Integração com os 3 motores oficiais (mockados)', () => {
  let mockServer: http.Server;
  let mockBaseUrl: string;
  let app: FastifyInstance;

  before(async () => {
    mockServer = http.createServer(async (req, res) => {
      const url = new URL(req.url || '/', 'http://localhost');
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk as Buffer);
      const rawBody = Buffer.concat(chunks).toString('utf8');

      // Healthchecks
      if (url.pathname === '/health' || url.pathname === '/health/ready') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'UP' }));
        return;
      }

      // Versão
      if (url.pathname.endsWith('/versao')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ versaoApp: '1.0.2' }));
        return;
      }

      // Regime Regular — Observabilidade
      if (url.pathname === '/api/calculadora/observabilidade/regime-geral' && req.method === 'POST') {
        const body = JSON.parse(rawBody);
        const item = body.itens[0];
        if (item.ncm === '02013000') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              objetos: [
                {
                  nObj: 1,
                  estadoItem: 'INCONSISTENCIA_ENTRADA',
                  erros: [{ code: 'REG-011', title: 'NCM não vinculada', detail: 'NCM incompatível com cClassTrib' }],
                },
              ],
              total: { tribCalc: { IBSCBSTot: { vBCIBSCBS: '0.00', gIBS: { vIBS: '0.00' }, gCBS: { vCBS: '0.00' } } } },
            })
          );
          return;
        }

        const bc = Number(item.baseCalculo || 0);
        const vCBS = Number((bc * 0.088).toFixed(2));
        const vIBS = Number((bc * 0.001).toFixed(2));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            objetos: [{ nObj: 1, estadoItem: 'CALCULO_SIMULADO', tribCalc: { IBSCBS: { vBC: bc.toFixed(2) } } }],
            total: {
              tribCalc: {
                ISTot: { vIS: '0.00' },
                IBSCBSTot: {
                  vBCIBSCBS: bc.toFixed(2),
                  gIBS: { vIBS: vIBS.toFixed(2) },
                  gCBS: { vCBS: vCBS.toFixed(2) },
                },
              },
            },
          })
        );
        return;
      }

      // Regime Regular — Erro catálogo
      if (url.pathname === '/api/calculadora/observabilidade/erros') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ codigo: url.searchParams.get('codigo'), titulo: 'NCM não vinculada', descricao: 'Verifique a tabela de vinculação NCM x cClassTrib.' }));
        return;
      }

      // Regime Regular — Fundamentações
      if (url.pathname === '/api/calculadora/dados-abertos/fundamentacoes-legais') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify([{ codigoClassificacaoTributaria: '000001', texto: 'Art. 1º da LC 214/2025 — Tributação integral.' }]));
        return;
      }

      // Simples Nacional — Observabilidade
      if (url.pathname === '/api/calculadora/observabilidade/simples-nacional' && req.method === 'POST') {
        const body = JSON.parse(rawBody);
        const item = body.itens[0];
        const bc = Number(item.baseCalculo || 0);
        const vCBSSN = Number((bc * (Number(item.pCBSSN || 2.5) / 100)).toFixed(2));
        const vIBSSN = Number((bc * (Number(item.pIBSSN || 0.05) / 100)).toFixed(2));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            objetos: [{ nObj: 1, estadoItem: 'CALCULADO', vCBSSN: vCBSSN.toFixed(2), vIBSSN: vIBSSN.toFixed(2) }],
            total: { vRBSN: bc.toFixed(2), vCBSSN: vCBSSN.toFixed(2), vIBSSN: vIBSSN.toFixed(2) },
          })
        );
        return;
      }

      // Gerador DANFSe — PDF
      if (url.pathname === '/api/danfse' && req.method === 'POST') {
        if (!rawBody.includes('<NFSe')) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'XML inválido' }));
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/pdf' });
        res.end(Buffer.from('%PDF-1.4\n%MockDANFSe\n%%EOF'));
        return;
      }

      res.writeHead(404);
      res.end('Not Found');
    });

    await new Promise<void>((resolve) => mockServer.listen(0, '127.0.0.1', () => resolve()));
    const addr = mockServer.address();
    assert(addr && typeof addr !== 'string');
    mockBaseUrl = `http://127.0.0.1:${addr.port}`;

    app = buildApp({
      dbPath: ':memory:',
      logger: false,
      enginesConfig: {
        regimeRegularUrl: `${mockBaseUrl}/api`,
        regimeRegularHealthUrl: `${mockBaseUrl}/health`,
        simplesNacionalUrl: `${mockBaseUrl}/api`,
        simplesNacionalHealthUrl: `${mockBaseUrl}/health`,
        geradorDanfseUrl: mockBaseUrl,
      },
    });
    await app.ready();
  });

  after(async () => {
    await app.close();
    await new Promise<void>((resolve) => mockServer.close(() => resolve()));
  });

  it('retorna status online dos 3 motores em GET /api/health', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.status, 'ok');
    assert.equal(body.engines.regimeRegular.status, 'online');
    assert.equal(body.engines.simplesNacional.status, 'online');
    assert.equal(body.engines.geradorDanfse.status, 'online');
  });

  it('simula Regime Regular e Simples em paralelo e grava histórico (Fase 1)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/studio/simulate',
      payload: {
        titulo: 'Consultoria TI Teste',
        mode: 'both',
        dataFatoGerador: '2027-03-15',
        uf: 'SP',
        municipio: 3550308,
        tpDoc: '55',
        CRT: '1',
        itens: [
          {
            numero: 1,
            tipoItem: 'servico',
            nbs: '115021000',
            cst: '000',
            cClassTrib: '000001',
            baseCalculo: 10000,
            aliquotaCbs: 8.8,
            aliquotaIbsUf: 0.05,
            aliquotaIbsMun: 0.05,
            cAtivSN: '01',
            pCBSSN: '2.50',
            pIBSSN: '0.05',
          },
        ],
      },
    });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.summary.regular.vCBS, 880);
    assert.equal(body.summary.regular.vIBS, 10);
    assert.equal(body.summary.simples.vCBS, 250);
    assert.equal(body.summary.simples.vIBS, 5);
    assert.equal(body.summary.regimeMaisEconomico, 'simples');

    const hist = await app.inject({ method: 'GET', url: '/api/studio/history' });
    assert.equal(hist.statusCode, 200);
    assert.equal(hist.json().length, 1);
  });

  it('gera PDF do DANFSe em POST /api/studio/danfse (Fase 1)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/studio/danfse',
      payload: { xml: '<NFSe versao="1.00"><infNFSe/></NFSe>', stc: '0', canhoto: true },
    });
    assert.equal(res.statusCode, 200);
    assert.equal(res.headers['content-type'], 'application/pdf');
    assert.ok(res.rawPayload.subarray(0, 5).toString('utf8') === '%PDF-');
  });

  it('executa Raio-X e Auditoria em lote com detecção de divergência e erro REG-011 (Fase 2)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/batches/analyze',
      payload: {
        items: [
          {
            fileName: 'nota-conforme.xml',
            uf: 'SP',
            municipio: 3550308,
            dataFatoGerador: '2027-03-15',
            tipoItem: 'servico',
            nbs: '115021000',
            cst: '000',
            cClassTrib: '000001',
            baseCalculo: 1000,
            erpCBS: 88,
            erpIBS: 1,
            erpIS: 0,
          },
          {
            fileName: 'nota-divergente.xml',
            uf: 'RS',
            municipio: 4314902,
            dataFatoGerador: '2027-03-15',
            tipoItem: 'servico',
            nbs: '115021000',
            cst: '000',
            cClassTrib: '000001',
            baseCalculo: 1000,
            erpCBS: 70,
            erpIBS: 1,
            erpIS: 0,
          },
          {
            fileName: 'nota-erro.xml',
            uf: 'PR',
            municipio: 4106902,
            dataFatoGerador: '2027-03-15',
            tipoItem: 'bem',
            ncm: '02013000',
            cst: '200',
            cClassTrib: '200035',
            baseCalculo: 500,
          },
        ],
      },
    });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.totalNotas, 3);
    assert.equal(body.conformes, 1);
    assert.equal(body.divergentes, 1);
    assert.equal(body.comErro, 1);
    assert.equal(body.itens[1].diff.cbs, 18);
    assert.equal(body.itens[2].errorCodes[0].code, 'REG-011');
  });

  it('responde via Copiloto determinístico com rastreabilidade das ferramentas (Fase 3)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/copilot/chat',
      payload: {
        message: 'Presto consultoria de TI em Campinas por R$ 12.000, quanto pago no Regular e no Simples?',
      },
    });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.ok(body.toolCalls.length >= 2);
    assert.equal(body.simulationResult.summary.regular.vCBS, 1056);
    assert.ok(body.danfseSampleXml.includes('<NFSe'));
  });
});

