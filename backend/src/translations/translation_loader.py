import logging
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


class TranslationLoader:
    """Loads and manages translations from XML files stored next to nodes."""

    def __init__(self, language: str = "en"):
        """
        Initialize the translation loader.
        """
        self.language = language
        self.packages_root = Path(__file__).parent / "packages"
        self.translations: dict[str, dict[str, Any]] = {}
        self._load_all_translations()

    def _load_all_translations(self) -> None:
        """Load all translation files for the current language."""
        self._load_node_level_translations()

    def _load_node_level_translations(self) -> None:
        """Load translations stored alongside node implementations."""
        if not self.packages_root.exists():
            logger.debug("Packages root directory not found: %s", self.packages_root)
            return
        for translation_file in self.packages_root.glob("**/*.translations.xml"):
            try:
                self._parse_translation_file(translation_file)
            except Exception as e:
                logger.error(
                    "Error loading consolidated translation file %s: %s",
                    translation_file,
                    e,
                )

    def _parse_translation_file(self, file_path: Path) -> None:
        """Parse a consolidated translation XML file."""
        tree = ET.parse(file_path)
        root = tree.getroot()

        if root.tag != "translations":
            raise ValueError(f"Expected root element 'translations', got '{root.tag}'")

        node_id = root.get("id")
        if not node_id:
            raise ValueError("translations element must have an 'id' attribute")

        lang_element = root.find(f"language[@code='{self.language}']")
        if lang_element is None:
            logger.debug("Language '%s' not found in %s", self.language, file_path)
            return

        translation_data: dict[str, Any] = {}

        name_elem = lang_element.find("name")
        if name_elem is not None and name_elem.text:
            translation_data["name"] = name_elem.text

        desc_elem = lang_element.find("description")
        if desc_elem is not None and desc_elem.text:
            translation_data["description"] = desc_elem.text

        inputs_elem = lang_element.find("inputs")
        if inputs_elem is not None:
            translation_data["inputs"] = self._parse_io_elements(inputs_elem, "input")

        outputs_elem = lang_element.find("outputs")
        if outputs_elem is not None:
            translation_data["outputs"] = self._parse_io_elements(
                outputs_elem, "output"
            )

        if translation_data:
            self.translations[node_id] = translation_data
            logger.debug(
                "Loaded consolidated translation: %s (%s) -> %s",
                file_path,
                self.language,
                node_id,
            )

    def _parse_io_elements(
        self, parent_elem: ET.Element, element_tag: str
    ) -> dict[int, dict[str, str]]:
        """Parse input/output elements for translations."""
        io_translations: dict[int, dict[str, str]] = {}

        for io_elem in parent_elem.findall(element_tag):
            io_id_str = io_elem.get("id")
            if io_id_str is None:
                logger.warning("Missing 'id' attribute in <%s> element", element_tag)
                continue

            try:
                io_id = int(io_id_str)
            except ValueError:
                logger.warning(
                    "Invalid id '%s' in <%s> element (expected integer)",
                    io_id_str,
                    element_tag,
                )
                continue

            io_data: dict[str, str] = {}

            label_elem = io_elem.find("label")
            if label_elem is not None and label_elem.text:
                io_data["label"] = label_elem.text

            desc_elem = io_elem.find("description")
            if desc_elem is not None and desc_elem.text:
                io_data["description"] = desc_elem.text

            if io_data:
                io_translations[io_id] = io_data

        return io_translations

    def translate_node_schema(self, schema: dict[str, Any]) -> dict[str, Any]:
        """Apply translations to a given node schema."""
        schema_id = schema.get("schemaId")

        if not schema_id:
            return schema

        translation = self.translations.get(schema_id)

        if not translation:
            return schema

        if "name" in translation:
            schema["name"] = translation["name"]

        if "description" in translation:
            schema["description"] = translation["description"]

        if "inputs" in translation:
            input_translations = translation["inputs"]
            inputs = schema.get("inputs", [])

            for input_item in inputs:
                input_id = input_item.get("id")
                if input_id in input_translations:
                    input_trans = input_translations[input_id]
                    if "label" in input_trans:
                        input_item["label"] = input_trans["label"]
                    if "description" in input_trans:
                        input_item["description"] = input_trans["description"]

        if "outputs" in translation:
            output_translations = translation["outputs"]
            outputs = schema.get("outputs", [])

            for output_item in outputs:
                output_id = output_item.get("id")
                if output_id in output_translations:
                    output_trans = output_translations[output_id]
                    if "label" in output_trans:
                        output_item["label"] = output_trans["label"]
                    if "description" in output_trans:
                        output_item["description"] = output_trans["description"]

        return schema
