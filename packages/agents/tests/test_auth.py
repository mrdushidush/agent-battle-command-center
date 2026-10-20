"""Tests for the agents service's inbound API key check.

The middleware is mounted on a minimal app rather than on src.main, so the
test does not need CrewAI or a model. /run-validation stands in for any route
that runs code.
"""
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from src import auth


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(auth.settings, "API_KEY", "test-key")

    app = FastAPI()
    app.middleware("http")(auth.require_api_key)

    @app.get("/health")
    def health():
        return {"status": "ok"}

    @app.post("/run-validation")
    def run_validation():
        return {"ran": True}

    return TestClient(app)


def test_health_needs_no_key(client):
    assert client.get("/health").status_code == 200


def test_missing_key_is_refused(client):
    response = client.post("/run-validation")
    assert response.status_code == 401
    assert "ran" not in response.json()


def test_wrong_key_is_refused(client):
    response = client.post("/run-validation", headers={"X-API-Key": "wrong"})
    assert response.status_code == 403
    assert "ran" not in response.json()


def test_right_key_is_admitted(client):
    response = client.post("/run-validation", headers={"X-API-Key": "test-key"})
    assert response.status_code == 200
    assert response.json() == {"ran": True}


def test_unconfigured_key_refuses_everything(client, monkeypatch):
    monkeypatch.setattr(auth.settings, "API_KEY", "")
    response = client.post("/run-validation", headers={"X-API-Key": ""})
    assert response.status_code == 500
    assert "ran" not in response.json()


def test_cross_origin_preflight_is_not_granted(client):
    response = client.options(
        "/run-validation",
        headers={
            "Origin": "https://evil.example",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert "access-control-allow-origin" not in response.headers
