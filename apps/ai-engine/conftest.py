# conftest.py — root conftest for apps/ai-engine
# Ensures that `app` module is importable when pytest is invoked from the
# workspace root (e.g. `python -m pytest apps/ai-engine/tests -q`).
import sys
import pathlib

# Add apps/ai-engine/ to sys.path so `import app` works from any cwd
_engine_root = pathlib.Path(__file__).resolve().parent
if str(_engine_root) not in sys.path:
    sys.path.insert(0, str(_engine_root))
