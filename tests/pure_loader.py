"""Load the integration's pure modules for unit testing.

The pure modules (``next_run.py``, ``schedules.py``) are self-contained: zero
Home Assistant imports and zero relative imports. They can therefore be loaded
directly by file path with plain pytest -- no Home Assistant installation and
no importlib package-stub hack needed.
"""

from __future__ import annotations

import importlib.util
import types
from pathlib import Path

_INTEGRATION_DIR = (
    Path(__file__).resolve().parents[1]
    / "custom_components"
    / "irrigation_scheduler"
)


def load_pure_module(filename: str) -> types.ModuleType:
    """Load a self-contained pure module by its file name."""
    module_name = Path(filename).stem
    spec = importlib.util.spec_from_file_location(
        module_name, _INTEGRATION_DIR / filename
    )
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not create an import spec for {filename}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module
