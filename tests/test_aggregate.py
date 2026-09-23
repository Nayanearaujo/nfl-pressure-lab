"""Testes da visão agregada (src/pressure_lab/aggregate.py).

Rodam sobre os 5 JSONs reais já versionados em app/data/plays/ (não dependem
do dataset original). Validam que:
- o agregado sai com 5 linhas (uma por jogada);
- cada linha tem os campos esperados e valores coerentes com os JSONs;
- jogadas sem lançamento (sacks) têm distância no lançamento ausente (None).
"""

import glob
import os
import sys
import unittest

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(_ROOT, "src"))

from pressure_lab import aggregate as agg  # noqa: E402

PLAYS_DIR = os.path.join(_ROOT, "app", "data", "plays")


class TestAggregate(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = agg.build_aggregate(PLAYS_DIR)
        cls.plays = cls.data["plays"]
        cls.by_id = {p["id"]: p for p in cls.plays}

    def test_has_five_rows(self):
        # A tabela comparativa deve sair com exatamente 5 linhas (5 jogadas).
        n_files = len(glob.glob(os.path.join(PLAYS_DIR, "*.json")))
        self.assertEqual(n_files, 5)
        self.assertEqual(self.data["playCount"], 5)
        self.assertEqual(len(self.plays), 5)

    def test_each_row_has_expected_fields(self):
        expected = {
            "id", "matchup", "minDistanceYd", "distanceAtThrowYd",
            "passResult", "passResultLabel", "pffTotal",
            "pffHurries", "pffHits", "pffSacks",
        }
        for p in self.plays:
            self.assertTrue(expected.issubset(p.keys()), p.get("id"))
            # pffTotal deve ser a soma das três contagens.
            self.assertEqual(
                p["pffTotal"], p["pffHurries"] + p["pffHits"] + p["pffSacks"]
            )
            # A ordenação padrão é por menor distância ascendente.
        dists = [p["minDistanceYd"] for p in self.plays if p["minDistanceYd"] is not None]
        self.assertEqual(dists, sorted(dists))

    def test_known_values_and_sacks_without_throw(self):
        # Valores conhecidos da jogada demonstrativa (TB x DAL).
        demo = self.by_id["2021090900_97"]
        self.assertEqual(demo["matchup"], "TB x DAL")
        self.assertAlmostEqual(demo["minDistanceYd"], 1.11, places=2)
        self.assertAlmostEqual(demo["distanceAtThrowYd"], 1.79, places=2)
        self.assertEqual(demo["passResultLabel"], "Incompleto")
        self.assertEqual(demo["pffTotal"], 4)

        # Sacks não têm lançamento: distância no lançamento deve ser None.
        for sack_id in ("2021091200_2631", "2021091201_691"):
            row = self.by_id[sack_id]
            self.assertEqual(row["passResult"], "S")
            self.assertIsNone(row["distanceAtThrowYd"])
            self.assertIsNotNone(row["minDistanceYd"])


if __name__ == "__main__":
    unittest.main()
