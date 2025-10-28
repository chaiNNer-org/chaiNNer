"""Tests for RTX Remix API module."""
from __future__ import annotations

from packages.chaiNNer_external.rtx_remix_api import (
    RemixApi,
    RemixApiConfig,
)


def test_remix_api_config_from_env_defaults():
    """Test RemixApiConfig.from_env() with default values."""
    config = RemixApiConfig.from_env()
    assert config.host == "127.0.0.1"
    assert config.protocol == ["http", "https"]
    assert config.port == ["8111"]


def test_remix_api_config_list_apis():
    """Test RemixApiConfig.list_apis() generates correct API combinations."""
    config = RemixApiConfig(
        protocol=["http", "https"], host="127.0.0.1", port=["8111", "8112"]
    )
    apis = config.list_apis()

    assert len(apis) == 4  # 2 protocols * 2 ports
    assert any(
        api.protocol == "http" and api.port == "8111" and api.host == "127.0.0.1"
        for api in apis
    )
    assert any(
        api.protocol == "https" and api.port == "8112" and api.host == "127.0.0.1"
        for api in apis
    )


def test_remix_api_base_url():
    """Test RemixApi.base_url property."""
    api = RemixApi(protocol="http", host="127.0.0.1", port="8111")
    assert api.base_url == "http://127.0.0.1:8111"


def test_remix_api_get_url():
    """Test RemixApi.get_url() path concatenation."""
    api = RemixApi(protocol="http", host="127.0.0.1", port="8111")
    assert api.get_url("/health") == "http://127.0.0.1:8111/health"
    assert api.get_url("/textures") == "http://127.0.0.1:8111/textures"
