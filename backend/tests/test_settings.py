"""Tests for api.settings module."""

from __future__ import annotations

import pytest

from api.settings import (
    CacheSetting,
    DropdownOption,
    DropdownSetting,
    ExecutionOptions,
    JsonExecutionOptions,
    NumberSetting,
    SettingsJson,
    SettingsParser,
    ToggleSetting,
)


class TestExecutionOptions:
    """Tests for the ExecutionOptions class."""

    def test_execution_options_creation(self):
        """Test creating ExecutionOptions."""
        backend_settings: JsonExecutionOptions = {
            "package1": {"key1": "value1"},
            "package2": {"key2": 42},
        }
        options = ExecutionOptions(backend_settings)

        # Should not raise any exceptions
        assert options is not None

    def test_parse_static_method(self):
        """Test the parse static method."""
        json_options: JsonExecutionOptions = {"package1": {"setting1": True}}
        options = ExecutionOptions.parse(json_options)

        assert isinstance(options, ExecutionOptions)

    def test_get_package_settings_json_existing_package(self):
        """Test getting settings JSON for an existing package."""
        backend_settings: JsonExecutionOptions = {
            "package1": {"key1": "value1", "key2": 42},
        }
        options = ExecutionOptions(backend_settings)

        result = options.get_package_settings_json("package1")
        assert result == {"key1": "value1", "key2": 42}

    def test_get_package_settings_json_nonexistent_package(self):
        """Test getting settings JSON for a nonexistent package."""
        backend_settings: JsonExecutionOptions = {"package1": {"key1": "value1"}}
        options = ExecutionOptions(backend_settings)

        result = options.get_package_settings_json("package2")
        assert result == {}

    def test_get_package_settings(self):
        """Test getting a SettingsParser for a package."""
        backend_settings: JsonExecutionOptions = {
            "package1": {"key1": "value1"},
        }
        options = ExecutionOptions(backend_settings)

        parser = options.get_package_settings("package1")
        assert isinstance(parser, SettingsParser)

    def test_get_package_settings_caching(self):
        """Test that SettingsParser instances are cached."""
        backend_settings: JsonExecutionOptions = {
            "package1": {"key1": "value1"},
        }
        options = ExecutionOptions(backend_settings)

        parser1 = options.get_package_settings("package1")
        parser2 = options.get_package_settings("package1")

        # Should return the same instance
        assert parser1 is parser2

    def test_get_package_settings_different_packages(self):
        """Test getting settings for different packages."""
        backend_settings: JsonExecutionOptions = {
            "package1": {"key1": "value1"},
            "package2": {"key2": "value2"},
        }
        options = ExecutionOptions(backend_settings)

        parser1 = options.get_package_settings("package1")
        parser2 = options.get_package_settings("package2")

        # Should be different instances
        assert parser1 is not parser2


class TestSettingsParser:
    """Tests for the SettingsParser class."""

    def test_settings_parser_creation(self):
        """Test creating a SettingsParser."""
        raw: SettingsJson = {"key1": "value1", "key2": 42}
        parser = SettingsParser(raw)

        assert parser is not None

    def test_get_bool_with_bool_value(self):
        """Test get_bool with a boolean value."""
        parser = SettingsParser({"flag": True})
        result = parser.get_bool("flag", False)

        assert result is True

    def test_get_bool_with_default(self):
        """Test get_bool with default value."""
        parser = SettingsParser({})
        result = parser.get_bool("missing_key", True)

        assert result is True

    def test_get_bool_with_invalid_value(self):
        """Test get_bool raises error with invalid value."""
        parser = SettingsParser({"flag": "not_a_bool"})

        with pytest.raises(ValueError, match="Invalid bool value"):
            parser.get_bool("flag", False)

    def test_get_int_with_int_value(self):
        """Test get_int with an integer value."""
        parser = SettingsParser({"count": 42})
        result = parser.get_int("count", 0)

        assert result == 42

    def test_get_int_with_default(self):
        """Test get_int with default value."""
        parser = SettingsParser({})
        result = parser.get_int("missing_key", 100)

        assert result == 100

    def test_get_int_with_string_and_parse_str(self):
        """Test get_int with string value and parse_str=True."""
        parser = SettingsParser({"count": "42"})
        result = parser.get_int("count", 0, parse_str=True)

        assert result == 42

    def test_get_int_with_string_without_parse_str(self):
        """Test get_int raises error with string value when parse_str=False."""
        parser = SettingsParser({"count": "42"})

        with pytest.raises(ValueError, match="Invalid str value"):
            parser.get_int("count", 0, parse_str=False)

    def test_get_int_with_bool_value(self):
        """Test get_int raises error with bool value."""
        parser = SettingsParser({"count": True})

        with pytest.raises(ValueError, match="Invalid str value"):
            parser.get_int("count", 0)

    def test_get_int_with_invalid_string(self):
        """Test get_int raises error with invalid string."""
        parser = SettingsParser({"count": "not_a_number"})

        with pytest.raises(ValueError):
            parser.get_int("count", 0, parse_str=True)

    def test_get_str_with_str_value(self):
        """Test get_str with a string value."""
        parser = SettingsParser({"name": "test"})
        result = parser.get_str("name", "default")

        assert result == "test"

    def test_get_str_with_default(self):
        """Test get_str with default value."""
        parser = SettingsParser({})
        result = parser.get_str("missing_key", "default_value")

        assert result == "default_value"

    def test_get_str_with_invalid_value(self):
        """Test get_str raises error with invalid value."""
        parser = SettingsParser({"name": 42})

        with pytest.raises(ValueError, match="Invalid str value"):
            parser.get_str("name", "default")

    def test_get_cache_location_with_str_value(self):
        """Test get_cache_location with a string value."""
        parser = SettingsParser({"path": "/tmp/cache"})
        result = parser.get_cache_location("path")

        assert result == "/tmp/cache"

    def test_get_cache_location_with_none(self):
        """Test get_cache_location with None value."""
        parser = SettingsParser({"path": None})
        result = parser.get_cache_location("path")

        assert result is None

    def test_get_cache_location_with_missing_key(self):
        """Test get_cache_location with missing key."""
        parser = SettingsParser({})
        result = parser.get_cache_location("path")

        assert result is None

    def test_get_cache_location_with_empty_string(self):
        """Test get_cache_location with empty string returns None."""
        parser = SettingsParser({"path": ""})
        result = parser.get_cache_location("path")

        assert result is None

    def test_get_cache_location_with_invalid_value(self):
        """Test get_cache_location raises error with invalid value."""
        parser = SettingsParser({"path": 42})

        with pytest.raises(ValueError, match="Invalid cache location value"):
            parser.get_cache_location("path")


class TestToggleSetting:
    """Tests for the ToggleSetting dataclass."""

    def test_toggle_setting_creation(self):
        """Test creating a ToggleSetting."""
        setting = ToggleSetting(
            label="Enable Feature",
            key="feature_enabled",
            description="Enable or disable the feature",
        )

        assert setting.label == "Enable Feature"
        assert setting.key == "feature_enabled"
        assert setting.description == "Enable or disable the feature"
        assert setting.default is False
        assert setting.disabled is False
        assert setting.type == "toggle"

    def test_toggle_setting_with_custom_values(self):
        """Test ToggleSetting with custom values."""
        setting = ToggleSetting(
            label="Test",
            key="test_key",
            description="Test description",
            default=True,
            disabled=True,
        )

        assert setting.default is True
        assert setting.disabled is True


class TestDropdownSetting:
    """Tests for the DropdownSetting dataclass."""

    def test_dropdown_setting_creation(self):
        """Test creating a DropdownSetting."""
        options: list[DropdownOption] = [
            {"label": "Option 1", "value": "opt1"},
            {"label": "Option 2", "value": "opt2"},
        ]
        setting = DropdownSetting(
            label="Choose Option",
            key="option_key",
            description="Select an option",
            options=options,
            default="opt1",
        )

        assert setting.label == "Choose Option"
        assert setting.key == "option_key"
        assert setting.description == "Select an option"
        assert setting.options == options
        assert setting.default == "opt1"
        assert setting.disabled is False
        assert setting.type == "dropdown"


class TestNumberSetting:
    """Tests for the NumberSetting dataclass."""

    def test_number_setting_creation(self):
        """Test creating a NumberSetting."""
        setting = NumberSetting(
            label="Value",
            key="value_key",
            description="Set a value",
            min=0.0,
            max=100.0,
        )

        assert setting.label == "Value"
        assert setting.key == "value_key"
        assert setting.description == "Set a value"
        assert setting.min == 0.0
        assert setting.max == 100.0
        assert setting.default == 0
        assert setting.disabled is False
        assert setting.type == "number"

    def test_number_setting_with_custom_default(self):
        """Test NumberSetting with custom default."""
        setting = NumberSetting(
            label="Value",
            key="value_key",
            description="Set a value",
            min=0.0,
            max=100.0,
            default=50.0,
        )

        assert setting.default == 50.0


class TestCacheSetting:
    """Tests for the CacheSetting dataclass."""

    def test_cache_setting_creation(self):
        """Test creating a CacheSetting."""
        setting = CacheSetting(
            label="Cache Directory",
            key="cache_dir",
            description="Set cache directory",
            directory="/tmp",
        )

        assert setting.label == "Cache Directory"
        assert setting.key == "cache_dir"
        assert setting.description == "Set cache directory"
        assert setting.directory == "/tmp"
        assert setting.default == ""
        assert setting.disabled is False
        assert setting.type == "cache"

    def test_cache_setting_with_custom_default(self):
        """Test CacheSetting with custom default."""
        setting = CacheSetting(
            label="Cache",
            key="cache",
            description="Cache",
            directory="/tmp",
            default="/tmp/cache",
        )

        assert setting.default == "/tmp/cache"
