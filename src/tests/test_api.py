"""Tests for the SIMOGRANTS API endpoints."""

from __future__ import annotations


def test_health(client):
    """Test /health endpoint returns ok."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "timestamp" in data


def test_version(client):
    """Test /version endpoint returns component info."""
    response = client.get("/version")
    assert response.status_code == 200
    data = response.json()
    assert "version" in data
    assert "components" in data
    assert "collector" in data["components"]
    assert "evaluator" in data["components"]
    assert "mechanism" in data["components"]
    assert "blockchain" in data["components"]
    assert "database" in data["components"]


def test_create_and_get_project(client):
    """Test project CRUD basics."""
    payload = {
        "name": "Test Project",
        "description": "A test project",
        "github_url": "https://github.com/example/test",
    }
    create = client.post("/projects", json=payload)
    assert create.status_code == 201
    data = create.json()
    assert data["project_id"] == "test-project"
    assert data["name"] == "Test Project"

    get_resp = client.get("/projects/test-project")
    assert get_resp.status_code == 200
    assert get_resp.json()["name"] == "Test Project"


def test_list_projects(client):
    """Test listing projects."""
    client.post("/projects", json={"name": "Project One", "description": "one"})
    client.post("/projects", json={"name": "Project Two", "description": "two"})

    response = client.get("/projects")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 2


def test_get_missing_project_returns_404(client):
    """Missing project should return 404."""
    response = client.get("/projects/does-not-exist")
    assert response.status_code == 404


def test_collect_missing_project_returns_404(client):
    """Collecting unknown project should 404."""
    response = client.post("/projects/nope/collect", json={})
    assert response.status_code == 404


def test_profile_missing_returns_404(client):
    """Missing profile should return 404."""
    client.post("/projects", json={"name": "Has No Profile", "description": "x"})
    response = client.get("/projects/has-no-profile/profile")
    assert response.status_code == 404


def test_evaluation_requires_profile(client):
    """Evaluation without collected profile should fail clearly."""
    client.post("/projects", json={"name": "Eval Me", "description": "x"})
    response = client.post("/evaluate/projects/eval-me", json={})
    assert response.status_code == 400
    assert "collect first" in response.json()["detail"].lower()


def test_mechanism_config(client):
    """Mechanism config endpoint should return current parameters."""
    response = client.get("/mechanism/config")
    assert response.status_code == 200
    data = response.json()
    assert "matching_pool" in data
    assert "pheromone" in data
    assert "pagerank" in data


def test_pipeline_run_starts(client):
    """Pipeline run endpoint should create a background job."""
    payload = {
        "projects": [
            {
                "name": "Pipeline Project",
                "description": "Pipeline test",
                "github_url": "https://github.com/example/pipeline",
            }
        ],
        "matching_pool": 1000.0,
        "publish_onchain": False,
    }
    response = client.post("/pipeline/run", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "run_id" in data
    assert data["status"] == "pending"
    assert "project_ids" in data
