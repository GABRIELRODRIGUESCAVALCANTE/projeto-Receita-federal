import { useCallback, useEffect, useState } from 'react';
import type {
  BatchAnalysisResponse,
  StudioSimulationRequest,
  SystemHealthResponse,
} from '@rtc-studio/shared';
import {
  AlertTriangle,
  BarChart3,
  ExternalLink,
  MessageSquareText,
  Moon,
  RefreshCw,
  Scale,
  ShieldCheck,
  Sun,
} from 'lucide-react';
import { api } from './api/client';
import { AuditorView } from './components/AuditorView';
import { CopilotView } from './components/CopilotView';
import { RaioXView } from './components/RaioXView';
import { StudioView } from './components/StudioView';
import { StatusDot } from './components/ui/Primitives';

type ModuleId = 'studio' | 'raiox' | 'auditor' | 'copilot';

interface NavItem {
  id: ModuleId;
  label: string;
  shortLabel: string;
  description: string;
  icon: typeof Scale;
  badge?: number;
}

export function App() {
  const [activeModule, setActiveModule] = useState<ModuleId>('studio');
  const [health, setHealth] = useState<SystemHealthResponse | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [isDark, setIsDark] = useState<boolean>(() =>
    typeof document !== 'undefined' ? document.documentElement.classList.contains('dark') : false
  );

  // Estado compartilhado entre os 4 módulos
  const [batchResult, setBatchResult] = useState<BatchAnalysisResponse | null>(null);
  const [studioSeed, setStudioSeed] = useState<StudioSimulationRequest | null>(null);
  const [danfseXmlSeed, setDanfseXmlSeed] = useState<string | null>(null);

  const toggleTheme = useCallback(() => {
    const root = document.documentElement;
    const nextDark = !isDark;

    root.classList.add('rtc-theme-switching');
    root.classList.toggle('dark', nextDark);
    void root.offsetHeight;
    requestAnimationFrame(() => {
      root.classList.remove('rtc-theme-switching');
    });

    setIsDark(nextDark);
    try {
      localStorage.setItem('rtc-theme', nextDark ? 'dark' : 'light');
    } catch {
      // ignore storage errors
    }
  }, [isDark]);

  const refreshHealth = useCallback(async () => {
    setHealthLoading(true);
    try {
      const h = await api.getHealth();
      setHealth(h);
    } catch {
      setHealth(null);
    } finally {
      setHealthLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshHealth();
    const id = setInterval(refreshHealth, 30_000);
    return () => clearInterval(id);
  }, [refreshHealth]);

  const auditAlerts = batchResult ? batchResult.divergentes + batchResult.comErro : 0;

  const navItems: NavItem[] = [
    {
      id: 'studio',
      label: 'Estúdio Interativo',
      shortLabel: 'Estúdio',
      description: 'Simulação comparativa, XML e DANFSe',
      icon: Scale,
    },
    {
      id: 'raiox',
      label: 'Raio-X em Lote',
      shortLabel: 'Raio-X',
      description: 'Análise comparativa de XMLs e CSV',
      icon: BarChart3,
    },
    {
      id: 'auditor',
      label: 'Auditor Fiscal',
      shortLabel: 'Auditor',
      description: 'Conciliação ERP contra motores oficiais',
      icon: ShieldCheck,
      badge: auditAlerts > 0 ? auditAlerts : undefined,
    },
    {
      id: 'copilot',
      label: 'Copiloto Tributário',
      shortLabel: 'Copiloto',
      description: 'Consultas determinísticas via APIs oficiais',
      icon: MessageSquareText,
    },
  ];

  const currentNav = navItems.find((n) => n.id === activeModule) ?? navItems[0];
  const engines = health ? Object.values(health.engines) : [];
  const onlineCount = engines.filter((e) => e.status === 'online').length;
  const clusterStatus: 'online' | 'degraded' | 'offline' =
    !health || onlineCount === 0 ? 'offline' : onlineCount === engines.length ? 'online' : 'degraded';

  return (
    <div className="flex min-h-dvh bg-[#F6F7F9] text-slate-900 dark:bg-[#0C1015] dark:text-slate-100">
      {/* Sidebar Desktop */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex dark:border-[#232C38] dark:bg-[#131920]">
        {/* Identidade institucional */}
        <div className="flex h-14 items-center gap-2.5 border-b border-slate-200 px-4 dark:border-[#232C38]">
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#0B4F6C] font-mono text-[11px] font-semibold tracking-tight text-white dark:bg-[#147299]"
            aria-hidden="true"
          >
            RT
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                RTC Studio
              </span>
              <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] font-medium text-slate-600 dark:border-[#2E3A49] dark:bg-[#1A222C] dark:text-slate-300">
                LC 214
              </span>
            </div>
          </div>
        </div>

        {/* Navegação principal */}
        <nav aria-label="Módulos principais" className="flex-1 space-y-1 p-3">
          <div className="px-2.5 pb-1.5 pt-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Módulos
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeModule === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveModule(item.id)}
                aria-current={active ? 'page' : undefined}
                className={`group relative flex min-h-[40px] w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] transition-colors duration-150 ${
                  active
                    ? 'bg-[#EDF5F8] font-semibold text-[#0B4F6C] dark:bg-sky-400/10 dark:text-[#5CC2E3]'
                    : 'font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-[#1A222C] dark:hover:text-slate-100'
                }`}
              >
                {active && (
                  <span
                    className="absolute inset-y-1.5 left-0 w-0.5 rounded-r bg-[#0B4F6C] dark:bg-[#38A3C7]"
                    aria-hidden="true"
                  />
                )}
                <Icon
                  className={`h-4 w-4 shrink-0 ${
                    active
                      ? 'text-[#0B4F6C] dark:text-[#5CC2E3]'
                      : 'text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300'
                  }`}
                  strokeWidth={active ? 2 : 1.75}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.badge !== undefined && (
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-amber-800 tabular-nums dark:bg-amber-500/15 dark:text-amber-300">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Estado dos motores da Receita Federal */}
        <div className="border-t border-slate-200 p-3.5 dark:border-[#232C38]">
          <div className="mb-2.5 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Motores Receita Federal
            </span>
            <button
              type="button"
              onClick={refreshHealth}
              disabled={healthLoading}
              aria-label="Atualizar status dos motores"
              title="Atualizar status"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-[#1A222C] dark:hover:text-slate-100"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${healthLoading ? 'animate-spin text-[#0B4F6C] dark:text-[#5CC2E3]' : ''}`}
              />
            </button>
          </div>

          {engines.length === 0 ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
              API local (<code className="font-mono">:3001</code>) indisponível
            </div>
          ) : (
            <ul className="space-y-1.5">
              {engines.map((eng) => {
                const isOnline = eng.status === 'online';
                return (
                  <li
                    key={eng.name}
                    className="flex items-center justify-between gap-2 rounded-md border border-slate-200/80 bg-slate-50/70 px-2.5 py-1.5 text-xs dark:border-[#232C38] dark:bg-[#0C1015]/70"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <StatusDot status={eng.status} label={isOnline ? 'Online' : 'Offline'} />
                      <div className="min-w-0">
                        <div className="truncate text-[11px] font-medium text-slate-800 dark:text-slate-200">
                          {eng.label.split(' (')[0]}
                        </div>
                        {eng.version && (
                          <div className="font-mono text-[10px] text-slate-500 tabular-nums dark:text-slate-400">
                            v{eng.version}
                          </div>
                        )}
                      </div>
                    </div>
                    <span
                      className={`shrink-0 font-mono text-[10px] font-medium tabular-nums ${
                        isOnline ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'
                      }`}
                    >
                      {isOnline ? `${eng.latencyMs}ms` : 'offline'}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-[11px] text-slate-500 dark:border-[#232C38] dark:text-slate-400">
            <span>Licença MIT</span>
            <a
              href="http://localhost:8080/api/swagger-ui.html"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-medium text-slate-600 hover:text-[#0B4F6C] dark:text-slate-400 dark:hover:text-[#5CC2E3]"
            >
              <span>Swagger</span>
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          </div>
        </div>
      </aside>

      {/* Coluna Principal */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Barra Superior */}
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white dark:border-[#232C38] dark:bg-[#131920]">
          <div className="flex h-14 items-center justify-between gap-4 px-4 sm:px-6">
            {/* Identidade Mobile + Contexto Desktop */}
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex items-center gap-2 lg:hidden">
                <div
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#0B4F6C] font-mono text-[11px] font-semibold text-white dark:bg-[#147299]"
                  aria-hidden="true"
                >
                  RT
                </div>
                <span className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                  RTC Studio
                </span>
              </div>

              <div className="hidden items-center gap-2 text-xs text-slate-500 lg:flex dark:text-slate-400">
                <span className="font-medium text-slate-900 dark:text-slate-100">{currentNav.label}</span>
                <span className="text-slate-300 dark:text-slate-600">/</span>
                <span>{currentNav.description}</span>
              </div>
            </div>

            {/* Indicador de conectividade + Botão de tema */}
            <div className="flex shrink-0 items-center gap-2">
              {health && health.status !== 'ok' ? (
                <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden="true" />
                  <span className="hidden sm:inline">
                    Motores parciais ({onlineCount}/3) — execute{' '}
                    <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-[11px] dark:bg-amber-500/20">
                      docker compose up -d --build
                    </code>
                  </span>
                  <span className="font-mono tabular-nums sm:hidden">{onlineCount}/3 ativos</span>
                </div>
              ) : health ? (
                <div className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700 dark:border-[#232C38] dark:bg-[#1A222C] dark:text-slate-200">
                  <StatusDot status={clusterStatus} />
                  <span className="font-mono text-[11px] font-medium tabular-nums">{onlineCount}/3</span>
                  <span className="hidden text-slate-600 sm:inline dark:text-slate-400">motores conectados</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
                  <StatusDot status="offline" />
                  <span>API local offline</span>
                </div>
              )}

              <button
                type="button"
                onClick={toggleTheme}
                aria-label={isDark ? 'Ativar tema claro' : 'Ativar tema escuro'}
                title={isDark ? 'Tema claro' : 'Tema escuro'}
                className="rtc-btn-secondary inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-600 dark:text-slate-300"
              >
                {isDark ? (
                  <Sun className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Moon className="h-4 w-4" aria-hidden="true" />
                )}
              </button>

              <button
                type="button"
                onClick={refreshHealth}
                disabled={healthLoading}
                aria-label="Verificar status dos motores"
                className="rtc-btn-secondary inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-600 lg:hidden dark:text-slate-300"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${healthLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Navegação Mobile */}
          <nav
            aria-label="Módulos (navegação móvel)"
            className="flex gap-1 overflow-x-auto border-t border-slate-100 px-3 py-1.5 lg:hidden dark:border-[#232C38]"
          >
            {navItems.map((n) => {
              const Icon = n.icon;
              const active = activeModule === n.id;
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => setActiveModule(n.id)}
                  aria-current={active ? 'page' : undefined}
                  className={`inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    active
                      ? 'bg-[#EDF5F8] font-semibold text-[#0B4F6C] dark:bg-sky-400/10 dark:text-[#5CC2E3]'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-[#1A222C]'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{n.shortLabel}</span>
                  {n.badge !== undefined && (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-amber-800 tabular-nums dark:bg-amber-500/15 dark:text-amber-300">
                      {n.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </header>

        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-5 sm:px-6 sm:py-6">
          {activeModule === 'studio' && (
            <StudioView
              externalSeed={studioSeed}
              externalDanfseXml={danfseXmlSeed}
              onClearExternalSeed={() => {
                setStudioSeed(null);
                setDanfseXmlSeed(null);
              }}
            />
          )}
          {activeModule === 'raiox' && (
            <RaioXView
              batchResult={batchResult}
              onBatchComplete={setBatchResult}
              onGoToAuditor={() => setActiveModule('auditor')}
            />
          )}
          {activeModule === 'auditor' && (
            <AuditorView
              batchResult={batchResult}
              onBatchComplete={setBatchResult}
              onOpenInStudio={(seed) => {
                setStudioSeed(seed);
                setActiveModule('studio');
              }}
            />
          )}
          {activeModule === 'copilot' && (
            <CopilotView
              onOpenInStudio={(seed) => {
                setStudioSeed(seed);
                setActiveModule('studio');
              }}
              onOpenDanfse={(xml) => {
                setDanfseXmlSeed(xml);
                setActiveModule('studio');
              }}
            />
          )}
        </main>
      </div>
    </div>
  );
}
