import { useEffect, useState } from 'react';
import type {
  SimulationHistoryEntry,
  StudioSimulationRequest,
  StudioSimulationResponse,
} from '@rtc-studio/shared';
import {
  AlertTriangle,
  CheckCircle2,
  Code2,
  Download,
  FileCode2,
  FileText,
  History,
  Play,
  RefreshCw,
  Scale,
  Search,
} from 'lucide-react';
import { api } from '../api/client';
import { AnimatedCurrency, CopyButton, RateMeter, SegmentedTabs } from './ui/Primitives';

export const STUDIO_PRESETS: Array<{ label: string; tag: string; request: StudioSimulationRequest }> = [
  {
    label: 'Serviço Educação',
    tag: 'Redução 60%',
    request: {
      titulo: 'Serviço de Educação — Porto Alegre/RS',
      mode: 'both',
      dataFatoGerador: '2027-03-15',
      uf: 'RS',
      municipio: 4314902,
      tpDoc: '55',
      CRT: '1',
      itens: [
        {
          numero: 1,
          descricao: 'Curso de Especialização em Tecnologia',
          tipoItem: 'servico',
          nbs: '122011200',
          cst: '200',
          cClassTrib: '200028',
          baseCalculo: 1200,
          aliquotaCbs: 8.8,
          aliquotaIbsUf: 0.05,
          aliquotaIbsMun: 0.05,
          cAtivSN: '01',
          pCBSSN: '2.50',
          pIBSSN: '0.05',
          valorImpostoSeletivo: 0,
        },
      ],
    },
  },
  {
    label: 'Consultoria de TI',
    tag: 'Integral',
    request: {
      titulo: 'Consultoria de Software — São Paulo/SP',
      mode: 'both',
      dataFatoGerador: '2027-03-15',
      uf: 'SP',
      municipio: 3550308,
      tpDoc: '55',
      CRT: '1',
      itens: [
        {
          numero: 1,
          descricao: 'Desenvolvimento e Arquitetura de Sistemas',
          tipoItem: 'servico',
          nbs: '115021000',
          cst: '000',
          cClassTrib: '000001',
          baseCalculo: 15000,
          aliquotaCbs: 8.8,
          aliquotaIbsUf: 0.05,
          aliquotaIbsMun: 0.05,
          cAtivSN: '01',
          pCBSSN: '2.38',
          pIBSSN: '0.03',
          valorImpostoSeletivo: 0,
        },
      ],
    },
  },
  {
    label: 'Mercadoria NCM',
    tag: 'Bebida 2203',
    request: {
      titulo: 'Venda de Mercadoria — Curitiba/PR',
      mode: 'both',
      dataFatoGerador: '2027-03-15',
      uf: 'PR',
      municipio: 4106902,
      tpDoc: '55',
      CRT: '1',
      itens: [
        {
          numero: 1,
          descricao: 'Bebida — NCM 22030000',
          tipoItem: 'bem',
          ncm: '22030000',
          cst: '000',
          cClassTrib: '000001',
          baseCalculo: 2500,
          quantidade: 100,
          unidade: 'LT',
          aliquotaCbs: 8.8,
          aliquotaIbsUf: 0.05,
          aliquotaIbsMun: 0.05,
          cAtivSN: '01',
          pCBSSN: '1.16',
          pIBSSN: '0.01',
          valorImpostoSeletivo: 0,
        },
      ],
    },
  },
];

interface StudioViewProps {
  externalSeed?: StudioSimulationRequest | null;
  externalDanfseXml?: string | null;
  onClearExternalSeed?: () => void;
}

const fmtBRL = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });

export function StudioView({ externalSeed, externalDanfseXml, onClearExternalSeed }: StudioViewProps) {
  const [form, setForm] = useState<StudioSimulationRequest>(STUDIO_PRESETS[0].request);
  const [result, setResult] = useState<StudioSimulationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'comparativo' | 'xml' | 'danfse' | 'code'>('comparativo');
  const [codeLang, setCodeLang] = useState<'curl' | 'ts' | 'python'>('curl');

  // XML & DANFSe state
  const [danfseXml, setDanfseXml] = useState('');
  const [danfseStc, setDanfseStc] = useState<'0' | '1' | '2'>('0');
  const [danfseCanhoto, setDanfseCanhoto] = useState(true);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [danfseLoading, setDanfseLoading] = useState(false);
  const [danfseError, setDanfseError] = useState<string | null>(null);

  // XML validation state
  const [groupXml, setGroupXml] = useState('');
  const [xmlLoading, setXmlLoading] = useState(false);
  const [xmlValidStatus, setXmlValidStatus] = useState<{ valid: boolean; msg: string } | null>(null);

  // Catalog search
  const [catalogQuery, setCatalogQuery] = useState('');
  const [catalogResults, setCatalogResults] = useState<Array<Record<string, unknown>>>([]);
  const [catalogSearched, setCatalogSearched] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);

  // History
  const [history, setHistory] = useState<SimulationHistoryEntry[]>([]);
  const [loadingHistoryId, setLoadingHistoryId] = useState<string | null>(null);

  const item = form.itens[0];

  const loadHistory = async () => {
    try {
      const h = await api.getHistory();
      setHistory(h);
    } catch {
      // ignore if api unavailable
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  useEffect(() => {
    if (externalSeed) {
      setForm(externalSeed);
      onClearExternalSeed?.();
    }
  }, [externalSeed, onClearExternalSeed]);

  useEffect(() => {
    if (externalDanfseXml) {
      setDanfseXml(externalDanfseXml);
      setActiveTab('danfse');
    }
  }, [externalDanfseXml]);

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  const updateItem = (patch: Partial<StudioSimulationRequest['itens'][0]>) => {
    setForm((prev) => ({
      ...prev,
      itens: [{ ...prev.itens[0], ...patch }],
    }));
  };

  const handleSimulate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.simulate(form);
      setResult(res);
      loadHistory();

      const sample = await api.generateSampleNfseXml({
        dataFatoGerador: form.dataFatoGerador,
        municipio: form.municipio,
        descricaoServico: item.descricao || 'Prestação de Serviços — RTC Studio',
        valorServico: item.baseCalculo,
        optanteSimples: res.summary.regimeMaisEconomico === 'simples',
        infoComplementar: `RTC Studio | Regular: ${fmtBRL(res.summary.regular?.totalTributos || 0)} | Simples: ${fmtBRL(res.summary.simples?.totalTributos || 0)}`,
      });
      setDanfseXml(sample.xml);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateDanfse = async () => {
    setDanfseLoading(true);
    setDanfseError(null);
    try {
      let xmlToSend = danfseXml.trim();
      if (!xmlToSend) {
        const sample = await api.generateSampleNfseXml({
          dataFatoGerador: form.dataFatoGerador,
          municipio: form.municipio,
          descricaoServico: item.descricao || 'Serviço Exemplo RTC Studio',
          valorServico: item.baseCalculo,
        });
        xmlToSend = sample.xml;
        setDanfseXml(xmlToSend);
      }
      const blob = await api.generateDanfsePdf(xmlToSend, danfseStc, danfseCanhoto);
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      setPdfUrl(URL.createObjectURL(blob));
    } catch (err) {
      setDanfseError(err instanceof Error ? err.message : String(err));
    } finally {
      setDanfseLoading(false);
    }
  };

  const handleGenerateAndValidateGroupXml = async () => {
    setXmlValidStatus(null);
    if (!result?.regularRaw) {
      setXmlValidStatus({ valid: false, msg: 'Execute uma simulação no Regime Regular antes de gerar o grupo XML.' });
      return;
    }
    setXmlLoading(true);
    try {
      const gen = await api.generateXmlFromRoc(result.regularRaw, 'nfe');
      setGroupXml(gen.xml);
      const val = await api.validateXml(gen.xml, 'nfe', 'grupo');
      setXmlValidStatus({
        valid: val.valid,
        msg: val.valid
          ? 'XML validado conforme o schema XSD oficial da Receita Federal.'
          : val.error || 'XML fora do schema XSD oficial.',
      });
    } catch (err) {
      setXmlValidStatus({ valid: false, msg: err instanceof Error ? err.message : String(err) });
    } finally {
      setXmlLoading(false);
    }
  };

  const handleCatalogSearch = async () => {
    if (!catalogQuery.trim()) return;
    setCatalogLoading(true);
    setCatalogSearched(true);
    try {
      const kind = item.tipoItem === 'bem' ? 'ncm' : 'nbs';
      const rows = await api.searchCatalog(kind, catalogQuery, form.dataFatoGerador);
      setCatalogResults(rows);
    } catch {
      setCatalogResults([]);
    } finally {
      setCatalogLoading(false);
    }
  };

  const handleSelectHistory = async (id: string) => {
    setLoadingHistoryId(id);
    setError(null);
    try {
      const saved = await api.getHistoryItem(id);
      setForm(saved.request);
      setResult(saved.response);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingHistoryId(null);
    }
  };

  const codeSnippets: Record<'curl' | 'ts' | 'python', string> = {
    curl: `curl -X POST http://localhost:3001/api/studio/simulate \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(form, null, 2)}'`,
    ts: `const res = await fetch('http://localhost:3001/api/studio/simulate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(${JSON.stringify(form, null, 2)}),
});
const data = await res.json();
console.log(data.summary);`,
    python: `import requests

payload = ${JSON.stringify(form, null, 2).replace(/true/g, 'True').replace(/false/g, 'False').replace(/null/g, 'None')}

resp = requests.post("http://localhost:3001/api/studio/simulate", json=payload)
print(resp.json()["summary"])`,
  };

  const winnerLabel =
    result?.summary.regimeMaisEconomico === 'simples'
      ? 'Simples Nacional'
      : result?.summary.regimeMaisEconomico === 'regular'
        ? 'Regime Regular'
        : 'Empate técnico';

  return (
    <div className="space-y-5">
      {/* Cabeçalho da página */}
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-4 md:flex-row md:items-end dark:border-[#232C38]">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Estúdio interativo
          </h1>
          <p className="mt-1 max-w-2xl text-[13px] text-slate-600 dark:text-slate-400">
            Simule operações na LC 214/2025 comparando Regime Regular e Simples Nacional, valide XML no XSD oficial e gere o DANFSe em PDF.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-medium text-slate-500 dark:text-slate-400">Cenários:</span>
          {STUDIO_PRESETS.map((p) => {
            const isSelected = form.titulo === p.request.titulo;
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => setForm(p.request)}
                className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  isSelected
                    ? 'border-[#0B4F6C] bg-[#EDF5F8] text-[#0B4F6C] dark:border-[#38A3C7]/60 dark:bg-sky-400/10 dark:text-[#5CC2E3]'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-[#232C38] dark:bg-[#131920] dark:text-slate-300 dark:hover:border-[#334155] dark:hover:bg-[#1A222C]'
                }`}
              >
                <span>{p.label}</span>
                <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400">{p.tag}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bancada principal: Parâmetros (5) + Resultados (7) */}
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-12">
        {/* ESQUERDA: Parâmetros da Operação */}
        <section className="rtc-panel rounded-lg xl:col-span-5" aria-label="Parâmetros da simulação">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 sm:px-5 dark:border-[#232C38]">
            <h2 className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">Parâmetros da operação</h2>
            <label className="sr-only" htmlFor="studio-mode">
              Modo de simulação
            </label>
            <select
              id="studio-mode"
              value={form.mode}
              onChange={(e) => setForm({ ...form, mode: e.target.value as StudioSimulationRequest['mode'] })}
              className="rtc-input h-8 rounded-md px-2.5 text-xs font-medium"
            >
              <option value="both">Comparar ambos os regimes</option>
              <option value="regular">Somente Regime Regular</option>
              <option value="simples">Somente Simples Nacional</option>
            </select>
          </div>

          <div className="space-y-5 p-4 sm:p-5">
            {/* Bloco 1: Identificação e local */}
            <div className="space-y-3">
              <label className="block">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Descrição do serviço ou mercadoria
                </span>
                <input
                  value={item.descricao || ''}
                  onChange={(e) => updateItem({ descricao: e.target.value })}
                  className="rtc-input mt-1 h-9 w-full rounded-md px-3 text-[13px]"
                />
              </label>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Data do fato gerador</span>
                  <input
                    type="date"
                    value={form.dataFatoGerador}
                    onChange={(e) => setForm({ ...form, dataFatoGerador: e.target.value })}
                    className="rtc-input mt-1 h-9 w-full rounded-md px-2.5 font-mono text-[13px] tabular-nums"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Tipo de operação</span>
                  <select
                    value={item.tipoItem}
                    onChange={(e) => updateItem({ tipoItem: e.target.value as 'servico' | 'bem' })}
                    className="rtc-input mt-1 h-9 w-full rounded-md px-2.5 text-[13px]"
                  >
                    <option value="servico">Serviço (NBS / NFS-e)</option>
                    <option value="bem">Mercadoria (NCM / NF-e)</option>
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">UF</span>
                  <input
                    value={form.uf}
                    maxLength={2}
                    onChange={(e) => setForm({ ...form, uf: e.target.value.toUpperCase() })}
                    className="rtc-input mt-1 h-9 w-full rounded-md px-3 font-mono text-[13px] uppercase"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Município (IBGE)</span>
                  <input
                    type="number"
                    value={form.municipio}
                    onChange={(e) => setForm({ ...form, municipio: Number(e.target.value) })}
                    className="rtc-input mt-1 h-9 w-full rounded-md px-3 font-mono text-[13px] tabular-nums"
                  />
                </label>
              </div>
            </div>

            {/* Bloco 2: Classificação fiscal */}
            <div className="space-y-3 border-t border-slate-100 pt-4 dark:border-[#232C38]">
              <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Classificação fiscal e base
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    {item.tipoItem === 'bem' ? 'NCM (8 dígitos)' : 'NBS (9 dígitos)'}
                  </span>
                  <input
                    value={item.tipoItem === 'bem' ? item.ncm || '' : item.nbs || ''}
                    onChange={(e) =>
                      item.tipoItem === 'bem'
                        ? updateItem({ ncm: e.target.value })
                        : updateItem({ nbs: e.target.value })
                    }
                    className="rtc-input mt-1 h-9 w-full rounded-md px-3 font-mono text-[13px] tabular-nums"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Base de cálculo (R$)</span>
                  <input
                    type="number"
                    step="0.01"
                    value={item.baseCalculo}
                    onChange={(e) => updateItem({ baseCalculo: Number(e.target.value) })}
                    className="rtc-input mt-1 h-9 w-full rounded-md px-3 font-mono text-[13px] font-medium tabular-nums"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">CST</span>
                  <input
                    value={item.cst}
                    onChange={(e) => updateItem({ cst: e.target.value })}
                    className="rtc-input mt-1 h-9 w-full rounded-md px-3 font-mono text-[13px] tabular-nums"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">cClassTrib</span>
                  <input
                    value={item.cClassTrib}
                    onChange={(e) => updateItem({ cClassTrib: e.target.value })}
                    className="rtc-input mt-1 h-9 w-full rounded-md px-3 font-mono text-[13px] tabular-nums"
                  />
                </label>
              </div>

              {/* Consulta nos Dados Abertos da Receita */}
              <div className="rounded-md border border-slate-200 bg-slate-50/70 p-3 dark:border-[#232C38] dark:bg-[#0C1015]/60">
                <label
                  htmlFor="catalog-search-input"
                  className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  <Search className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" aria-hidden="true" />
                  <span>Consultar {item.tipoItem === 'bem' ? 'NCM' : 'NBS'} nos Dados Abertos da Receita</span>
                </label>
                <div className="flex gap-2">
                  <input
                    id="catalog-search-input"
                    placeholder={`Ex.: ${item.tipoItem === 'bem' ? 'cerveja ou 2203' : 'educação ou 1220'}`}
                    value={catalogQuery}
                    onChange={(e) => setCatalogQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCatalogSearch()}
                    className="rtc-input h-8 flex-1 rounded-md px-2.5 text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleCatalogSearch}
                    disabled={catalogLoading}
                    className="rtc-btn-secondary h-8 rounded-md px-3 text-xs font-medium disabled:opacity-50"
                  >
                    {catalogLoading ? 'Buscando...' : 'Buscar'}
                  </button>
                </div>

                {catalogResults.length > 0 && (
                  <div className="mt-2 max-h-36 divide-y divide-slate-200/70 overflow-y-auto overscroll-contain rounded-md border border-slate-200 bg-white dark:divide-[#232C38] dark:border-[#232C38] dark:bg-[#131920]">
                    {catalogResults.map((row, idx) => {
                      const code = String(row.ncm || row.nbs || row.codigo || '');
                      const desc = String(row.descricao || '');
                      return (
                        <button
                          key={`${code}-${idx}`}
                          type="button"
                          onClick={() => {
                            if (item.tipoItem === 'bem') updateItem({ ncm: code });
                            else updateItem({ nbs: code });
                            setCatalogResults([]);
                            setCatalogSearched(false);
                          }}
                          className="block w-full px-2.5 py-2 text-left text-xs text-slate-700 transition-colors hover:bg-[#EDF5F8] hover:text-slate-900 dark:text-slate-300 dark:hover:bg-[#1A222C] dark:hover:text-slate-100"
                        >
                          <span className="font-mono font-semibold text-[#0B4F6C] dark:text-[#5CC2E3]">{code}</span>
                          <span className="mx-1.5 text-slate-300 dark:text-slate-600">|</span>
                          <span>{desc.slice(0, 82)}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {catalogSearched && !catalogLoading && catalogResults.length === 0 && (
                  <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                    Nenhum código encontrado para "{catalogQuery}". Tente um termo mais curto ou código numérico.
                  </p>
                )}
              </div>
            </div>

            {/* Bloco 3: Alíquotas */}
            <div className="space-y-4 border-t border-slate-100 pt-4 dark:border-[#232C38]">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Alíquotas nominais — Regime Regular
                  </span>
                  <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">%</span>
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  <label className="block">
                    <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">CBS</span>
                    <input
                      type="number"
                      step="0.01"
                      value={item.aliquotaCbs}
                      onChange={(e) => updateItem({ aliquotaCbs: Number(e.target.value) })}
                      className="rtc-input mt-1 h-8 w-full rounded-md px-2.5 font-mono text-xs tabular-nums"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">IBS UF</span>
                    <input
                      type="number"
                      step="0.01"
                      value={item.aliquotaIbsUf}
                      onChange={(e) => updateItem({ aliquotaIbsUf: Number(e.target.value) })}
                      className="rtc-input mt-1 h-8 w-full rounded-md px-2.5 font-mono text-xs tabular-nums"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">IBS Mun</span>
                    <input
                      type="number"
                      step="0.01"
                      value={item.aliquotaIbsMun}
                      onChange={(e) => updateItem({ aliquotaIbsMun: Number(e.target.value) })}
                      className="rtc-input mt-1 h-8 w-full rounded-md px-2.5 font-mono text-xs tabular-nums"
                    />
                  </label>
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Parâmetros — Simples Nacional (PGDAS)
                  </span>
                  <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">SN</span>
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  <label className="block">
                    <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">cAtivSN</span>
                    <input
                      value={item.cAtivSN || '01'}
                      onChange={(e) => updateItem({ cAtivSN: e.target.value })}
                      className="rtc-input mt-1 h-8 w-full rounded-md px-2.5 font-mono text-xs tabular-nums"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">pCBSSN (%)</span>
                    <input
                      value={item.pCBSSN || '2.50'}
                      onChange={(e) => updateItem({ pCBSSN: e.target.value })}
                      className="rtc-input mt-1 h-8 w-full rounded-md px-2.5 font-mono text-xs tabular-nums"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">pIBSSN (%)</span>
                    <input
                      value={item.pIBSSN || '0.05'}
                      onChange={(e) => updateItem({ pIBSSN: e.target.value })}
                      className="rtc-input mt-1 h-8 w-full rounded-md px-2.5 font-mono text-xs tabular-nums"
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* Ação principal */}
            <div className="pt-1">
              <button
                type="button"
                onClick={handleSimulate}
                disabled={loading}
                className="rtc-btn-primary flex h-10 w-full items-center justify-center gap-2 rounded-md px-4 text-[13px] font-semibold disabled:opacity-60"
              >
                {loading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Play className="h-3.5 w-3.5 translate-x-px fill-current" aria-hidden="true" />
                )}
                <span>{loading ? 'Consultando motores oficiais...' : 'Calcular nos motores oficiais'}</span>
              </button>

              {error && (
                <div
                  role="alert"
                  className="mt-3 flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200"
                >
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-700 dark:text-rose-400" aria-hidden="true" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            {/* Histórico recente */}
            {history.length > 0 && (
              <div className="border-t border-slate-200 pt-4 dark:border-[#232C38]">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <History className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                  <span>Simulações recentes</span>
                </div>
                <div className="max-h-40 divide-y divide-slate-100 overflow-y-auto overscroll-contain rounded-md border border-slate-200 dark:divide-[#232C38] dark:border-[#232C38]">
                  {history.slice(0, 6).map((h) => (
                    <button
                      key={h.id}
                      type="button"
                      disabled={loadingHistoryId === h.id}
                      onClick={() => handleSelectHistory(h.id)}
                      className="flex w-full items-center justify-between gap-2 bg-white px-3 py-2 text-left text-xs transition-colors hover:bg-slate-50 disabled:opacity-50 dark:bg-[#131920] dark:hover:bg-[#1A222C]"
                    >
                      <span className="truncate font-medium text-slate-800 dark:text-slate-200">{h.titulo}</span>
                      <span className="shrink-0 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] text-slate-600 dark:border-[#2E3A49] dark:bg-[#0C1015] dark:text-slate-300">
                        {h.uf}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* DIREITA: Resultados e Artefatos */}
        <section className="rtc-panel flex flex-col rounded-lg xl:col-span-7" aria-label="Resultados da simulação">
          <div className="border-b border-slate-200 px-4 py-3 sm:px-5 dark:border-[#232C38]">
            <SegmentedTabs
              ariaLabel="Visualizações do resultado"
              active={activeTab}
              onChange={setActiveTab}
              items={[
                { id: 'comparativo', label: 'Comparativo', icon: <Scale className="h-3.5 w-3.5" aria-hidden="true" /> },
                { id: 'xml', label: 'XML e XSD', icon: <FileCode2 className="h-3.5 w-3.5" aria-hidden="true" /> },
                { id: 'danfse', label: 'DANFSe PDF', icon: <FileText className="h-3.5 w-3.5" aria-hidden="true" /> },
                { id: 'code', label: 'Código API', icon: <Code2 className="h-3.5 w-3.5" aria-hidden="true" /> },
              ]}
            />
          </div>

          <div className="p-4 sm:p-5">
            {/* ABA 1: COMPARATIVO */}
            {activeTab === 'comparativo' && (
              <div className="space-y-5">
                {!result ? (
                  <div className="flex min-h-[340px] flex-col items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50/60 px-6 py-10 text-center dark:border-[#2E3A49] dark:bg-[#0C1015]/50">
                    <Scale className="mb-3 h-7 w-7 text-slate-400 dark:text-slate-500" strokeWidth={1.5} aria-hidden="true" />
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Nenhuma simulação executada
                    </p>
                    <p className="mt-1 max-w-md text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                      Revise os parâmetros à esquerda ou selecione um cenário pronto no topo para consultar os motores oficiais da Receita Federal.
                    </p>
                    <button
                      type="button"
                      onClick={handleSimulate}
                      disabled={loading}
                      className="rtc-btn-primary mt-4 inline-flex h-9 items-center gap-2 rounded-md px-3.5 text-xs font-semibold disabled:opacity-60"
                    >
                      <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                      <span>{loading ? 'Consultando...' : 'Simular cenário atual'}</span>
                    </button>
                  </div>
                ) : (
                  <div key={result.id} className="space-y-5">
                    {/* Síntese comparativa */}
                    {result.summary.diferencaTotal !== undefined && (
                      <div className="rounded-md border border-slate-200 border-l-[3px] border-l-emerald-700 bg-slate-50/70 p-4 dark:border-[#232C38] dark:border-l-emerald-500 dark:bg-[#0C1015]/70">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-medium text-emerald-800 dark:text-emerald-400">
                              Síntese comparativa
                            </div>
                            <div className="mt-0.5 text-base font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                              Menor desembolso direto: {winnerLabel}
                            </div>
                            <p className="mt-1 max-w-xl text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                              Em operações B2B, avalie também o aproveitamento integral de créditos de CBS e IBS disponível no Regime Regular.
                            </p>
                          </div>
                          <div className="shrink-0 text-left sm:text-right">
                            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                              Diferença estimada
                            </div>
                            <AnimatedCurrency
                              value={Math.abs(result.summary.diferencaTotal)}
                              className="mt-0.5 block font-mono text-2xl font-semibold tracking-tight text-emerald-800 dark:text-emerald-400"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Demonstrativo lado a lado */}
                    <div className="grid grid-cols-1 divide-y divide-slate-200 rounded-md border border-slate-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0 dark:divide-[#232C38] dark:border-[#232C38]">
                      {result.summary.regular && (
                        <div className="p-4 sm:p-5">
                          <div className="mb-4 flex items-center justify-between gap-2">
                            <h3 className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">
                              Regime Regular
                            </h3>
                            <span
                              className={`rounded px-2 py-0.5 font-mono text-[11px] font-medium ${
                                result.summary.regular.available
                                  ? 'bg-[#EDF5F8] text-[#0B4F6C] dark:bg-sky-400/10 dark:text-[#5CC2E3]'
                                  : 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300'
                              }`}
                            >
                              {result.summary.regular.available ? 'Motor :8080' : 'Offline'}
                            </span>
                          </div>

                          {result.summary.regular.available ? (
                            <div className="space-y-4">
                              <RateMeter
                                value={result.summary.regular.cargaEfetivaPct}
                                max={30}
                                label="Carga efetiva (LC 214)"
                                tone="primary"
                              />

                              <dl className="divide-y divide-slate-100 text-xs dark:divide-[#232C38]">
                                <div className="flex items-center justify-between py-2">
                                  <dt className="text-slate-600 dark:text-slate-400">Base de cálculo</dt>
                                  <dd className="font-mono text-slate-900 tabular-nums dark:text-slate-100">
                                    {fmtBRL(result.summary.regular.baseCalculo)}
                                  </dd>
                                </div>
                                <div className="flex items-center justify-between py-2">
                                  <dt className="text-slate-600 dark:text-slate-400">CBS</dt>
                                  <dd className="font-mono text-slate-900 tabular-nums dark:text-slate-100">
                                    {fmtBRL(result.summary.regular.vCBS)}
                                  </dd>
                                </div>
                                <div className="flex items-center justify-between py-2">
                                  <dt className="text-slate-600 dark:text-slate-400">IBS</dt>
                                  <dd className="font-mono text-slate-900 tabular-nums dark:text-slate-100">
                                    {fmtBRL(result.summary.regular.vIBS)}
                                  </dd>
                                </div>
                                <div className="flex items-center justify-between py-2">
                                  <dt className="text-slate-600 dark:text-slate-400">Imposto Seletivo (IS)</dt>
                                  <dd className="font-mono text-slate-900 tabular-nums dark:text-slate-100">
                                    {fmtBRL(result.summary.regular.vIS)}
                                  </dd>
                                </div>
                                <div className="flex items-center justify-between pt-3 text-sm font-semibold">
                                  <dt className="text-slate-900 dark:text-slate-100">Total de tributos</dt>
                                  <dd>
                                    <AnimatedCurrency
                                      value={result.summary.regular.totalTributos}
                                      className="font-mono text-[#0B4F6C] dark:text-[#5CC2E3]"
                                    />
                                  </dd>
                                </div>
                              </dl>
                            </div>
                          ) : (
                            <p className="text-xs text-rose-700 dark:text-rose-400">{result.summary.regular.error}</p>
                          )}
                        </div>
                      )}

                      {result.summary.simples && (
                        <div className="p-4 sm:p-5">
                          <div className="mb-4 flex items-center justify-between gap-2">
                            <h3 className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">
                              Simples Nacional
                            </h3>
                            <span
                              className={`rounded px-2 py-0.5 font-mono text-[11px] font-medium ${
                                result.summary.simples.available
                                  ? 'bg-slate-100 text-slate-700 dark:bg-[#1A222C] dark:text-slate-300'
                                  : 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300'
                              }`}
                            >
                              {result.summary.simples.available ? 'Motor :8082' : 'Offline'}
                            </span>
                          </div>

                          {result.summary.simples.available ? (
                            <div className="space-y-4">
                              <RateMeter
                                value={result.summary.simples.cargaEfetivaPct}
                                max={30}
                                label="Carga efetiva (CBS + IBS)"
                                tone="neutral"
                              />

                              <dl className="divide-y divide-slate-100 text-xs dark:divide-[#232C38]">
                                <div className="flex items-center justify-between py-2">
                                  <dt className="text-slate-600 dark:text-slate-400">Receita bruta</dt>
                                  <dd className="font-mono text-slate-900 tabular-nums dark:text-slate-100">
                                    {fmtBRL(result.summary.simples.baseCalculo)}
                                  </dd>
                                </div>
                                <div className="flex items-center justify-between py-2">
                                  <dt className="text-slate-600 dark:text-slate-400">CBS (Simples)</dt>
                                  <dd className="font-mono text-slate-900 tabular-nums dark:text-slate-100">
                                    {fmtBRL(result.summary.simples.vCBS)}
                                  </dd>
                                </div>
                                <div className="flex items-center justify-between py-2">
                                  <dt className="text-slate-600 dark:text-slate-400">IBS (Simples)</dt>
                                  <dd className="font-mono text-slate-900 tabular-nums dark:text-slate-100">
                                    {fmtBRL(result.summary.simples.vIBS)}
                                  </dd>
                                </div>
                                <div className="flex items-center justify-between py-2">
                                  <dt className="text-slate-400 dark:text-slate-500">Imposto Seletivo</dt>
                                  <dd className="font-mono text-slate-400 dark:text-slate-500">—</dd>
                                </div>
                                <div className="flex items-center justify-between pt-3 text-sm font-semibold">
                                  <dt className="text-slate-900 dark:text-slate-100">Total de tributos</dt>
                                  <dd>
                                    <AnimatedCurrency
                                      value={result.summary.simples.totalTributos}
                                      className="font-mono text-slate-900 dark:text-slate-100"
                                    />
                                  </dd>
                                </div>
                              </dl>
                            </div>
                          ) : (
                            <p className="text-xs text-rose-700 dark:text-rose-400">{result.summary.simples.error}</p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Memória de cálculo JSON */}
                    <details className="rounded-md border border-slate-200 bg-slate-50/70 dark:border-[#232C38] dark:bg-[#0C1015]/60">
                      <summary className="cursor-pointer select-none px-4 py-2.5 text-xs font-medium text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100">
                        Inspecionar resposta JSON completa dos motores oficiais
                      </summary>
                      <div className="border-t border-slate-200 p-3 dark:border-[#232C38]">
                        <div className="mb-2 flex justify-end">
                          <CopyButton
                            text={JSON.stringify(
                              { regularRaw: result.regularRaw, simplesRaw: result.simplesRaw },
                              null,
                              2
                            )}
                            label="Copiar JSON"
                          />
                        </div>
                        <pre className="max-h-72 overflow-auto rounded-md bg-slate-900 p-3.5 font-mono text-[11px] leading-relaxed text-slate-200 dark:bg-[#090C10]">
                          {JSON.stringify({ regularRaw: result.regularRaw, simplesRaw: result.simplesRaw }, null, 2)}
                        </pre>
                      </div>
                    </details>
                  </div>
                )}
              </div>
            )}

            {/* ABA 2: XML & XSD */}
            {activeTab === 'xml' && (
              <div className="space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="max-w-lg text-xs text-slate-600 dark:text-slate-400">
                    Gera o grupo XML oficial a partir do cálculo do Regime Regular e valida contra o schema XSD da Receita Federal.
                  </p>
                  <div className="flex items-center gap-2">
                    {groupXml && <CopyButton text={groupXml} label="Copiar XML" />}
                    <button
                      type="button"
                      onClick={handleGenerateAndValidateGroupXml}
                      disabled={xmlLoading}
                      className="rtc-btn-primary h-8 rounded-md px-3 text-xs font-semibold disabled:opacity-60"
                    >
                      {xmlLoading ? 'Validando...' : 'Gerar e validar XML'}
                    </button>
                  </div>
                </div>

                {xmlValidStatus && (
                  <div
                    role="status"
                    className={`flex items-start gap-2 rounded-md border p-3 text-xs ${
                      xmlValidStatus.valid
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200'
                        : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200'
                    }`}
                  >
                    {xmlValidStatus.valid ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
                    ) : (
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden="true" />
                    )}
                    <span>{xmlValidStatus.msg}</span>
                  </div>
                )}

                <label className="sr-only" htmlFor="studio-group-xml">
                  Grupo XML oficial
                </label>
                <textarea
                  id="studio-group-xml"
                  value={groupXml}
                  onChange={(e) => setGroupXml(e.target.value)}
                  rows={16}
                  placeholder="Execute uma simulação e clique em 'Gerar e validar XML'..."
                  className="w-full rounded-md border border-slate-300 bg-slate-900 p-3.5 font-mono text-xs leading-relaxed text-slate-100 placeholder:text-slate-500 focus:border-[#0B4F6C] focus:outline-none dark:border-[#232C38] dark:bg-[#090C10]"
                />
              </div>
            )}

            {/* ABA 3: DANFSe PDF */}
            {activeTab === 'danfse' && (
              <div className="space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300">
                      <span>Situação</span>
                      <select
                        value={danfseStc}
                        onChange={(e) => setDanfseStc(e.target.value as '0' | '1' | '2')}
                        className="rtc-input h-8 rounded-md px-2.5 text-xs"
                      >
                        <option value="0">0 — Válida</option>
                        <option value="1">1 — Substituída</option>
                        <option value="2">2 — Cancelada</option>
                      </select>
                    </label>
                    <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={danfseCanhoto}
                        onChange={(e) => setDanfseCanhoto(e.target.checked)}
                        className="h-3.5 w-3.5 rounded border-slate-300 accent-[#0B4F6C] dark:border-slate-600 dark:accent-[#38A3C7]"
                      />
                      <span>Exibir canhoto</span>
                    </label>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleGenerateDanfse}
                      disabled={danfseLoading}
                      className="rtc-btn-primary h-8 rounded-md px-3 text-xs font-semibold disabled:opacity-60"
                    >
                      {danfseLoading ? 'Renderizando PDF...' : 'Gerar preview DANFSe'}
                    </button>
                    {pdfUrl && (
                      <a
                        href={pdfUrl}
                        download="danfse-rtc-studio.pdf"
                        className="rtc-btn-secondary inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium"
                      >
                        <Download className="h-3.5 w-3.5 text-slate-600 dark:text-slate-300" aria-hidden="true" />
                        <span>Baixar PDF</span>
                      </a>
                    )}
                  </div>
                </div>

                {danfseError && (
                  <div
                    role="alert"
                    className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200"
                  >
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-700 dark:text-rose-400" aria-hidden="true" />
                    <span>{danfseError}</span>
                  </div>
                )}

                <label className="sr-only" htmlFor="studio-danfse-xml">
                  XML da NFS-e nacional
                </label>
                <textarea
                  id="studio-danfse-xml"
                  value={danfseXml}
                  onChange={(e) => setDanfseXml(e.target.value)}
                  rows={7}
                  placeholder="Cole o XML da NFS-e nacional (<NFSe versao='1.00'>...) ou clique em 'Gerar preview DANFSe' para usar um modelo preenchido."
                  className="w-full rounded-md border border-slate-300 bg-slate-900 p-3 font-mono text-[11px] leading-relaxed text-slate-100 placeholder:text-slate-500 focus:border-[#0B4F6C] focus:outline-none dark:border-[#232C38] dark:bg-[#090C10]"
                />

                {pdfUrl && (
                  <iframe
                    title="Preview DANFSe PDF"
                    src={pdfUrl}
                    className="h-[480px] w-full rounded-md border border-slate-200 bg-white dark:border-[#232C38]"
                  />
                )}
              </div>
            )}

            {/* ABA 4: EXPORTAR CÓDIGO */}
            {activeTab === 'code' && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="inline-flex rounded-md border border-slate-200 bg-slate-100 p-0.5 dark:border-[#232C38] dark:bg-[#0C1015]">
                    {(['curl', 'ts', 'python'] as const).map((lang) => (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => setCodeLang(lang)}
                        className={`rounded px-2.5 py-1 font-mono text-xs font-medium transition-colors ${
                          codeLang === lang
                            ? 'bg-white text-slate-900 shadow-xs dark:bg-[#1A222C] dark:text-slate-100 dark:shadow-none'
                            : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                        }`}
                      >
                        {lang === 'curl' ? 'cURL' : lang === 'ts' ? 'TypeScript' : 'Python'}
                      </button>
                    ))}
                  </div>
                  <CopyButton text={codeSnippets[codeLang]} label="Copiar snippet" />
                </div>
                <pre className="max-h-[440px] overflow-auto rounded-md border border-slate-200 bg-slate-900 p-4 font-mono text-xs leading-relaxed text-slate-100 dark:border-[#232C38] dark:bg-[#090C10]">
                  {codeSnippets[codeLang]}
                </pre>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
