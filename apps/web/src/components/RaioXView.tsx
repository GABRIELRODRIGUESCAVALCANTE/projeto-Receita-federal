import { useState, type DragEvent } from 'react';
import type { BatchAnalysisResponse, BatchItemInput } from '@rtc-studio/shared';
import { AlertTriangle, ArrowRight, FileSpreadsheet, Play, RefreshCw, Upload } from 'lucide-react';
import { api } from '../api/client';
import { MetricCell } from './ui/Primitives';

export const DEMO_BATCH_ITEMS: BatchItemInput[] = [
  {
    fileName: 'nfse-001-consultoria-sp.xml',
    numeroNota: '1001',
    uf: 'SP',
    municipio: 3550308,
    dataFatoGerador: '2027-03-15',
    tipoItem: 'servico',
    nbs: '115021000',
    cst: '000',
    cClassTrib: '000001',
    baseCalculo: 15000,
    aliquotaCbs: 8.8,
    aliquotaIbsUf: 0.05,
    aliquotaIbsMun: 0.05,
    pCBSSN: '2.38',
    pIBSSN: '0.03',
    erpCBS: 1320,
    erpIBS: 15,
    erpIS: 0,
  },
  {
    fileName: 'nfse-002-educacao-rs.xml',
    numeroNota: '1002',
    uf: 'RS',
    municipio: 4314902,
    dataFatoGerador: '2027-03-15',
    tipoItem: 'servico',
    nbs: '122011200',
    cst: '200',
    cClassTrib: '200028',
    baseCalculo: 4200,
    aliquotaCbs: 8.8,
    aliquotaIbsUf: 0.05,
    aliquotaIbsMun: 0.05,
    pCBSSN: '2.50',
    pIBSSN: '0.05',
    erpCBS: 210,
    erpIBS: 1.68,
    erpIS: 0,
  },
  {
    fileName: 'nfe-003-comercio-pr.xml',
    numeroNota: '2041',
    uf: 'PR',
    municipio: 4106902,
    dataFatoGerador: '2027-03-15',
    tipoItem: 'bem',
    ncm: '22030000',
    cst: '000',
    cClassTrib: '000001',
    baseCalculo: 8500,
    aliquotaCbs: 8.8,
    aliquotaIbsUf: 0.05,
    aliquotaIbsMun: 0.05,
    pCBSSN: '1.16',
    pIBSSN: '0.01',
    erpCBS: 748,
    erpIBS: 8.5,
    erpIS: 0,
  },
  {
    fileName: 'nfe-004-ncm-incompativel-mg.xml',
    numeroNota: '2042',
    uf: 'MG',
    municipio: 3106200,
    dataFatoGerador: '2027-03-15',
    tipoItem: 'bem',
    ncm: '02013000',
    cst: '200',
    cClassTrib: '200035',
    baseCalculo: 1800,
    aliquotaCbs: 8.8,
    aliquotaIbsUf: 0.05,
    aliquotaIbsMun: 0.05,
    pCBSSN: '1.16',
    pIBSSN: '0.01',
  },
];

const fmtBRL = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });

interface RaioXViewProps {
  batchResult: BatchAnalysisResponse | null;
  onBatchComplete: (res: BatchAnalysisResponse) => void;
  onGoToAuditor: () => void;
}

export function RaioXView({ batchResult, onBatchComplete, onGoToAuditor }: RaioXViewProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const runDemoBatch = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.analyzeBatch({ items: DEMO_BATCH_ITEMS });
      onBatchComplete(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const xmlFiles: Array<{ fileName: string; content: string }> = [];
      let csvContent = '';

      for (const f of Array.from(files)) {
        const text = await f.text();
        if (f.name.toLowerCase().endsWith('.csv')) {
          csvContent = text;
        } else {
          xmlFiles.push({ fileName: f.name, content: text });
        }
      }

      const res = await api.analyzeBatch({
        xmlFiles: xmlFiles.length ? xmlFiles : undefined,
        csvContent: csvContent || undefined,
      });
      onBatchComplete(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    if (!dragging) setDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const maxUfVal = batchResult
    ? Math.max(...batchResult.totais.porUf.map((u) => Math.max(u.regularTotal, u.simplesTotal)), 1)
    : 1;

  const totalNotas = batchResult?.totalNotas || 0;
  const complianceRate = totalNotas > 0 ? ((batchResult?.conformes || 0) / totalNotas) * 100 : 0;
  const okPct = totalNotas > 0 ? ((batchResult?.conformes || 0) / totalNotas) * 100 : 0;
  const divPct = totalNotas > 0 ? ((batchResult?.divergentes || 0) / totalNotas) * 100 : 0;
  const errPct = totalNotas > 0 ? ((batchResult?.comErro || 0) / totalNotas) * 100 : 0;

  const recommendedLabel =
    batchResult?.totais.regimeRecomendado === 'simples'
      ? 'Simples Nacional'
      : batchResult?.totais.regimeRecomendado === 'regular'
        ? 'Regime Regular'
        : 'Empate';

  return (
    <div className="space-y-5">
      {/* Cabeçalho */}
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-end dark:border-[#232C38]">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Raio-X em lote</h1>
          <p className="mt-1 max-w-2xl text-[13px] text-slate-600 dark:text-slate-400">
            Envie arquivos XML (NFS-e ou NF-e) ou uma planilha CSV para comparar Regime Regular e Simples Nacional em paralelo.
          </p>
        </div>

        <button
          type="button"
          onClick={runDemoBatch}
          disabled={loading}
          className="rtc-btn-primary inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md px-3.5 text-xs font-semibold disabled:opacity-60"
        >
          {loading ? (
            <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
          )}
          <span>{loading ? 'Processando lote...' : 'Rodar lote de demonstração (4 notas)'}</span>
        </button>
      </div>

      {/* Área de upload com drag-and-drop real */}
      <label
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed transition-colors ${
          dragging
            ? 'border-[#0B4F6C] bg-[#EDF5F8] dark:border-[#38A3C7] dark:bg-sky-400/10'
            : 'border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50/70 dark:border-[#2E3A49] dark:bg-[#131920] dark:hover:border-[#475569] dark:hover:bg-[#1A222C]/70'
        } ${batchResult ? 'px-5 py-4 sm:flex-row sm:justify-between sm:text-left' : 'px-6 py-12 text-center'}`}
      >
        <div className={`flex items-center gap-3 ${batchResult ? 'flex-row' : 'flex-col'}`}>
          <Upload
            className={`shrink-0 ${
              dragging ? 'text-[#0B4F6C] dark:text-[#5CC2E3]' : 'text-slate-400 dark:text-slate-500'
            } ${batchResult ? 'h-4 w-4' : 'mb-1 h-6 w-6'}`}
            strokeWidth={1.75}
            aria-hidden="true"
          />
          <div>
            <div className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">
              {dragging
                ? 'Solte os arquivos para iniciar a análise'
                : batchResult
                  ? 'Importar novo lote (.xml ou .csv)'
                  : 'Clique para selecionar ou arraste arquivos .xml (NFS-e / NF-e) ou .csv'}
            </div>
            <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Itens com inconsistência fiscal são isolados individualmente sem interromper o restante do lote.
            </div>
          </div>
        </div>

        {batchResult && (
          <span className="rtc-btn-secondary mt-3 inline-flex h-8 shrink-0 items-center rounded-md px-3 text-xs font-medium sm:mt-0">
            Selecionar arquivos
          </span>
        )}

        <input
          type="file"
          multiple
          accept=".xml,.csv"
          onChange={(e) => handleFiles(e.target.files)}
          className="sr-only"
        />
      </label>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-900 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-700 dark:text-rose-400" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {batchResult && (
        <>
          {/* Faixa única de indicadores */}
          <section
            aria-label="Totais do lote"
            className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 shadow-2xs sm:grid-cols-2 lg:grid-cols-4 dark:border-[#232C38] dark:bg-[#232C38] dark:shadow-none"
          >
            <MetricCell
              label={`Base total (${batchResult.totalNotas} notas)`}
              value={fmtBRL(batchResult.totais.baseCalculo)}
              hint={`${batchResult.conformes} conformes, ${batchResult.divergentes} divergentes, ${batchResult.comErro} erros`}
            />
            <MetricCell
              label="Total Regime Regular"
              value={fmtBRL(batchResult.totais.regularTotal)}
              hint="Motor :8080 (CBS + IBS + IS)"
              tone="primary"
            />
            <MetricCell
              label="Total Simples Nacional"
              value={fmtBRL(batchResult.totais.simplesTotal)}
              hint="Motor :8082 (CBS + IBS)"
            />
            <MetricCell
              label={`Economia (${recommendedLabel})`}
              value={fmtBRL(batchResult.totais.economiaEstimada)}
              hint="Menor desembolso direto no lote"
              tone="success"
            />
          </section>

          {/* Comparativo por UF (8) + Conformidade do Lote (4) */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            <section className="rtc-panel rounded-lg p-5 lg:col-span-8">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-[#232C38]">
                <h2 className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">
                  Comparativo tributário por UF
                </h2>
                <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-400">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-xs bg-[#0B4F6C] dark:bg-[#38A3C7]" aria-hidden="true" />
                    Regime Regular
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-xs bg-slate-400 dark:bg-slate-500" aria-hidden="true" />
                    Simples Nacional
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                {batchResult.totais.porUf.map((u) => (
                  <div key={u.uf} className="space-y-1.5">
                    <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
                      <div className="flex items-baseline gap-2">
                        <span className="font-mono text-[13px] font-semibold text-slate-900 dark:text-slate-100">
                          {u.uf}
                        </span>
                        <span className="text-slate-500 dark:text-slate-400">
                          {u.notas} {u.notas === 1 ? 'nota' : 'notas'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 font-mono text-xs tabular-nums">
                        <span className="text-[#0B4F6C] dark:text-[#5CC2E3]">Regular {fmtBRL(u.regularTotal)}</span>
                        <span className="text-slate-300 dark:text-slate-600">|</span>
                        <span className="text-slate-600 dark:text-slate-400">Simples {fmtBRL(u.simplesTotal)}</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-[#1A222C]">
                        <div
                          className="h-full rounded-full bg-[#0B4F6C] transition-[width] duration-300 ease-out dark:bg-[#38A3C7]"
                          style={{
                            width: `${Math.max((u.regularTotal / maxUfVal) * 100, u.regularTotal > 0 ? 2 : 0)}%`,
                          }}
                        />
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-[#1A222C]">
                        <div
                          className="h-full rounded-full bg-slate-400 transition-[width] duration-300 ease-out dark:bg-slate-500"
                          style={{
                            width: `${Math.max((u.simplesTotal / maxUfVal) * 100, u.simplesTotal > 0 ? 2 : 0)}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rtc-panel flex flex-col justify-between rounded-lg p-5 lg:col-span-4">
              <div>
                <h2 className="border-b border-slate-100 pb-3 text-[13px] font-semibold text-slate-900 dark:border-[#232C38] dark:text-slate-100">
                  Conformidade do lote
                </h2>

                <div className="mt-4 flex items-baseline justify-between">
                  <span className="font-mono text-3xl font-semibold tracking-tight text-slate-900 tabular-nums dark:text-slate-100">
                    {complianceRate.toFixed(1)}%
                  </span>
                  <span className="font-mono text-xs text-slate-500 tabular-nums dark:text-slate-400">
                    {batchResult.conformes}/{batchResult.totalNotas} conformes
                  </span>
                </div>

                {/* Barra segmentada proporcional */}
                <div
                  className="mt-3 flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-[#1A222C]"
                  aria-label={`Conformidade: ${batchResult.conformes} conformes, ${batchResult.divergentes} divergentes, ${batchResult.comErro} erros`}
                >
                  {okPct > 0 && <div className="bg-emerald-600 dark:bg-emerald-500" style={{ width: `${okPct}%` }} />}
                  {divPct > 0 && <div className="bg-amber-500 dark:bg-amber-400" style={{ width: `${divPct}%` }} />}
                  {errPct > 0 && <div className="bg-rose-600 dark:bg-rose-500" style={{ width: `${errPct}%` }} />}
                </div>

                <dl className="mt-5 divide-y divide-slate-100 text-xs dark:divide-[#232C38]">
                  <div className="flex items-center justify-between py-2">
                    <dt className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                      <span className="h-2 w-2 rounded-full bg-emerald-600 dark:bg-emerald-500" aria-hidden="true" />
                      Conformes
                    </dt>
                    <dd className="font-mono font-semibold text-slate-900 tabular-nums dark:text-slate-100">
                      {batchResult.conformes}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <dt className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                      <span className="h-2 w-2 rounded-full bg-amber-500 dark:bg-amber-400" aria-hidden="true" />
                      Divergentes (ERP vs. Receita)
                    </dt>
                    <dd className="font-mono font-semibold text-slate-900 tabular-nums dark:text-slate-100">
                      {batchResult.divergentes}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <dt className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                      <span className="h-2 w-2 rounded-full bg-rose-600 dark:bg-rose-500" aria-hidden="true" />
                      Erros fiscais (REG / VSN)
                    </dt>
                    <dd className="font-mono font-semibold text-slate-900 tabular-nums dark:text-slate-100">
                      {batchResult.comErro}
                    </dd>
                  </div>
                </dl>
              </div>

              <button
                type="button"
                onClick={onGoToAuditor}
                className="rtc-btn-secondary mt-5 flex h-9 w-full items-center justify-between rounded-md px-3.5 text-xs font-semibold"
              >
                <span className="inline-flex items-center gap-2">
                  <FileSpreadsheet className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" aria-hidden="true" />
                  Abrir no Auditor Fiscal
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" aria-hidden="true" />
              </button>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
