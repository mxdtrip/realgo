import os
import tempfile
import unittest
from pathlib import Path

from seed_markdown import DEFAULT_DIRECTORY, load_materials, upsert_materials


class LoadMaterialsTest(unittest.TestCase):
    def test_loads_utf8_markdown_verbatim_using_filename_as_code(self):
        with tempfile.TemporaryDirectory() as directory:
            content = "## Что это\n\nПроверка `set`.\n\n```python\nseen = set()\n```\n"
            Path(directory, "membership_deduplication.md").write_text(content, encoding="utf-8")
            self.assertEqual(load_materials(directory), [
                {"code": "membership_deduplication", "content_md": content},
            ])

    def test_rejects_empty_article_or_invalid_filename(self):
        for filename, content in [("membership.md", " \n"), ("bad name.md", "Text")]:
            with self.subTest(filename=filename), tempfile.TemporaryDirectory() as directory:
                Path(directory, filename).write_text(content, encoding="utf-8")
                with self.assertRaises(ValueError):
                    load_materials(directory)

    def test_rejects_missing_or_empty_directory(self):
        with tempfile.TemporaryDirectory() as directory:
            for path in [Path(directory), Path(directory, "missing")]:
                with self.subTest(path=path), self.assertRaises(ValueError):
                    load_materials(path)

    def test_shipped_article_has_expected_code_and_executable_solution(self):
        rows = {row["code"]: row["content_md"] for row in load_materials(DEFAULT_DIRECTORY)}
        article = rows["membership_deduplication"]
        code = article.split("```python\n", 1)[1].split("```", 1)[0]
        namespace = {}
        exec(compile(code, "membership_deduplication.md", "exec"), namespace)
        solution = namespace["Solution"]()
        for nums, expected in [([], False), ([1], False), ([1, 2, 3, 4], False),
                               ([1, 2, 3, 1], True), ([0, 0], True), ([-1, 2, -1], True)]:
            with self.subTest(nums=nums):
                self.assertIs(solution.containsDuplicate(nums), expected)


@unittest.skipUnless(os.environ.get("TEST_DATABASE_URL"), "TEST_DATABASE_URL not set")
class PublishMaterialsTest(unittest.TestCase):
    def test_publish_preserves_legacy_fields_and_is_idempotent(self):
        import psycopg

        with psycopg.connect(os.environ["TEST_DATABASE_URL"]) as conn:
            with conn.cursor() as cur:
                # Temporary tables shadow real names and disappear on disconnect.
                cur.execute("CREATE TEMP TABLE patterns (id BIGINT, code TEXT, kind TEXT)")
                cur.execute("""
                    CREATE TEMP TABLE pattern_learning_materials (
                        pattern_id BIGINT PRIMARY KEY, what_it_is TEXT NOT NULL,
                        content_md TEXT NOT NULL DEFAULT '',
                        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
                    )
                """)
                cur.execute("INSERT INTO patterns VALUES (1, 'membership', 'subpattern'), (2, 'hashing', 'family')")
                cur.execute("INSERT INTO pattern_learning_materials (pattern_id, what_it_is) VALUES (1, 'Legacy')")
                rows = [{"code": "membership", "content_md": "## Article\n\n`set`"}]
                upsert_materials(cur, rows)
                cur.execute("SELECT what_it_is, content_md, updated_at FROM pattern_learning_materials")
                first = cur.fetchone()
                self.assertEqual(first[:2], ("Legacy", rows[0]["content_md"]))
                conn.commit()
                upsert_materials(cur, rows)
                cur.execute("SELECT what_it_is, content_md, updated_at FROM pattern_learning_materials")
                self.assertEqual(cur.fetchone(), first)
                # Unknown codes and family codes fail before any article is changed.
                for code in ["unknown", "hashing"]:
                    with self.subTest(code=code), self.assertRaises(ValueError):
                        upsert_materials(cur, [
                            {"code": "membership", "content_md": "must not be saved"},
                            {"code": code, "content_md": "Invalid target"},
                        ])
                cur.execute("SELECT content_md FROM pattern_learning_materials")
                self.assertEqual(cur.fetchone()[0], rows[0]["content_md"])
                cur.execute("INSERT INTO patterns VALUES (3, 'new_subpattern', 'subpattern')")
                upsert_materials(cur, [{"code": "new_subpattern", "content_md": "New article"}])
                cur.execute("SELECT what_it_is, content_md FROM pattern_learning_materials WHERE pattern_id = 3")
                self.assertEqual(cur.fetchone(), ("", "New article"))


if __name__ == "__main__":
    unittest.main()
