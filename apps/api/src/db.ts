import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type {
  BatchAnalysisResponse,
  SimulationHistoryEntry,
  StudioSimulationRequest,
  StudioSimulationResponse,
} from '@rtc-studio/shared';

export class AppDatabase {
  private db: DatabaseSync;

  constructor(dbPath: string) {
    if (dbPath !== ':memory:') {
      fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    }
    this.db = new DatabaseSync(dbPath);
    this.init();
  }

  private init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS simulations (
        id TEXT PRIMARY KEY,
        titulo TEXT NOT NULL,
        mode TEXT NOT NULL,
        uf TEXT NOT NULL,
        municipio INTEGER NOT NULL,
        data_fato_gerador TEXT NOT NULL,
        total_regular REAL,
        total_simples REAL,
        request_json TEXT NOT NULL,
        response_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS batch_analyses (
        id TEXT PRIMARY KEY,
        total_notas INTEGER NOT NULL,
        conformes INTEGER NOT NULL,
        divergentes INTEGER NOT NULL,
        com_erro INTEGER NOT NULL,
        response_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
  }

  saveSimulation(request: StudioSimulationRequest, response: StudioSimulationResponse) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO simulations (
        id, titulo, mode, uf, municipio, data_fato_gerador,
        total_regular, total_simples, request_json, response_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      response.id,
      response.titulo,
      response.mode,
      request.uf,
      request.municipio,
      request.dataFatoGerador,
      response.summary.regular?.available ? response.summary.regular.totalTributos : null,
      response.summary.simples?.available ? response.summary.simples.totalTributos : null,
      JSON.stringify(request),
      JSON.stringify(response),
      response.createdAt
    );
  }

  listSimulations(limit = 30): SimulationHistoryEntry[] {
    const stmt = this.db.prepare(`
      SELECT id, titulo, mode, uf, municipio, data_fato_gerador, total_regular, total_simples, created_at
      FROM simulations
      ORDER BY created_at DESC
      LIMIT ?
    `);
    const rows = stmt.all(limit) as Array<Record<string, unknown>>;
    return rows.map((row) => ({
      id: String(row.id),
      titulo: String(row.titulo),
      mode: row.mode as SimulationHistoryEntry['mode'],
      uf: String(row.uf),
      municipio: Number(row.municipio),
      dataFatoGerador: String(row.data_fato_gerador),
      totalRegular: row.total_regular === null ? null : Number(row.total_regular),
      totalSimples: row.total_simples === null ? null : Number(row.total_simples),
      createdAt: String(row.created_at),
    }));
  }

  getSimulation(id: string): { request: StudioSimulationRequest; response: StudioSimulationResponse } | null {
    const stmt = this.db.prepare(`SELECT request_json, response_json FROM simulations WHERE id = ?`);
    const row = stmt.get(id) as { request_json: string; response_json: string } | undefined;
    if (!row) return null;
    return {
      request: JSON.parse(row.request_json) as StudioSimulationRequest,
      response: JSON.parse(row.response_json) as StudioSimulationResponse,
    };
  }

  saveBatchAnalysis(result: BatchAnalysisResponse) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO batch_analyses (
        id, total_notas, conformes, divergentes, com_erro, response_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      result.id,
      result.totalNotas,
      result.conformes,
      result.divergentes,
      result.comErro,
      JSON.stringify(result),
      result.createdAt
    );
  }

  listBatchAnalyses(limit = 20): Array<{
    id: string;
    totalNotas: number;
    conformes: number;
    divergentes: number;
    comErro: number;
    createdAt: string;
  }> {
    const stmt = this.db.prepare(`
      SELECT id, total_notas, conformes, divergentes, com_erro, created_at
      FROM batch_analyses
      ORDER BY created_at DESC
      LIMIT ?
    `);
    const rows = stmt.all(limit) as Array<Record<string, unknown>>;
    return rows.map((row) => ({
      id: String(row.id),
      totalNotas: Number(row.total_notas),
      conformes: Number(row.conformes),
      divergentes: Number(row.divergentes),
      comErro: Number(row.com_erro),
      createdAt: String(row.created_at),
    }));
  }

  getBatchAnalysis(id: string): BatchAnalysisResponse | null {
    const stmt = this.db.prepare(`SELECT response_json FROM batch_analyses WHERE id = ?`);
    const row = stmt.get(id) as { response_json: string } | undefined;
    if (!row) return null;
    return JSON.parse(row.response_json) as BatchAnalysisResponse;
  }

  close() {
    this.db.close();
  }
}

