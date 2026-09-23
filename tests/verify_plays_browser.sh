#!/usr/bin/env bash
# Verificação funcional das 5 jogadas no navegador (headless).
#
# Complementa os testes Python (que cobrem o pré-processamento e a agregação):
# aqui exercitamos a INTERFACE, carregando cada jogada pelo seletor e conferindo
# que a troca funciona de ponta a ponta — painéis atualizados, controles
# habilitados, marcadores de evento coerentes (sacks sem lançamento) e ausência
# de erros no console.
#
# Requisitos: python3 (servidor HTTP) e agent-browser (Chromium headless).
#
# Uso: tests/verify_plays_browser.sh
# Sai com código 0 se todas as jogadas passarem; !=0 caso contrário.

set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT" || exit 2

PORT="${PORT:-8231}"
BASE="http://localhost:${PORT}/app/index.html"
SESSION="verify-plays-$$"

# Jogadas esperadas: "arquivo|rótulo de resultado|tem_lançamento(1/0)"
PLAYS=(
  "plays/2021090900_97.json|Incompleto|1"
  "plays/2021091200_231.json|Completo|1"
  "plays/2021091200_2631.json|Sack|0"
  "plays/2021091201_691.json|Sack|0"
  "plays/2021091204_2196.json|Completo|1"
)

fail=0
pass=0

log()  { printf '%s\n' "$*"; }
ok()   { printf '  [OK]   %s\n' "$*"; pass=$((pass+1)); }
bad()  { printf '  [FALHA] %s\n' "$*"; fail=$((fail+1)); }

# --- sobe o servidor HTTP a partir da raiz do repositório ---
python3 -m http.server "$PORT" >/tmp/verify_http.log 2>&1 &
HTTP_PID=$!
cleanup() {
  kill "$HTTP_PID" 2>/dev/null
  agent-browser --session "$SESSION" close >/dev/null 2>&1
}
trap cleanup EXIT
sleep 1.5

# --- abre a página e espera a inicialização (seletor populado) ---
agent-browser --session "$SESSION" open "$BASE" >/dev/null 2>&1
agent-browser --session "$SESSION" set viewport 1400x1000 1 >/dev/null 2>&1
agent-browser --session "$SESSION" wait 1500 >/dev/null 2>&1

selcount=$(agent-browser --session "$SESSION" eval \
  "document.querySelectorAll('#play-selector option').length" 2>/dev/null | tr -d '"')
log "Jogadas no seletor: ${selcount}"
if [ "${selcount}" != "5" ]; then
  bad "esperava 5 opções no seletor, encontrei ${selcount}"
fi

# limpa o console antes de exercitar as trocas
agent-browser --session "$SESSION" console --clear >/dev/null 2>&1
agent-browser --session "$SESSION" errors --clear >/dev/null 2>&1

for entry in "${PLAYS[@]}"; do
  file="${entry%%|*}"
  rest="${entry#*|}"
  label="${rest%%|*}"
  hasthrow="${rest##*|}"

  log ""
  log "== Jogada ${file} (resultado esperado: ${label}) =="

  # seleciona a jogada e dispara o change (o app escuta 'change')
  agent-browser --session "$SESSION" eval \
    "(()=>{const s=document.getElementById('play-selector'); s.value='${file}'; s.dispatchEvent(new Event('change')); return s.value;})()" \
    >/dev/null 2>&1
  agent-browser --session "$SESSION" wait 900 >/dev/null 2>&1

  # coleta o estado da UI em um único JSON
  state=$(agent-browser --session "$SESSION" eval \
    "(()=>{const t=id=>{const e=document.getElementById(id);return e?e.textContent.trim():null};\
      return JSON.stringify({\
        status:t('status'),\
        result:t('result-body'),\
        geo:t('geo-current'),\
        playDisabled:document.getElementById('btnPlay').disabled,\
        sliderDisabled:document.getElementById('slider').disabled,\
        throwMarkers:document.querySelectorAll('#event-markers .marker.throw').length,\
        snapMarkers:document.querySelectorAll('#event-markers .marker.snap').length\
      });})()" 2>/dev/null | sed 's/^"//; s/"$//; s/\\"/"/g')

  # extrações simples via python (stdlib) para robustez
  parse() { printf '%s' "$state" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('$1'))" 2>/dev/null; }

  st=$(parse status)
  res=$(parse result)
  geo=$(parse geo)
  pdis=$(parse playDisabled)
  sdis=$(parse sliderDisabled)
  thr=$(parse throwMarkers)
  snp=$(parse snapMarkers)

  # 1) o status reflete a jogada carregada
  id="${file#plays/}"; id="${id%.json}"
  case "$st" in
    *"$id"*) ok "status reflete a jogada (${id})";;
    *) bad "status não menciona ${id}: '${st}'";;
  esac

  # 2) painel de resultado mostra o rótulo esperado
  case "$res" in
    *"$label"*) ok "painel de resultado mostra '${label}'";;
    *) bad "painel de resultado não mostra '${label}': '${res}'";;
  esac

  # 3) aproximação geométrica tem um valor exibido (yd) e não fica vazia
  case "$geo" in
    *yd*) ok "aproximação geométrica exibida (${geo})";;
    *) bad "aproximação geométrica ausente/vazia: '${geo}'";;
  esac

  # 4) controles habilitados após carregar
  if [ "$pdis" = "False" ] && [ "$sdis" = "False" ]; then
    ok "controles habilitados (play/slider)"
  else
    bad "controles não habilitados (play disabled=${pdis}, slider disabled=${sdis})"
  fi

  # 5) marcador de snap presente
  if [ "$snp" = "1" ]; then ok "marcador de snap presente"; else bad "marcador de snap ausente (${snp})"; fi

  # 6) coerência do lançamento: sacks NÃO têm marcador de lançamento
  if [ "$hasthrow" = "1" ]; then
    if [ "$thr" = "1" ]; then ok "marcador de lançamento presente"; else bad "esperava marcador de lançamento, achei ${thr}"; fi
  else
    if [ "$thr" = "0" ]; then ok "sack sem marcador de lançamento (correto)"; else bad "sack não deveria ter marcador de lançamento (${thr})"; fi
  fi
done

# --- erros de console acumulados durante todas as trocas ---
log ""
errs=$(agent-browser --session "$SESSION" errors 2>/dev/null | grep -v '^\s*$' | grep -vi 'no page errors\|no errors' || true)
if [ -z "$errs" ]; then
  ok "sem erros de página no console durante as 5 trocas"
else
  bad "erros de página no console:"; printf '%s\n' "$errs"
fi

log ""
log "Resumo: ${pass} verificações OK, ${fail} falhas."
[ "$fail" -eq 0 ]
