// ============================================================
// RTC Studio — Contratos compartilhados entre API e Web
// Baseados nos DTOs oficiais dos 3 repositórios da Receita Federal
// ============================================================

export type EngineName = 'regimeRegular' | 'simplesNacional' | 'geradorDanfse';

export interface EngineHealthStatus {
  name: EngineName;
  label: string;
  url: string;
  status: 'online' | 'offline' | 'degraded';
  latencyMs?: number;
  version?: string;
  error?: string;
}

export interface SystemHealthResponse {
  status: 'ok' | 'partial' | 'degraded';
  checkedAt: string;
  engines: Record<EngineName, EngineHealthStatus>;
}

// ---------- Regime Regular (calculadora-rtc-regime-regular) ----------

export interface AliquotasNominaisInput {
  cbs: number;
  ibsEstadual: number;
  ibsMunicipal: number;
  impostoSeletivo?: {
    adValorem?: number;
    adRem?: number;
  };
}

export interface ImpostoSeletivoInput {
  cst: string;
  cClassTrib: string;
  baseCalculo: number;
  quantidade?: number;
  unidade?: string;
  impostoInformado?: number;
}

export interface ItemRegimeRegularInput {
  numero: number;
  ncm?: string;
  nbs?: string;
  cst: string;
  cClassTrib: string;
  baseCalculo?: number;
  quantidade?: number;
  unidade?: string;
  impostoSeletivo?: ImpostoSeletivoInput;
  aliquotasNominais?: AliquotasNominaisInput;
}

export interface OperacaoRegimeRegularInput {
  id: string;
  versao: string;
  dhFatoGerador: string;
  municipio: number;
  uf: string;
  itens: ItemRegimeRegularInput[];
}

export interface ObservabilidadeErro {
  code?: string;
  codigo?: string;
  title?: string;
  titulo?: string;
  pointer?: string;
  detail?: string;
  detalhe?: string;
  message?: string;
}

export interface RegimeRegularResponse {
  objetos?: Array<{
    nObj: number;
    estadoItem?: string;
    tribCalc?: Record<string, unknown>;
    erros?: ObservabilidadeErro[];
    memoriaCalculo?: string;
  }>;
  total?: {
    tribCalc?: {
      ISTot?: { vIS?: string | number };
      IBSCBSTot?: {
        vBCIBSCBS?: string | number;
        gIBS?: { vIBS?: string | number };
        gCBS?: { vCBS?: string | number };
      };
    };
  };
  [key: string]: unknown;
}

// ---------- Simples Nacional (calculadora-rtc-simples-nacional) ----------

export interface ItemSimplesInput {
  numero: number;
  cAtivSN?: string;
  cClassTrib: string;
  nbs?: string;
  ncm?: string;
  baseCalculo: string;
  valorImpostoSeletivo: string;
  pIBSSN?: string;
  pCBSSN?: string;
}

export interface OperacaoSimplesInput {
  id: string;
  versao: string;
  data: string; // YYYY-MM-DD
  tpDoc: string; // "55" | "65"
  CRT: string; // "1" | "2" | "3" | "4"
  tpRegimeIBSCBS?: string | null;
  tpEnteGov?: string | null;
  itens: ItemSimplesInput[];
}

export interface SimplesNacionalResponse {
  id?: string;
  objetos?: Array<{
    nObj?: number;
    numero?: number;
    estadoItem?: string;
    tribCalc?: Record<string, unknown>;
    erros?: ObservabilidadeErro[];
    [key: string]: unknown;
  }>;
  total?: Record<string, unknown>;
  erros?: ObservabilidadeErro[];
  [key: string]: unknown;
}

// ---------- Estúdio Unificado (Simulação Comparativa) ----------

export type SimulationMode = 'both' | 'regular' | 'simples';

export interface StudioItemInput {
  numero: number;
  descricao?: string;
  tipoItem: 'servico' | 'bem';
  ncm?: string;
  nbs?: string;
  cst: string;
  cClassTrib: string;
  baseCalculo: number;
  quantidade?: number;
  unidade?: string;
  // Alíquotas nominais (Regime Regular >= 2027)
  aliquotaCbs: number;
  aliquotaIbsUf: number;
  aliquotaIbsMun: number;
  // Campos específicos Simples Nacional
  cAtivSN?: string;
  pCBSSN?: string;
  pIBSSN?: string;
  valorImpostoSeletivo?: number;
}

export interface StudioSimulationRequest {
  titulo?: string;
  mode: SimulationMode;
  dataFatoGerador: string; // YYYY-MM-DD
  uf: string;
  municipio: number;
  tpDoc: string; // "55" | "65"
  CRT: string; // "1" | "2" | "3"
  itens: StudioItemInput[];
  salvarHistorico?: boolean;
}

export interface RegimeTotalsSummary {
  available: boolean;
  baseCalculo: number;
  vCBS: number;
  vIBS: number;
  vIS: number;
  totalTributos: number;
  cargaEfetivaPct: number;
  errorsCount: number;
  error?: string;
}

export interface StudioSimulationResponse {
  id: string;
  createdAt: string;
  titulo: string;
  mode: SimulationMode;
  summary: {
    regular?: RegimeTotalsSummary;
    simples?: RegimeTotalsSummary;
    diferencaTotal?: number; // regular.totalTributos - simples.totalTributos
    regimeMaisEconomico?: 'regular' | 'simples' | 'empate';
  };
  regularRaw?: RegimeRegularResponse;
  simplesRaw?: SimplesNacionalResponse;
  regularPayload?: OperacaoRegimeRegularInput;
  simplesPayload?: OperacaoSimplesInput;
}

export interface SimulationHistoryEntry {
  id: string;
  titulo: string;
  mode: SimulationMode;
  uf: string;
  municipio: number;
  dataFatoGerador: string;
  totalRegular: number | null;
  totalSimples: number | null;
  createdAt: string;
}

// ---------- Dados Abertos / Catálogos ----------

export interface UfItem {
  sigla: string;
  nome: string;
  codigo?: number;
}

export interface MunicipioItem {
  codigo: number;
  nome: string;
}

export interface CatalogSearchItem {
  code: string;
  label: string;
  extra?: Record<string, unknown>;
}

// ---------- DANFSe (calculadora-rtc-gerador-danfse) ----------

export interface DanfseRequest {
  xml: string;
  stc?: '0' | '1' | '2';
  canhoto?: boolean;
}

// ---------- Raio-X & Auditoria em Lote (Fase 2) ----------

export interface BatchItemInput {
  fileName: string;
  numeroNota?: string;
  uf: string;
  municipio: number;
  dataFatoGerador: string;
  tipoItem: 'servico' | 'bem';
  ncm?: string;
  nbs?: string;
  cst: string;
  cClassTrib: string;
  baseCalculo: number;
  cAtivSN?: string;
  pCBSSN?: string;
  pIBSSN?: string;
  aliquotaCbs?: number;
  aliquotaIbsUf?: number;
  aliquotaIbsMun?: number;
  // Valores declarados pelo ERP para auditoria (diff)
  erpCBS?: number;
  erpIBS?: number;
  erpIS?: number;
  rawXml?: string;
}

export interface AuditItemResult {
  fileName: string;
  numeroNota?: string;
  uf: string;
  municipio: number;
  baseCalculo: number;
  status: 'conforme' | 'divergente' | 'erro';
  regular: RegimeTotalsSummary;
  simples: RegimeTotalsSummary;
  erpDeclarado?: {
    vCBS: number;
    vIBS: number;
    vIS: number;
    total: number;
  };
  diff?: {
    cbs: number;
    ibs: number;
    is: number;
    total: number;
  };
  errorCodes: Array<{
    source: 'regular' | 'simples';
    code: string;
    title: string;
    detail: string;
  }>;
  studioSeed: StudioSimulationRequest;
}

export interface BatchAnalysisResponse {
  id: string;
  createdAt: string;
  totalNotas: number;
  conformes: number;
  divergentes: number;
  comErro: number;
  totais: {
    baseCalculo: number;
    regularTotal: number;
    simplesTotal: number;
    economiaEstimada: number;
    regimeRecomendado: 'regular' | 'simples' | 'empate';
    porUf: Array<{ uf: string; notas: number; regularTotal: number; simplesTotal: number }>;
  };
  itens: AuditItemResult[];
}

// ---------- Copiloto IA Determinístico (Fase 3) ----------

export interface CopilotMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  toolCalls?: Array<{
    tool: string;
    input: Record<string, unknown>;
    outputSummary: string;
  }>;
  simulationResult?: StudioSimulationResponse;
  legalBasis?: Array<{ code: string; description: string }>;
}

export interface CopilotChatRequest {
  message: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  attachedXml?: string;
}

export interface CopilotChatResponse {
  provider: string;
  model: string;
  reply: string;
  toolCalls: Array<{
    tool: string;
    input: Record<string, unknown>;
    outputSummary: string;
  }>;
  simulationResult?: StudioSimulationResponse;
  legalBasis?: Array<{ code: string; description: string }>;
  danfseSampleXml?: string;
}

