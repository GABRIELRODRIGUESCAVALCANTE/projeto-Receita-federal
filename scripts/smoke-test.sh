#!/usr/bin/env bash
set -euo pipefail

REG_URL="${RTC_REGIME_REGULAR_URL:-http://localhost:8080/api}"
SN_URL="${RTC_SIMPLES_NACIONAL_URL:-http://localhost:8082/api}"
DANFSE_URL="${RTC_GERADOR_DANFSE_URL:-http://localhost:8083}"
REG_HEALTH="${RTC_REGIME_REGULAR_HEALTH_URL:-http://localhost:9101/health}"
SN_HEALTH="${RTC_SIMPLES_NACIONAL_HEALTH_URL:-http://localhost:9103/health}"

echo "=== 1. Healthchecks dos 3 motores oficiais ==="
echo -n "Regime Regular ($REG_HEALTH): "
curl -fsS "$REG_HEALTH" && echo ""
echo -n "Simples Nacional ($SN_HEALTH): "
curl -fsS "$SN_HEALTH" && echo ""
echo -n "Gerador DANFSe ($DANFSE_URL/health/ready): "
curl -fsS "$DANFSE_URL/health/ready" && echo ""

echo ""
echo "=== 2. Smoke Test — Regime Regular (POST /calculadora/observabilidade/regime-geral) ==="
curl -fsS -X POST "$REG_URL/calculadora/observabilidade/regime-geral" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "smoke-test-regular-001",
    "versao": "1.0.0",
    "dhFatoGerador": "2027-03-10T10:00:00-03:00",
    "municipio": 4314902,
    "uf": "RS",
    "itens": [
      {
        "numero": 1,
        "nbs": "122011200",
        "cst": "200",
        "cClassTrib": "200028",
        "baseCalculo": 1200.00,
        "aliquotasNominais": { "cbs": 8.8, "ibsEstadual": 0.05, "ibsMunicipal": 0.05 }
      }
    ]
  }' | python3 -m json.tool | head -n 30

echo ""
echo "=== 3. Smoke Test — Simples Nacional (POST /calculadora/observabilidade/simples-nacional) ==="
curl -fsS -X POST "$SN_URL/calculadora/observabilidade/simples-nacional" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "smoke-test-simples-001",
    "versao": "2.0.0",
    "data": "2027-03-15",
    "tpDoc": "55",
    "CRT": "1",
    "itens": [
      {
        "numero": 1,
        "cAtivSN": "01",
        "cClassTrib": "000001",
        "ncm": "22030000",
        "baseCalculo": "1000.00",
        "valorImpostoSeletivo": "0.00",
        "pIBSSN": "0.05",
        "pCBSSN": "2.50"
      }
    ]
  }' | python3 -m json.tool | head -n 30

echo ""
echo "=== 4. Smoke Test — Gerador DANFSe (POST /api/danfse -> PDF) ==="
TMP_PDF="/tmp/danfse-smoke-test.pdf"
curl -fsS -X POST "$DANFSE_URL/api/danfse?stc=0&canhoto=true" \
  -H "Content-Type: application/xml" \
  --data-binary '<NFSe versao="1.00"><infNFSe Id="NFS123" dhProc="2026-07-14T10:00:00-03:00"><nNFSe>1</nNFSe><ambGer>1</ambGer><cStat>100</cStat><DPS><infDPS><nDPS>1</nDPS><serie>1</serie><dhEmi>2026-07-14T10:00:00-03:00</dhEmi><dCompet>2026-07-14</dCompet><tpEmit>1</tpEmit><tpAmb>1</tpAmb><prest><regTrib><opSimpNac>1</opSimpNac></regTrib></prest><serv><cServ><cTribNac>010101</cTribNac><xDescServ>Consultoria em Tecnologia da Informacao - Smoke Test RTC Studio</xDescServ></cServ></serv><valores><vServPrest><vServ>1200.00</vServ></vServPrest><trib><tribMun><tribISSQN>1</tribISSQN></tribMun></trib></valores></infDPS></DPS><emit><CNPJ>12345678000195</CNPJ><xNome>Empresa Exemplo LTDA</xNome><enderNac><cMun>3550308</cMun><CEP>01001000</CEP></enderNac></emit><valores><vLiq>1200.00</vLiq></valores></infNFSe></NFSe>' \
  -o "$TMP_PDF"

HEAD_BYTES="$(head -c 5 "$TMP_PDF")"
if [ "$HEAD_BYTES" = "%PDF-" ]; then
  echo "[ok] PDF gerado com sucesso em $TMP_PDF ($(wc -c < "$TMP_PDF") bytes)"
else
  echo "[erro] Resposta não é um PDF válido: $HEAD_BYTES"
  exit 1
fi

echo ""
echo "Todos os 3 motores oficiais passaram no smoke test!"

