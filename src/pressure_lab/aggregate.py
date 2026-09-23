"""NFL Pressure Lab — visão agregada das jogadas processadas.

Lê os JSONs por jogada já gerados em ``app/data/plays/`` e produz um único
arquivo ``app/data/aggregate.json`` com um resumo por jogada, para alimentar a
tabela "Comparação entre jogadas" na interface.

Este módulo NÃO reprocessa os CSVs originais e NÃO recalcula nada: apenas lê os
valores já presentes nos JSONs (que foram gerados pelo pipeline em
``preprocess.py``). Assim, mantém as três camadas de informação separadas —
aproximação geométrica, pressão registrada pela PFF e resultado da jogada —
exatamente como no restante do projeto.

Usa apenas a biblioteca padrão do Python (RNF2).
"""

from __future__ import annotations

import argparse
import glob
import json
import os
from typing import Any, Dict, List, Optional


def _min_distance(doc: Dict[str, Any]) -> Optional[float]:
    """Menor aproximação geométrica na jogada (mínimo por frame).

    Retorna ``None`` se nenhum frame tiver distância disponível.
    """
    vals = [
        f.get("geometric_min_distance_yd")
        for f in doc.get("frames", [])
        if f.get("geometric_min_distance_yd") is not None
    ]
    return min(vals) if vals else None


def _distance_at_throw(doc: Dict[str, Any]) -> Optional[float]:
    """Aproximação geométrica no frame do lançamento.

    Retorna ``None`` quando não há evento de lançamento (por exemplo em sacks)
    ou quando o frame correspondente não tem distância.
    """
    throw = (doc.get("events") or {}).get("throw")
    if not throw or throw.get("frame") is None:
        return None
    target = throw["frame"]
    for f in doc.get("frames", []):
        if f.get("frameId") == target:
            return f.get("geometric_min_distance_yd")
    return None


def summarize_play(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Extrai o resumo de uma jogada a partir do seu JSON já processado."""
    ctx = doc.get("context") or {}
    meta = doc.get("meta") or {}
    pff = doc.get("pressureSummary") or {}
    result = doc.get("result") or {}

    possession = ctx.get("possessionTeam")
    defense = ctx.get("defensiveTeam")
    matchup = (
        f"{possession} x {defense}"
        if possession and defense
        else (possession or defense or "?")
    )

    hurries = pff.get("hurries") or 0
    hits = pff.get("hits") or 0
    sacks = pff.get("sacks") or 0

    return {
        "id": meta.get("id"),
        "matchup": matchup,
        "possessionTeam": possession,
        "defensiveTeam": defense,
        "minDistanceYd": _min_distance(doc),
        "distanceAtThrowYd": _distance_at_throw(doc),
        "passResult": result.get("passResult"),
        "passResultLabel": result.get("passResultLabel"),
        "pffHurries": hurries,
        "pffHits": hits,
        "pffSacks": sacks,
        "pffTotal": hurries + hits + sacks,
    }


def build_aggregate(plays_dir: str) -> Dict[str, Any]:
    """Constrói o objeto agregado a partir de todos os JSONs em ``plays_dir``.

    As jogadas são ordenadas por menor aproximação geométrica (ascendente),
    para que a interface já receba uma ordem padrão útil. Jogadas sem distância
    disponível vão para o fim.
    """
    files = sorted(glob.glob(os.path.join(plays_dir, "*.json")))
    plays: List[Dict[str, Any]] = []
    for path in files:
        with open(path, "r", encoding="utf-8") as fh:
            doc = json.load(fh)
        plays.append(summarize_play(doc))

    plays.sort(
        key=lambda p: (p["minDistanceYd"] is None, p["minDistanceYd"] or 0.0)
    )

    return {
        "note": (
            "Resumo por jogada derivado dos JSONs já processados. Três camadas "
            "separadas: aproximacao geometrica, pressao PFF e resultado. "
            "Nenhuma relacao causal e afirmada."
        ),
        "playCount": len(plays),
        "plays": plays,
    }


def write_aggregate(plays_dir: str, out_path: str) -> Dict[str, Any]:
    """Gera o agregado e o grava em ``out_path``; retorna o objeto gerado."""
    data = build_aggregate(plays_dir)
    os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=2, sort_keys=True)
        fh.write("\n")
    return data


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(
        description="Gera app/data/aggregate.json a partir dos JSONs por jogada.",
    )
    parser.add_argument(
        "--plays-dir",
        default="app/data/plays",
        help="Diretório com os JSONs por jogada (default: app/data/plays)",
    )
    parser.add_argument(
        "--out",
        default="app/data/aggregate.json",
        help="Arquivo de saída (default: app/data/aggregate.json)",
    )
    args = parser.parse_args(argv)

    if not os.path.isdir(args.plays_dir):
        parser.error(f"diretório de jogadas não encontrado: {args.plays_dir}")

    data = write_aggregate(args.plays_dir, args.out)
    print(f"[OK] agregado com {data['playCount']} jogadas -> {args.out}")
    for p in data["plays"]:
        md = "NA" if p["minDistanceYd"] is None else f"{p['minDistanceYd']:.2f}"
        print(f"     {p['id']}: {p['matchup']} | min={md} yd | "
              f"resultado={p['passResultLabel']} | PFF={p['pffTotal']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
