import type {
  BatchAnalysisResponse,
  BatchItemInput,
  CopilotChatRequest,
  CopilotChatResponse,
  SimulationHistoryEntry,
  StudioSimulationRequest,
  StudioSimulationResponse,
  SystemHealthResponse,
} from '@rtc-studio/shared';

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const text = await res.text();
  if (!res.ok) {
    let msg = text;
    try {
      const parsed = JSON.parse(text);
      msg = parsed.error || parsed.message || text;
    } catch {
      // keep raw text
    }
    throw new Error(msg || `Erro HTTP ${res.status}`);
  }
  return text ? (JSON.parse(text) as T) : ({} as T);
}

export const api = {
  getHealth: () => requestJson<SystemHealthResponse>('/api/health'),

  simulate: (payload: StudioSimulationRequest) =>
    requestJson<StudioSimulationResponse>('/api/studio/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  getHistory: () => requestJson<SimulationHistoryEntry[]>('/api/studio/history'),

  getHistoryItem: (id: string) =>
    requestJson<{ request: StudioSimulationRequest; response: StudioSimulationResponse }>(`/api/studio/history/${id}`),

  generateSampleNfseXml: (payload: {
    dataFatoGerador: string;
    municipio: number;
    descricaoServico: string;
    valorServico: number;
    prestadorNome?: string;
    optanteSimples?: boolean;
    infoComplementar?: string;
  }) =>
    requestJson<{ xml: string }>('/api/studio/nfse-sample-xml', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  generateXmlFromRoc: (roc: unknown, tipo = 'nfe') =>
    requestJson<{ xml: string }>('/api/studio/xml/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roc, tipo }),
    }),

  validateXml: (xml: string, tipo = 'nfe', subtipo = 'grupo') =>
    requestJson<{ valid: boolean; error?: string }>('/api/studio/xml/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ xml, tipo, subtipo }),
    }),

  generateDanfsePdf: async (xml: string, stc: '0' | '1' | '2' = '0', canhoto = true): Promise<Blob> => {
    const res = await fetch('/api/studio/danfse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ xml, stc, canhoto }),
    });
    if (!res.ok) {
      const txt = await res.text();
      let msg = txt;
      try {
        msg = JSON.parse(txt).error || txt;
      } catch {
        // ignore
      }
      throw new Error(msg || `Erro HTTP ${res.status}`);
    }
    return res.blob();
  },

  searchCatalog: (kind: 'ncm' | 'nbs' | 'classificacoes', q: string, data = '2027-01-01') =>
    requestJson<Array<Record<string, unknown>>>(
      `/api/catalog/${kind}?data=${encodeURIComponent(data)}&q=${encodeURIComponent(q)}&limit=15`
    ),

  analyzeBatch: (payload: {
    items?: BatchItemInput[];
    xmlFiles?: Array<{ fileName: string; content: string }>;
    csvContent?: string;
  }) =>
    requestJson<BatchAnalysisResponse>('/api/batches/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  chatCopilot: (payload: CopilotChatRequest) =>
    requestJson<CopilotChatResponse>('/api/copilot/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
};

