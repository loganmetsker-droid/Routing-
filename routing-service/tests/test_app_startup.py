"""Application startup smoke tests."""


def test_fastapi_app_imports():
    from app.main import app

    assert app.title == "Routing Optimization Service"
