import { config as loadDotenv } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../../..');

loadDotenv({ path: path.join(rootDir, '.env') });

export const appConfig = {
  port: Number(process.env.API_PORT || 3001),
  host: process.env.API_HOST || '0.0.0.0',
  dbPath: path.resolve(rootDir, process.env.APP_DB_PATH || './data/app.db'),
  engines: {
    regimeRegularUrl: (process.env.RTC_REGIME_REGULAR_URL || 'http://localhost:8080/api').replace(/\/$/, ''),
    regimeRegularHealthUrl: process.env.RTC_REGIME_REGULAR_HEALTH_URL || 'http://localhost:9101/health',
    simplesNacionalUrl: (process.env.RTC_SIMPLES_NACIONAL_URL || 'http://localhost:8082/api').replace(/\/$/, ''),
    simplesNacionalHealthUrl: process.env.RTC_SIMPLES_NACIONAL_HEALTH_URL || 'http://localhost:9103/health',
    geradorDanfseUrl: (process.env.RTC_GERADOR_DANFSE_URL || 'http://localhost:8083').replace(/\/$/, ''),
  },
  ai: {
    provider: (process.env.AI_PROVIDER || 'ollama') as 'gemini' | 'openai' | 'ollama',
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    ollamaBaseUrl: (process.env.OLLAMA_BASE_URL || 'http://localhost:11434').replace(/\/$/, ''),
    ollamaModel: process.env.OLLAMA_MODEL || 'llama3.1',
  },
};

