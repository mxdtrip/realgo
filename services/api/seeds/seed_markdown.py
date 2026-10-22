#!/usr/bin/env python3
"""Publish Markdown articles without changing legacy content or user progress."""
import argparse
import os
import re
from pathlib import Path


DEFAULT_DIRECTORY = Path(__file__).parent / "materials"


def load_materials(directory):
    directory = Path(directory)
    if not directory.is_dir():
        raise ValueError(f"Markdown directory does not exist: {directory}")
    rows = []
    for path in sorted(directory.glob("*.md")):
        if not re.fullmatch(r"[a-z][a-z0-9_]*", path.stem):
            raise ValueError(f"{path.name}: filename must be a subpattern code")
        content = path.read_text(encoding="utf-8-sig")
        if not content.strip():
            raise ValueError(f"{path.name}: Markdown article is empty")
        rows.append({"code": path.stem, "content_md": content})
    if not rows:
        raise ValueError(f"No Markdown articles in {directory}")
    return rows


def upsert_materials(cur, rows):
    codes = [row["code"] for row in rows]
    cur.execute(
        "SELECT code, id FROM patterns "
        "WHERE code = ANY(%s) AND kind = 'subpattern'",
        (codes,),
    )
    pattern_ids = dict(cur.fetchall())
    missing = sorted(set(codes) - pattern_ids.keys())
    if missing:
        raise ValueError("Unknown subpatterns (run migrations first): " + ", ".join(missing))
    for row in rows:
        cur.execute(
            """
            INSERT INTO pattern_learning_materials (pattern_id, what_it_is, content_md)
            VALUES (%s, '', %s)
            ON CONFLICT (pattern_id) DO UPDATE SET
                content_md = EXCLUDED.content_md,
                updated_at = CURRENT_TIMESTAMP
            WHERE pattern_learning_materials.content_md IS DISTINCT FROM EXCLUDED.content_md
            """,
            (pattern_ids[row["code"]], row["content_md"]),
        )


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", nargs="?", type=Path, default=DEFAULT_DIRECTORY)
    parser.add_argument("--validate-only", action="store_true")
    args = parser.parse_args(argv)
    try:
        rows = load_materials(args.directory)
        if args.validate_only:
            print(f"validated {len(rows)} Markdown articles")
            return
        dsn = os.environ.get("DATABASE_URL")
        if not dsn:
            raise ValueError("DATABASE_URL is required")
        import psycopg

        with psycopg.connect(dsn) as conn:
            with conn.cursor() as cur:
                upsert_materials(cur, rows)
    except ValueError as exc:
        parser.error(str(exc))
    print(f"published {len(rows)} Markdown articles")


if __name__ == "__main__":
    main()
