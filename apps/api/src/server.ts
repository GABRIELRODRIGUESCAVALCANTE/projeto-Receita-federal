import cors from '@fastify/cors';
import Fastify from 'fastify';
import type {
  BatchItemInput,
  CopilotChatRequest,
  DanfseRequest,
  StudioSimulationRequest,
} from '@rtc-studio/shared';
import { RtcClients, type RtcEnginesConfig } from './clients/rtcClients.js';
import { appConfig } from './config.js';
import { AppDatabase } from './db.js';
import { BatchAuditService, parseCsvToBatchItems, parseXmlToBatchItem } from './services/batchAuditService.js';
import { CopilotService } from './services/copilotService.js';
import { buildSampleNfseXml, SimulationService } from './services/simulationService.js';

export interface BuildAppOptions {
  enginesConfig?: RtcEnginesConfig;
  dbPath?: string;
  logger?: boolean;
}

export function buildApp(options: BuildAppOptions = {}) {
  const app = Fastify({ logger: options.logger ?? true, bodyLimit: 10 * 1024 * 1024 });

  const clients = new RtcClients(options.enginesConfig ?? appConfig.engines);
  const db = new AppDatabase(options.dbPath ?? appConfig.dbPath);
  const simulationService = new SimulationService(clients, db);
  const batchAuditService = new BatchAuditService(clients, db);
  const copilotService = new CopilotService(clients);

  app.register(cors, { origin: true });

  app.addHook('onClose', async () => {
    db.close();
  });

  // ==================== HEALTH ====================

  app.get('/api/health', async () => {
    return clients.checkSystemHealth();
  });

  // ==================== CATÁLOGOS / DADOS ABERTOS ====================

  app.get('/api/catalog/ufs', async (_req, reply) => {
    try {
      return await clients.getUfs();
    } catch (err) {
      return reply.code(502).send({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get<{ Querystring: { siglaUf: string } }>('/api/catalog/municipios', async (req, reply) => {
    const siglaUf = req.query.siglaUf?.trim();
    if (!siglaUf) return reply.code(400).send({ error: 'siglaUf é obrigatório' });
    try {
      return await clients.getMunicipios(siglaUf);
    } catch (err) {
      return reply.code(502).send({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get<{ Querystring: { data?: string; q?: string; limit?: string } }>('/api/catalog/ncm', async (req, reply) => {
    const data = req.query.data || '2027-01-01';
    const q = (req.query.q || '').trim().toLowerCase();
    const limit = Math.min(Number(req.query.limit || 25), 100);
    try {
      const all = await clients.getNcmsVigentes(data);
      const filtered = q
        ? all.filter((item) => {
            const code = String(item.ncm || item.codigo || '').toLowerCase();
            const desc = String(item.descricao || '').toLowerCase();
            return code.includes(q) || desc.includes(q);
          })
        : all;
      return filtered.slice(0, limit);
    } catch (err) {
      return reply.code(502).send({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get<{ Querystring: { data?: string; q?: string; limit?: string } }>('/api/catalog/nbs', async (req, reply) => {
    const data = req.query.data || '2027-01-01';
    const q = (req.query.q || '').trim().toLowerCase();
    const limit = Math.min(Number(req.query.limit || 25), 100);
    try {
      const all = await clients.getNbsLista(data);
      const filtered = q
        ? all.filter((item) => {
            const code = String(item.nbs || item.codigo || '').toLowerCase();
            const desc = String(item.descricao || '').toLowerCase();
            return code.includes(q) || desc.includes(q);
          })
        : all;
      return filtered.slice(0, limit);
    } catch (err) {
      return reply.code(502).send({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get<{ Querystring: { data?: string; q?: string } }>('/api/catalog/classificacoes', async (req, reply) => {
    const data = req.query.data || '2027-01-01';
    const q = (req.query.q || '').trim().toLowerCase();
    try {
      const all = await clients.getClassificacoesCbsIbs(data);
      const filtered = q
        ? all.filter((item) => JSON.stringify(item).toLowerCase().includes(q))
        : all;
      return filtered.slice(0, 60);
    } catch (err) {
      return reply.code(502).send({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get<{ Querystring: { data?: string; tpDoc?: string; cClassTrib?: string } }>(
    '/api/catalog/atividades-simples',
    async (req, reply) => {
      const data = req.query.data || '2027-03-15';
      try {
        return await clients.getAtividadesSimples(data, {
          tpDoc: req.query.tpDoc,
          cClassTrib: req.query.cClassTrib,
        });
      } catch (err) {
        return reply.code(502).send({ error: err instanceof Error ? err.message : String(err) });
      }
    }
  );

  app.get<{ Querystring: { codigo: string } }>('/api/catalog/erro', async (req, reply) => {
    const codigo = req.query.codigo?.trim().toUpperCase();
    if (!codigo) return reply.code(400).send({ error: 'codigo é obrigatório (ex: REG-011 ou VSN-001)' });
    try {
      if (codigo.startsWith('VSN-')) {
        return await clients.getSimplesNacionalError(codigo);
      }
      return await clients.getRegimeRegularError(codigo);
    } catch (err) {
      return reply.code(404).send({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // ==================== FASE 1: ESTÚDIO INTERATIVO ====================

  app.post<{ Body: StudioSimulationRequest }>('/api/studio/simulate', async (req, reply) => {
    const body = req.body;
    if (!body || !Array.isArray(body.itens) || body.itens.length === 0) {
      return reply.code(400).send({ error: 'Informe ao menos 1 item para simulação.' });
    }
    return simulationService.simulate(body);
  });

  app.get('/api/studio/history', async () => {
    return db.listSimulations(30);
  });

  app.get<{ Params: { id: string } }>('/api/studio/history/:id', async (req, reply) => {
    const found = db.getSimulation(req.params.id);
    if (!found) return reply.code(404).send({ error: 'Simulação não encontrada' });
    return found;
  });

  app.post<{ Body: { roc: unknown; tipo?: string } }>('/api/studio/xml/generate', async (req, reply) => {
    try {
      const xml = await clients.generateXmlFromRoc(req.body.roc, req.body.tipo || 'nfe');
      return { xml };
    } catch (err) {
      return reply.code(422).send({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post<{ Body: { xml: string; tipo?: string; subtipo?: string } }>('/api/studio/xml/validate', async (req, reply) => {
    if (!req.body?.xml) return reply.code(400).send({ error: 'xml é obrigatório' });
    try {
      const valid = await clients.validateXml(req.body.xml, req.body.tipo || 'nfe', req.body.subtipo || 'grupo');
      return { valid };
    } catch (err) {
      return reply.code(422).send({ valid: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post<{
    Body: {
      dataFatoGerador: string;
      municipio: number;
      descricaoServico: string;
      valorServico: number;
      prestadorNome?: string;
      prestadorCnpj?: string;
      optanteSimples?: boolean;
      infoComplementar?: string;
    };
  }>('/api/studio/nfse-sample-xml', async (req) => {
    const xml = buildSampleNfseXml(req.body);
    return { xml };
  });

  app.post<{ Body: DanfseRequest }>('/api/studio/danfse', async (req, reply) => {
    if (!req.body?.xml?.trim()) {
      return reply.code(400).send({ error: 'Conteúdo XML da NFS-e é obrigatório.' });
    }
    try {
      const pdf = await clients.generateDanfsePdf(req.body.xml, req.body.stc ?? '0', req.body.canhoto ?? true);
      reply.header('Content-Type', 'application/pdf');
      reply.header('Content-Disposition', 'inline; filename="danfse-rtc-studio.pdf"');
      return reply.send(pdf);
    } catch (err) {
      return reply.code(422).send({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // ==================== FASE 2: RAIO-X & AUDITORIA EM LOTE ====================

  app.post<{
    Body: {
      items?: BatchItemInput[];
      xmlFiles?: Array<{ fileName: string; content: string }>;
      csvContent?: string;
    };
  }>('/api/batches/analyze', async (req, reply) => {
    const collected: BatchItemInput[] = [];

    if (Array.isArray(req.body?.items)) {
      collected.push(...req.body.items);
    }

    if (Array.isArray(req.body?.xmlFiles)) {
      for (const f of req.body.xmlFiles) {
        try {
          collected.push(parseXmlToBatchItem(f.fileName, f.content));
        } catch (err) {
          return reply.code(400).send({ error: err instanceof Error ? err.message : String(err) });
        }
      }
    }

    if (req.body?.csvContent?.trim()) {
      collected.push(...parseCsvToBatchItems(req.body.csvContent));
    }

    if (collected.length === 0) {
      return reply.code(400).send({ error: 'Envie ao menos um item (items, xmlFiles ou csvContent).' });
    }

    return batchAuditService.analyzeBatch(collected);
  });

  app.get('/api/batches/history', async () => {
    return db.listBatchAnalyses(20);
  });

  app.get<{ Params: { id: string } }>('/api/batches/history/:id', async (req, reply) => {
    const found = db.getBatchAnalysis(req.params.id);
    if (!found) return reply.code(404).send({ error: 'Análise de lote não encontrada' });
    return found;
  });

  // ==================== FASE 3: COPILOTO IA DETERMINÍSTICO ====================

  app.post<{ Body: CopilotChatRequest }>('/api/copilot/chat', async (req, reply) => {
    if (!req.body?.message?.trim()) {
      return reply.code(400).send({ error: 'Informe uma mensagem para o Copiloto.' });
    }
    return copilotService.chat(req.body);
  });

  return app;
}

