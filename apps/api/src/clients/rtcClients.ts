import type {
  EngineHealthStatus,
  EngineName,
  OperacaoRegimeRegularInput,
  OperacaoSimplesInput,
  RegimeRegularResponse,
  SimplesNacionalResponse,
  SystemHealthResponse,
} from '@rtc-studio/shared';

export interface RtcEnginesConfig {
  regimeRegularUrl: string;
  regimeRegularHealthUrl: string;
  simplesNacionalUrl: string;
  simplesNacionalHealthUrl: string;
  geradorDanfseUrl: string;
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class RtcClients {
  private cache = new Map<string, CacheEntry<unknown>>();
  private defaultTimeoutMs = 15_000;

  constructor(private cfg: RtcEnginesConfig) {}

  private async cached<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const existing = this.cache.get(key);
    if (existing && existing.expiresAt > now) {
      return existing.value as T;
    }
    const value = await loader();
    this.cache.set(key, { value, expiresAt: now + ttlMs });
    return value;
  }

  private async fetchJson<T>(url: string, init?: RequestInit, timeoutMs = this.defaultTimeoutMs): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      const text = await response.text();
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} em ${url}: ${text.slice(0, 400)}`);
      }
      return text ? (JSON.parse(text) as T) : ({} as T);
    } finally {
      clearTimeout(timer);
    }
  }

  private async checkEngine(
    name: EngineName,
    label: string,
    healthUrl: string,
    displayUrl: string,
    versionUrl?: string
  ): Promise<EngineHealthStatus> {
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3500);
      const res = await fetch(healthUrl, { signal: controller.signal });
      clearTimeout(timer);
      const latencyMs = Date.now() - start;

      if (!res.ok) {
        return { name, label, url: displayUrl, status: 'degraded', latencyMs, error: `HTTP ${res.status}` };
      }

      let version: string | undefined;
      if (versionUrl) {
        try {
          const v = await this.fetchJson<Record<string, unknown>>(versionUrl, undefined, 2500);
          version = String(v.versaoApp || v.versao || v.version || '');
        } catch {
          // Version lookup is best-effort
        }
      }

      return { name, label, url: displayUrl, status: 'online', latencyMs, version: version || undefined };
    } catch (err) {
      return {
        name,
        label,
        url: displayUrl,
        status: 'offline',
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async checkSystemHealth(): Promise<SystemHealthResponse> {
    const [regimeRegular, simplesNacional, geradorDanfse] = await Promise.all([
      this.checkEngine(
        'regimeRegular',
        'Regime Regular (Java 25)',
        this.cfg.regimeRegularHealthUrl,
        this.cfg.regimeRegularUrl,
        `${this.cfg.regimeRegularUrl}/calculadora/dados-abertos/versao`
      ),
      this.checkEngine(
        'simplesNacional',
        'Simples Nacional (Java 25)',
        this.cfg.simplesNacionalHealthUrl,
        this.cfg.simplesNacionalUrl,
        `${this.cfg.simplesNacionalUrl}/versao`
      ),
      this.checkEngine(
        'geradorDanfse',
        'Gerador DANFSe (Go 1.27)',
        `${this.cfg.geradorDanfseUrl}/health/ready`,
        this.cfg.geradorDanfseUrl
      ),
    ]);

    const states = [regimeRegular.status, simplesNacional.status, geradorDanfse.status];
    const onlineCount = states.filter((s) => s === 'online').length;
    const status = onlineCount === 3 ? 'ok' : onlineCount > 0 ? 'partial' : 'degraded';

    return {
      status,
      checkedAt: new Date().toISOString(),
      engines: { regimeRegular, simplesNacional, geradorDanfse },
    };
  }

  // ---------- Regime Regular ----------

  async calculateRegimeRegular(payload: OperacaoRegimeRegularInput): Promise<RegimeRegularResponse> {
    return this.fetchJson<RegimeRegularResponse>(
      `${this.cfg.regimeRegularUrl}/calculadora/observabilidade/regime-geral`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );
  }

  async calculateRegimeRegularStrict(payload: OperacaoRegimeRegularInput): Promise<RegimeRegularResponse> {
    return this.fetchJson<RegimeRegularResponse>(`${this.cfg.regimeRegularUrl}/calculadora/regime-geral`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  async getRegimeRegularError(codigo: string): Promise<Record<string, unknown>> {
    return this.cached(`err:reg:${codigo}`, 60 * 60 * 1000, () =>
      this.fetchJson<Record<string, unknown>>(
        `${this.cfg.regimeRegularUrl}/calculadora/observabilidade/erros?codigo=${encodeURIComponent(codigo)}`
      )
    );
  }

  async generateXmlFromRoc(roc: unknown, tipo = 'nfe'): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.defaultTimeoutMs);
    try {
      const response = await fetch(
        `${this.cfg.regimeRegularUrl}/calculadora/xml/generate?tipo=${encodeURIComponent(tipo)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/xml' },
          body: JSON.stringify(roc),
          signal: controller.signal,
        }
      );
      const text = await response.text();
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ao gerar XML: ${text.slice(0, 400)}`);
      }
      return text;
    } finally {
      clearTimeout(timer);
    }
  }

  async validateXml(xml: string, tipo = 'nfe', subtipo = 'grupo'): Promise<boolean> {
    return this.fetchJson<boolean>(
      `${this.cfg.regimeRegularUrl}/calculadora/xml/validate?tipo=${encodeURIComponent(tipo)}&subtipo=${encodeURIComponent(subtipo)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/xml', Accept: 'application/json' },
        body: xml,
      }
    );
  }

  async getUfs(): Promise<Array<Record<string, unknown>>> {
    return this.cached('da:ufs', 60 * 60 * 1000, () =>
      this.fetchJson<Array<Record<string, unknown>>>(`${this.cfg.regimeRegularUrl}/calculadora/dados-abertos/ufs`)
    );
  }

  async getMunicipios(siglaUf: string): Promise<Array<Record<string, unknown>>> {
    const uf = siglaUf.toUpperCase();
    return this.cached(`da:mun:${uf}`, 60 * 60 * 1000, () =>
      this.fetchJson<Array<Record<string, unknown>>>(
        `${this.cfg.regimeRegularUrl}/calculadora/dados-abertos/ufs/municipios?siglaUf=${encodeURIComponent(uf)}`
      )
    );
  }

  async getClassificacoesCbsIbs(data: string): Promise<Array<Record<string, unknown>>> {
    return this.cached(`da:class:${data}`, 30 * 60 * 1000, () =>
      this.fetchJson<Array<Record<string, unknown>>>(
        `${this.cfg.regimeRegularUrl}/calculadora/dados-abertos/classificacoes-tributarias/cbs-ibs?data=${encodeURIComponent(data)}`
      )
    );
  }

  async getNcmsVigentes(data: string): Promise<Array<Record<string, unknown>>> {
    return this.cached(`da:ncms:${data}`, 30 * 60 * 1000, () =>
      this.fetchJson<Array<Record<string, unknown>>>(
        `${this.cfg.regimeRegularUrl}/calculadora/dados-abertos/ncm/vigentes?data=${encodeURIComponent(data)}`
      )
    );
  }

  async getNbsLista(data: string): Promise<Array<Record<string, unknown>>> {
    return this.cached(`da:nbs:${data}`, 30 * 60 * 1000, () =>
      this.fetchJson<Array<Record<string, unknown>>>(
        `${this.cfg.regimeRegularUrl}/calculadora/dados-abertos/nbs/lista?data=${encodeURIComponent(data)}`
      )
    );
  }

  async getFundamentacoesLegais(data: string): Promise<Array<Record<string, unknown>>> {
    return this.cached(`da:fund:${data}`, 30 * 60 * 1000, () =>
      this.fetchJson<Array<Record<string, unknown>>>(
        `${this.cfg.regimeRegularUrl}/calculadora/dados-abertos/fundamentacoes-legais?data=${encodeURIComponent(data)}`
      )
    );
  }

  async getAliquotaMunicipio(codigoMunicipio: number, data: string): Promise<Record<string, unknown>> {
    return this.cached(`da:aliqmun:${codigoMunicipio}:${data}`, 30 * 60 * 1000, () =>
      this.fetchJson<Record<string, unknown>>(
        `${this.cfg.regimeRegularUrl}/calculadora/dados-abertos/aliquota-municipio?codigoMunicipio=${codigoMunicipio}&data=${encodeURIComponent(data)}`
      )
    );
  }

  // ---------- Simples Nacional ----------

  async calculateSimplesNacional(payload: OperacaoSimplesInput): Promise<SimplesNacionalResponse> {
    return this.fetchJson<SimplesNacionalResponse>(
      `${this.cfg.simplesNacionalUrl}/calculadora/observabilidade/simples-nacional`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );
  }

  async getSimplesNacionalError(codigo: string): Promise<Record<string, unknown>> {
    return this.cached(`err:vsn:${codigo}`, 60 * 60 * 1000, () =>
      this.fetchJson<Record<string, unknown>>(
        `${this.cfg.simplesNacionalUrl}/calculadora/observabilidade/simples-nacional/erros?codigo=${encodeURIComponent(codigo)}`
      )
    );
  }

  async getAtividadesSimples(
    data: string,
    params?: { tpDoc?: string; cClassTrib?: string; anexos?: string }
  ): Promise<Array<Record<string, unknown>>> {
    const qs = new URLSearchParams({ data });
    if (params?.tpDoc) qs.set('tpDoc', params.tpDoc);
    if (params?.cClassTrib) qs.set('cClassTrib', params.cClassTrib);
    if (params?.anexos) qs.set('anexos', params.anexos);
    const key = `sn:ativ:${qs.toString()}`;
    return this.cached(key, 30 * 60 * 1000, () =>
      this.fetchJson<Array<Record<string, unknown>>>(
        `${this.cfg.simplesNacionalUrl}/calculadora/simples-nacional/atividades?${qs.toString()}`
      )
    );
  }

  // ---------- Gerador DANFSe ----------

  async generateDanfsePdf(xml: string, stc: '0' | '1' | '2' = '0', canhoto = true): Promise<Buffer> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.defaultTimeoutMs);
    try {
      const qs = new URLSearchParams({ stc, canhoto: String(canhoto) });
      const response = await fetch(`${this.cfg.geradorDanfseUrl}/api/danfse?${qs.toString()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/xml', Accept: 'application/pdf' },
        body: xml,
        signal: controller.signal,
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status} ao gerar DANFSe: ${text.slice(0, 400)}`);
      }
      const arrayBuf = await response.arrayBuffer();
      return Buffer.from(arrayBuf);
    } finally {
      clearTimeout(timer);
    }
  }
}

