import { useState } from 'react';
import type { BatchAnalysisResponse, StudioSimulationRequest } from '@rtc-studio/shared';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Play,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import { api } from '../api/client';
import { DEMO_BATCH_ITEMS } from './RaioXView';
import { SegmentedTabs } from './ui/Primitives';

const fmtBRL = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });

interface AuditorViewProps {
  batchResult: BatchAnalysisResponse | null;
  onBatchComplete: (res: BatchAnalysisResponse) => void;
  onOpenInStudio: (seed: StudioSimulationRequest) => void;
}

export function AuditorView({ batchResult, onBatchComplete, onOpenInStudio }: AuditorViewProps) {
  const [filter, setFilter] = useState<'all' | 'conforme' | 'divergente' | 'erro'>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runDemo = async () => {
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

  const filteredItems = (batchResult?.itens || []).filter((item) =>
    filter === 'all' ? true : item.status === filter
  );

  return (
    <div className="space-y-5">
      {/* Cabeçalho */}
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-end dark:border-[#232C38]">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Auditor fiscal</h1>
          <p className="mt-1 max-w-2xl text-[13px] text-slate-600 dark:text-slate-400">
            Concilie os tributos declarados pelo ERP contra o cálculo oficial da Receita Federal e inspecione diagnósticos REG-* e VSN-*.
          </p>
        </div>

        {!batchResult && (
          <button
            type="button"
            onClick={runDemo}
            disabled={loading}
            className="rtc-btn-primary inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md px-3.5 text-xs font-semibold disabled:opacity-60"
          >
            {loading ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
            )}
            <span>{loading ? 'Auditando lote...' : 'Executar auditoria de demonstração'}</span>
          </button>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-900 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-700 dark:text-rose-400" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {!batchResult ? (
        <div className="rtc-panel flex min-h-[280px] flex-col items-center justify-center rounded-lg border-dashed px-6 py-12 text-center">
          <ShieldAlert className="mb-3 h-7 w-7 text-slate-400 dark:text-slate-500" strokeWidth={1.5} aria-hidden="true" />
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Nenhum lote auditado</p>
          <p className="mt-1 max-w-md text-xs text-slate-600 dark:text-slate-400">
            Envie notas fiscais no módulo Raio-X em Lote ou execute o lote de demonstração para inspecionar divergências e códigos de erro.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Filtros e contagem */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SegmentedTabs
              ariaLabel="Filtrar notas por status"
              active={filter}
              onChange={setFilter}
              items={[
                { id: 'all', label: 'Todas', badge: batchResult.totalNotas },
                { id: 'conforme', label: 'Conformes', badge: batchResult.conformes },
                { id: 'divergente', label: 'Divergentes', badge: batchResult.divergentes },
                { id: 'erro', label: 'Erros REG/VSN', badge: batchResult.comErro },
              ]}
            />

            <span className="text-xs text-slate-500 tabular-nums dark:text-slate-400">
              Exibindo {filteredItems.length} de {batchResult.totalNotas} notas
            </span>
          </div>

          {/* Tabela de conciliação */}
          <div className="rtc-panel overflow-hidden rounded-lg">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600 dark:border-[#232C38] dark:bg-[#1A222C] dark:text-slate-300">
                    <th scope="col" className="px-4 py-3">
                      Nota / Arquivo
                    </th>
                    <th scope="col" className="px-3 py-3">
                      UF
                    </th>
                    <th scope="col" className="px-3 py-3">
                      Status
                    </th>
                    <th scope="col" className="px-3 py-3 text-right">
                      ERP declarado
                    </th>
                    <th scope="col" className="px-3 py-3 text-right">
                      Receita (Regular)
                    </th>
                    <th scope="col" className="px-3 py-3 text-right">
                      Diferença
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Diagnóstico oficial
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      Ação
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/80 bg-white dark:divide-[#232C38] dark:bg-[#131920]">
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-xs text-slate-500 dark:text-slate-400">
                        Nenhuma nota corresponde ao filtro selecionado.
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((row, idx) => (
                      <tr
                        key={`${row.fileName}-${idx}`}
                        className="transition-colors duration-100 hover:bg-slate-50/90 dark:hover:bg-[#1A222C]/70"
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900 dark:text-slate-100">{row.fileName}</div>
                          <div className="mt-0.5 font-mono text-[11px] text-slate-500 tabular-nums dark:text-slate-400">
                            Base {fmtBRL(row.baseCalculo)}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[11px] font-medium text-slate-700 dark:border-[#2E3A49] dark:bg-[#0C1015] dark:text-slate-300">
                            {row.uf}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          {row.status === 'conforme' && (
                            <span className="inline-flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                              <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                              Conforme
                            </span>
                          )}
                          {row.status === 'divergente' && (
                            <span className="inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                              <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                              Divergente
                            </span>
                          )}
                          {row.status === 'erro' && (
                            <span className="inline-flex items-center gap-1 rounded border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
                              <ShieldAlert className="h-3 w-3" aria-hidden="true" />
                              Erro fiscal
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-slate-700 tabular-nums dark:text-slate-300">
                          {row.erpDeclarado ? fmtBRL(row.erpDeclarado.total) : '—'}
                        </td>
                        <td className="px-3 py-3 text-right font-mono font-semibold text-slate-900 tabular-nums dark:text-slate-100">
                          {row.regular.available ? fmtBRL(row.regular.totalTributos) : 'N/D'}
                        </td>
                        <td className="px-3 py-3 text-right font-mono tabular-nums">
                          {row.diff ? (
                            <span
                              className={`inline-block rounded px-1.5 py-0.5 font-semibold ${
                                Math.abs(row.diff.total) >= 0.01
                                  ? 'bg-amber-50 text-amber-900 dark:bg-amber-500/15 dark:text-amber-300'
                                  : 'text-emerald-700 dark:text-emerald-400'
                              }`}
                            >
                              {row.diff.total > 0 ? '+' : ''}
                              {fmtBRL(row.diff.total)}
                            </span>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-500">—</span>
                          )}
                        </td>
                        <td className="max-w-xs px-4 py-3">
                          {row.errorCodes.length > 0 ? (
                            <div className="space-y-1">
                              {row.errorCodes.map((e, ei) => (
                                <div
                                  key={ei}
                                  className="rounded border border-rose-200 bg-rose-50/70 px-2 py-1 text-[11px] text-rose-900 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200"
                                >
                                  <span className="font-mono font-semibold text-rose-800 dark:text-rose-300">
                                    {e.code}
                                  </span>
                                  <span className="mx-1 text-rose-300 dark:text-rose-500">:</span>
                                  <span>{e.title}</span>
                                </div>
                              ))}
                            </div>
                          ) : row.diff && Math.abs(row.diff.total) >= 0.01 ? (
                            <span className="font-mono text-[11px] text-amber-900 tabular-nums dark:text-amber-300">
                              Δ CBS {fmtBRL(row.diff.cbs)} | Δ IBS {fmtBRL(row.diff.ibs)}
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">
                              Validado sem divergências
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => onOpenInStudio(row.studioSeed)}
                            className="rtc-btn-secondary inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[11px] font-medium"
                          >
                            <span>Abrir no Estúdio</span>
                            <ExternalLink className="h-3 w-3 text-slate-500 dark:text-slate-400" aria-hidden="true" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
