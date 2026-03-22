"""Shared test fixtures for SIMOGRANTS."""

from __future__ import annotations

import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client(tmp_path: Path):
    """Create a test client for the FastAPI app with isolated test DB."""
    old_cwd = Path.cwd()
    os.chdir(tmp_path)
    from src.main import app
    with TestClient(app) as test_client:
        yield test_client
    os.chdir(old_cwd)
