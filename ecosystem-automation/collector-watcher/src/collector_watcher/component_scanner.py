# Copyright The OpenTelemetry Authors
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     https://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#
"""Scanner for discovering OpenTelemetry Collector components.

This module scans collector repository directories to identify components
and extract their metadata from metadata.yaml files.
"""

from pathlib import Path
from typing import Any

import yaml

from .metadata_parser import MetadataParser
from .type_defs import COMPONENT_TYPES


class ComponentScanner:
    """Scans collector repositories for components."""

    # These directories are handled separately as nested component directories
    # or are utility packages that aren't actual components
    EXCLUDED_DIRECTORIES = [
        "extensionauth",  # Auth helpers for extensions
        "extensioncapabilities",  # Capabilities framework
        "extensionmiddleware",  # Middleware framework
        "opampcustommessages",  # OpAMP utilities
        "dbauth",  # Database auth interface
    ]

    EXCLUDED_COMPONENTS = [
        "endpointswatcher",  # Utility component for watching endpoints, not a component
    ]

    # Directories that contain nested components (subtypes)
    NESTED_COMPONENT_DIRS = {"encoding", "observer", "storage"}

    def __init__(self, repo_path: str):
        """
        Args:
            repo_path: Path to the cloned repository
        """
        self.repo_path = Path(repo_path)
        if not self.repo_path.exists():
            raise ValueError(f"Repository path does not exist: {repo_path}")
        self._module_versions = self._load_module_versions()

    def _load_module_versions(self) -> dict[str, str]:
        """
        Map each Go module path to its release version, from the repository's versions.yaml.

        Collector repositories release their modules in sets with independent versions (for
        example contrib's ``stable-base`` set at v1.x alongside ``contrib-base`` at v0.x), so a
        component's module version cannot be inferred from the release tag.

        Returns:
            Dictionary mapping module path to version (e.g. "v0.161.0"), empty when the
            repository has no readable versions.yaml
        """
        versions_file = self.repo_path / "versions.yaml"
        if not versions_file.is_file():
            return {}
        try:
            data = yaml.safe_load(versions_file.read_text(encoding="utf-8")) or {}
        except yaml.YAMLError:
            return {}

        module_sets = data.get("module-sets") if isinstance(data, dict) else None
        if not isinstance(module_sets, dict):
            return {}

        versions = {}
        for module_set in module_sets.values():
            if not isinstance(module_set, dict):
                continue
            version = module_set.get("version")
            modules = module_set.get("modules")
            if not isinstance(version, str) or not isinstance(modules, list):
                continue
            for module in modules:
                if isinstance(module, str):
                    versions[module] = version
        return versions

    @staticmethod
    def _read_go_module_path(component_path: Path) -> str | None:
        """
        Read the module path declared by a component directory's own go.mod.

        Args:
            component_path: Path to the component directory

        Returns:
            The module path, or None when the directory has no go.mod or it declares no module
        """
        go_mod = component_path / "go.mod"
        if not go_mod.is_file():
            return None
        for line in go_mod.read_text(encoding="utf-8").splitlines():
            parts = line.split("//", 1)[0].split()
            if len(parts) == 2 and parts[0] == "module":
                return parts[1].strip('"')
        return None

    def scan_all_components(self) -> dict[str, list[dict[str, Any]]]:
        """
        Scan all component types and return structured inventory.

        Returns:
            Dictionary mapping component types to lists of component info
        """
        components = {}
        for component_type in COMPONENT_TYPES:
            components[component_type] = self.scan_component_type(component_type)
        return components

    def scan_component_type(self, component_type: str) -> list[dict[str, Any]]:
        """
        Scan a specific component type directory.

        Args:
            component_type: Type of component (receiver, processor, exporter etc.)

        Returns:
            List of dictionaries containing component information
        """
        component_dir = self.repo_path / component_type
        if not component_dir.exists():
            return []

        components = []
        for item in sorted(component_dir.iterdir()):
            if item.is_dir():
                # Check if this is a nested component directory (e.g., extension/encoding)
                if item.name in self.NESTED_COMPONENT_DIRS:
                    nested_components = self._scan_nested_components(item, component_type, item.name)
                    components.extend(nested_components)
                elif self._is_component_directory(item):
                    component_info = self._extract_component_info(item, component_type)
                    if component_info is not None:
                        components.append(component_info)

        return components

    def _scan_nested_components(self, nested_dir: Path, component_type: str, subtype: str) -> list[dict[str, Any]]:
        """
        Scan a nested component directory (e.g., extension/encoding).

        Args:
            nested_dir: Path to the nested directory
            component_type: Type of component (e.g., extension)
            subtype: Subtype name (e.g., encoding, observer, storage)

        Returns:
            List of component dictionaries with subtype field set
        """
        components = []
        for item in sorted(nested_dir.iterdir()):
            if item.is_dir() and self._is_nested_component_directory(item):
                component_info = self._extract_component_info(item, component_type, subtype=subtype)
                if component_info is not None:
                    components.append(component_info)
        return components

    def _is_valid_component_name(self, path: Path) -> bool:
        """
        Check if a directory name is valid for a component.

        Excludes hidden, private, internal, test, and utility directories.

        Args:
            path: Path to check

        Returns:
            True if the directory name is valid
        """
        if path.name.startswith(".") or path.name.startswith("_"):
            return False
        if path.name in ["internal", "testdata"]:
            return False
        if path.name.endswith("test") or path.name.endswith("helper"):
            return False
        for excluded in self.EXCLUDED_COMPONENTS:
            if path.name == excluded:
                return False
        return True

    def _has_go_code(self, path: Path) -> bool:
        """
        Check if a directory contains Go code.

        Args:
            path: Path to check

        Returns:
            True if directory has go.mod or .go files
        """
        has_go_mod = (path / "go.mod").exists()
        # Use next() to short-circuit and avoid scanning entire directory
        has_go_files = next(path.glob("*.go"), None) is not None
        return has_go_mod or has_go_files

    def _is_nested_component_directory(self, path: Path) -> bool:
        """
        Check if a directory is a valid nested component.

        Similar to _is_component_directory but for nested components.

        Args:
            path: Path to check

        Returns:
            True if this appears to be a nested component directory
        """
        return self._is_valid_component_name(path) and self._has_go_code(path)

    def _is_component_directory(self, path: Path) -> bool:
        """
        Check if a directory is a valid component.

        A valid component directory typically contains go.mod or .go files,
        and excludes internal/test/utility directories.

        Args:
            path: Path to check

        Returns:
            True if this appears to be a component directory
        """
        if not self._is_valid_component_name(path):
            return False

        if path.name in self.EXCLUDED_DIRECTORIES:
            return False

        # Nested component directories are handled separately
        if path.name in self.NESTED_COMPONENT_DIRS:
            return False

        return self._has_go_code(path)

    def _extract_component_info(
        self, component_path: Path, component_type: str, subtype: str | None = None
    ) -> dict[str, Any] | None:
        """
        Extract information about a component.

        Args:
            component_path: Path to the component directory
            component_type: Type of component
            subtype: Optional subtype (e.g., "encoding", "observer", "storage")

        Returns:
            Dictionary with component information, or None if the upstream metadata's
            ``status.class`` identifies this directory as something other than a real
            component of ``component_type`` (e.g. an internal ``pkg`` interface package)
            and should be skipped rather than cataloged.
        """
        parser = MetadataParser(component_path)
        has_metadata = parser.has_metadata()

        component_info = {
            "name": component_path.name,
        }

        # Add subtype if this is a nested component
        if subtype:
            component_info["subtype"] = subtype

        # The module path and version are what an OCB manifest's `gomod` entry needs
        go_module = self._read_go_module_path(component_path)
        if go_module:
            component_info["go_module"] = go_module
            module_version = self._module_versions.get(go_module)
            if module_version:
                component_info["go_module_version"] = module_version

        if has_metadata:
            parsed_metadata = parser.parse()
            if parsed_metadata:
                if not self._matches_component_type(parsed_metadata, component_type):
                    return None
                component_info["metadata"] = parsed_metadata
            else:
                component_info["has_metadata"] = False
        else:
            component_info["has_metadata"] = False

        return component_info

    @staticmethod
    def _matches_component_type(parsed_metadata: dict[str, Any], component_type: str) -> bool:
        """
        Check whether parsed metadata's ``status.class`` is consistent with the directory
        it was found in, rather than an internal interface package (upstream ``class: pkg``,
        or ``cmd``/``scraper``/``converter``/``provider``) that happens to live under a
        component-type directory.

        Nested/subtype components (e.g. ``extension/storage/filestorage``) declare
        ``status.class`` equal to their *parent* type ("extension"), not their subtype
        ("storage"), so comparing against ``component_type`` is correct for those too.

        A missing ``status`` or ``status.class`` is treated as a match (fail-open): the
        upstream schema documents ``class`` as optional for subcomponents, and the scanner
        must not exclude a real component just because it lacks this field.

        Args:
            parsed_metadata: The parsed metadata.yaml content.
            component_type: The directory-derived component type (e.g. "receiver").

        Returns:
            False only when ``status.class`` is present and differs from ``component_type``.
        """
        status = parsed_metadata.get("status")
        if not isinstance(status, dict):
            return True
        status_class = status.get("class")
        if status_class is None:
            return True
        return status_class == component_type
