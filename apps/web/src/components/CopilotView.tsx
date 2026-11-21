import { Fragment, useEffect, useRef, useState } from 'react';
import type { CopilotChatResponse, StudioSimulationRequest } from '@rtc-studio/shared';
import { ExternalLink, FileText, Paperclip, Send, ShieldCheck, Wrench, X } from 'lucide-react';
import { api } from '../api/client';

interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
  attachmentName?: string;
  meta?: CopilotChatResponse;
}

interface CopilotViewProps {
  onOpenInStudio: (seed: StudioSimulationRequest) => void;
  onOpenDanfse: (xml: string) => void;
}

const SUGGESTIONS = [
  'Presto consultoria de TI em Campinas por R$ 15.000 — quanto pago de CBS/IBS no Regular vs. Simples?',
  'Serviço de educação em Porto Alegre no valor de R$ 2.400, qual o imposto com redução de 60%?',
  'O que significa o código de erro REG-011?',
];

/** Formata marcações simples (**negrito** e `código`) sem dependências externas */
function FormattedMessage({ text, inverted = false }: { text: string; inverted?: boolean }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <div className="whitespace-pre-wrap text-[13.5px] leading-relaxed">
      {parts.map((part, idx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={idx} className="font-semibold">
              {part.slice(2, -2)}
            </strong>
          );
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          return (
            <code
              key={idx}
              className={`rounded px-1.5 py-0.5 font-mono text-[12px] ${inverted
                ? 'bg-white/15 text-white'
                : 'border border-slate-200 bg-slate-50 text-slate-800 dark:border-[#2E3A49] dark:bg-[#0C1015] dark:text-slate-200'
                }`}
            >
              {part.slice(1, -1)}
            </code>
          );
        }
        return <Fragment key={idx}>{part}</Fragment>;
      })}
    </div>
  );
}

export function CopilotView({ onOpenInStudio, onOpenDanfse }: CopilotViewProps) {
  const [messages, setMessages] = useState<ChatTurn[]>([
    {
      role: 'assistant',
      content:
        'Olá. Sou o **Copiloto Tributário** do RTC Studio. Descreva uma operação, consulte um código (`REG-*` ou `VSN-*`) ou anexe um XML — todos os cálculos são executados diretamente nos motores oficiais da Receita Federal.',
    },
  ]);
  const [input, setInput] = useState('');
  const [attachedXml, setAttachedXml] = useState<string | null>(null);
  const [attachedName, setAttachedName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, loading]);

  const sendMessage = async (textOverride?: string) => {
    const text = (textOverride ?? input).trim();
    if (!text || loading) return;

    const currentAttachmentName = attachedName || undefined;
    const currentAttachmentXml = attachedXml || undefined;

    setMessages((prev) => [
      ...prev,
      { role: 'user', content: text, attachmentName: currentAttachmentName },
    ]);
    setInput('');
    setLoading(true);

    try {
      const res = await api.chatCopilot({
        message: text,
        attachedXml: currentAttachmentXml,
      });
      setAttachedXml(null);
      setAttachedName(null);
      setMessages((prev) => [...prev, { role: 'assistant', content: res.reply, meta: res }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Não foi possível consultar o Copiloto: ${err instanceof Error ? err.message : String(err)}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rtc-panel flex h-[calc(100dvh-10.25rem)] min-h-[480px] flex-col overflow-hidden rounded-lg lg:h-[calc(100dvh-7rem)]">
      {/* Cabeçalho do Copiloto */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-3.5 dark:border-[#232C38] dark:bg-[#131920]">
        <div>
          <h1 className="text-base font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Copiloto tributário
          </h1>
          <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
            Consultas em linguagem natural com execução auditável nas APIs oficiais da Receita Federal.
          </p>
        </div>

        <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          Cálculo determinístico
        </span>
      </div>

      {/* Histórico de mensagens */}
      <div className="flex-1 space-y-4 overflow-y-auto overscroll-contain bg-[#FAFBFD] p-4 sm:p-5 dark:bg-[#0C1015]">
        {messages.map((m, i) => {
          const isUser = m.role === 'user';
          return (
            <div key={i} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-3xl space-y-3 rounded-lg px-4 py-3 ${isUser
                  ? 'bg-[#0B4F6C] text-white dark:bg-[#147299]'
                  : 'border border-slate-200 bg-white text-slate-800 shadow-2xs dark:border-[#232C38] dark:bg-[#131920] dark:text-slate-200 dark:shadow-none'
                  }`}
              >
                <FormattedMessage text={m.content} inverted={isUser} />

                {m.attachmentName && (
                  <div
                    className={`inline-flex items-center gap-1.5 rounded px-2 py-1 font-mono text-[11px] ${isUser
                      ? 'bg-white/15 text-white'
                      : 'bg-slate-100 text-slate-700 dark:bg-[#1A222C] dark:text-slate-300'
                      }`}
                  >
                    <Paperclip className="h-3 w-3" aria-hidden="true" />
                    <span>{m.attachmentName}</span>
                  </div>
                )}

                {m.meta && (
                  <div className="space-y-2.5 border-t border-slate-200 pt-3 text-xs dark:border-[#232C38]">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono dark:border-[#2E3A49] dark:bg-[#0C1015]">
                        {m.meta.provider} / {m.meta.model}
                      </span>
                    </div>

                    {m.meta.toolCalls.length > 0 && (
                      <details className="rounded-md border border-slate-200 bg-slate-50/80 dark:border-[#232C38] dark:bg-[#0C1015]/80">
                        <summary className="flex cursor-pointer select-none items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100">
                          <Wrench className="h-3.5 w-3.5 text-[#0B4F6C] dark:text-[#5CC2E3]" aria-hidden="true" />
                          <span>Auditoria: {m.meta.toolCalls.length} chamada(s) aos motores oficiais</span>
                        </summary>
                        <div className="space-y-2 border-t border-slate-200 p-2.5 font-mono text-[11px] dark:border-[#232C38]">
                          {m.meta.toolCalls.map((tc, ti) => (
                            <div
                              key={ti}
                              className="rounded border border-slate-200 bg-white p-2.5 dark:border-[#232C38] dark:bg-[#131920]"
                            >
                              <div className="font-semibold text-[#0B4F6C] dark:text-[#5CC2E3]">{tc.tool}</div>
                              <div className="mt-1 break-all text-slate-600 dark:text-slate-400">
                                Entrada: {JSON.stringify(tc.input)}
                              </div>
                              <div className="mt-1 text-emerald-800 dark:text-emerald-400">
                                Retorno: {tc.outputSummary}
                              </div>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}

                    {m.meta.legalBasis && m.meta.legalBasis.length > 0 && (
                      <div className="rounded-md border border-slate-200 border-l-2 border-l-amber-600 bg-amber-50/50 px-3 py-2 text-[11px] text-slate-700 dark:border-[#232C38] dark:border-l-amber-500 dark:bg-amber-500/10 dark:text-slate-300">
                        <span className="font-semibold text-slate-900 dark:text-slate-100">Fundamentação legal: </span>
                        {m.meta.legalBasis.map((lb) => `[${lb.code}] ${lb.description}`).join('; ')}
                      </div>
                    )}

                    {(m.meta.simulationResult?.regularPayload || m.meta.danfseSampleXml) && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {m.meta.simulationResult?.regularPayload && (
                          <button
                            type="button"
                            onClick={() => {
                              const p = m.meta!.simulationResult!.regularPayload!;
                              const it = p.itens[0];
                              onOpenInStudio({
                                titulo: m.meta!.simulationResult!.titulo,
                                mode: 'both',
                                dataFatoGerador: p.dhFatoGerador.slice(0, 10),
                                uf: p.uf,
                                municipio: p.municipio,
                                tpDoc: '55',
                                CRT: '1',
                                itens: [
                                  {
                                    numero: 1,
                                    descricao: 'Cenário importado do Copiloto',
                                    tipoItem: it.ncm ? 'bem' : 'servico',
                                    ncm: it.ncm,
                                    nbs: it.nbs,
                                    cst: it.cst,
                                    cClassTrib: it.cClassTrib,
                                    baseCalculo: it.baseCalculo || 1000,
                                    aliquotaCbs: it.aliquotasNominais?.cbs ?? 8.8,
                                    aliquotaIbsUf: it.aliquotasNominais?.ibsEstadual ?? 0.05,
                                    aliquotaIbsMun: it.aliquotasNominais?.ibsMunicipal ?? 0.05,
                                    cAtivSN: '01',
                                    pCBSSN: '2.50',
                                    pIBSSN: '0.05',
                                  },
                                ],
                              });
                            }}
                            className="rtc-btn-secondary inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium"
                          >
                            <ExternalLink className="h-3.5 w-3.5 text-[#0B4F6C] dark:text-[#5CC2E3]" aria-hidden="true" />
                            <span>Abrir no Estúdio</span>
                          </button>
                        )}

                        {m.meta.danfseSampleXml && (
                          <button
                            type="button"
                            onClick={() => onOpenDanfse(m.meta!.danfseSampleXml!)}
                            className="rtc-btn-secondary inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium"
                          >
                            <FileText className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
                            <span>Gerar DANFSe PDF</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex justify-start" role="status" aria-live="polite">
            <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-600 dark:border-[#232C38] dark:bg-[#131920] dark:text-slate-300">
              <span>Consultando motores oficiais</span>
              <span className="flex items-center gap-1" aria-hidden="true">
                <span className="rtc-typing-dot h-1.5 w-1.5 rounded-full bg-[#0B4F6C] dark:bg-[#5CC2E3]" />
                <span className="rtc-typing-dot h-1.5 w-1.5 rounded-full bg-[#0B4F6C] dark:bg-[#5CC2E3]" />
                <span className="rtc-typing-dot h-1.5 w-1.5 rounded-full bg-[#0B4F6C] dark:bg-[#5CC2E3]" />
              </span>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Sugestões rápidas */}
      <div className="flex flex-wrap gap-1.5 border-t border-slate-200 bg-slate-50/70 px-4 py-2.5 sm:px-5 dark:border-[#232C38] dark:bg-[#131920]">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => sendMessage(s)}
            disabled={loading}
            className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-left text-[11px] text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 dark:border-[#232C38] dark:bg-[#1A222C] dark:text-slate-300 dark:hover:border-[#334155] dark:hover:text-slate-100"
          >
            {s}
          </button>
        ))}
      </div>

      {/* Barra de entrada */}
      <div className="space-y-2 border-t border-slate-200 bg-white p-3.5 sm:px-5 sm:py-4 dark:border-[#232C38] dark:bg-[#131920]">
        {attachedName && (
          <div className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700 dark:border-[#2E3A49] dark:bg-[#1A222C] dark:text-slate-200">
            <Paperclip className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" aria-hidden="true" />
            <span className="font-mono text-[11px]">{attachedName}</span>
            <button
              type="button"
              aria-label={`Remover anexo ${attachedName}`}
              onClick={() => {
                setAttachedName(null);
                setAttachedXml(null);
              }}
              className="rounded p-0.5 text-slate-500 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-[#232C38] dark:hover:text-slate-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
          <label
            aria-label="Anexar arquivo XML"
            title="Anexar XML"
            className="rtc-btn-secondary inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-md text-slate-600 dark:text-slate-300"
          >
            <Paperclip className="h-4 w-4" aria-hidden="true" />
            <input
              type="file"
              accept=".xml"
              className="sr-only"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setAttachedName(f.name);
                setAttachedXml(await f.text());
                e.target.value = '';
              }}
            />
          </label>

          <label htmlFor="copilot-input" className="sr-only">
            Mensagem para o Copiloto Tributário
          </label>
          <input
            id="copilot-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Descreva uma operação (ex.: serviço em SP de R$ 10.000) ou digite um código REG-/VSN-..."
            className="rtc-input h-10 flex-1 rounded-md px-3.5 text-[13.5px]"
          />

          <button
            type="button"
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            className="rtc-btn-primary inline-flex h-10 shrink-0 items-center gap-1.5 rounded-md px-4 text-[13px] font-semibold disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Enviar</span>
          </button>
        </div>
      </div>
    </div>
  );
}
