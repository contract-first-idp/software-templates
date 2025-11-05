import json
import pathlib
import shutil
import subprocess
import tempfile
from typing import Iterable

import pytest

yaml = pytest.importorskip("yaml")

BACKSTAGE_RENDERER = pathlib.Path(__file__).with_name("run_backstage_renderer.cjs")
BACKSTAGE_SKIP_CODE = 64


def render_template_directory(template_dir: pathlib.Path, *, values: dict) -> None:
    node_executable = shutil.which("node")
    if node_executable is None:
        pytest.skip("Node.js is required to execute the Backstage renderer")

    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="utf-8") as handle:
        json.dump(values, handle)
        handle.flush()
        context_path = pathlib.Path(handle.name)

    try:
        result = subprocess.run(
            [node_executable, str(BACKSTAGE_RENDERER), str(template_dir), str(context_path)],
            check=False,
            capture_output=True,
            text=True,
        )
    finally:
        context_path.unlink(missing_ok=True)

    if result.returncode == BACKSTAGE_SKIP_CODE:
        message = result.stderr.strip() or "Backstage renderer not available"
        pytest.skip(message)

    if result.returncode != 0:
        raise AssertionError(
            "Backstage renderer failed with exit code"
            f" {result.returncode}\nSTDOUT:\n{result.stdout}\nSTDERR:\n{result.stderr}"
        )


REPO_ROOT = pathlib.Path(__file__).resolve().parents[1]
TEMPLATE_FILES = sorted(REPO_ROOT.glob("templates/*/template.yaml"))


JAVA_COMPONENT_RENDER_VALUES = {
    "component_id": "order-service",
    "description": "Handles customer orders",
    "owner": "group:default/team-a",
    "system_name": "supply-chain",
    "system_ref": "system:default/supply-chain",
    "git_org": "demo-org",
    "openshift_cluster_domain": "example.com",
    "service_registry_provider_url": "https://registry-apicurio-registry.example.com",
    "service_registry_group_id": "com.demo.supplychain",
    "java_group_id": "com.demo.supplychain",
    "java_package": "com.demo.supplychain.orderservice",
    "folder_java_package": "com/demo/supplychain/orderservice",
    "api_name": "orders-api",
    "implements_api": True,
    "consumes_apis": True,
    "consumed_api_name": "payments-api",
    "consumed_api_operation": "createPayment",
}

JAVA_SYSTEM_RENDER_VALUES = {
    "component_id": JAVA_COMPONENT_RENDER_VALUES["component_id"],
    "system_name": JAVA_COMPONENT_RENDER_VALUES["system_name"],
    "git_org": JAVA_COMPONENT_RENDER_VALUES["git_org"],
    "deployment": "order-service-deployment",
}

OPENAPI_RENDER_VALUES = {
    "api_id": "orders",
    "description": "Order API",
    "owner": JAVA_COMPONENT_RENDER_VALUES["owner"],
    "git_repo_url": "https://github.com/demo-org/supply-chain-orders-api",
    "system_name": JAVA_COMPONENT_RENDER_VALUES["system_name"],
    "service_registry_provider_url": JAVA_COMPONENT_RENDER_VALUES["service_registry_provider_url"],
    "service_registry_group_id": JAVA_COMPONENT_RENDER_VALUES["service_registry_group_id"],
    "mock_provider_url": "https://microcks.example.com",
    "specification_content": "paths: {}\nschemas: {}",
}

SYSTEM_RENDER_VALUES = {
    "system_name": JAVA_COMPONENT_RENDER_VALUES["system_name"],
    "description": "Golden path system for supply-chain",
    "owner": JAVA_COMPONENT_RENDER_VALUES["owner"],
    "git_org": JAVA_COMPONENT_RENDER_VALUES["git_org"],
}

TEMPLATE_RENDER_CONTEXT = {
    "openapi-specification": {
        "api-template": OPENAPI_RENDER_VALUES,
        "system-template": {
            "git_org": JAVA_COMPONENT_RENDER_VALUES["git_org"],
            "api_id": OPENAPI_RENDER_VALUES["api_id"],
            "system_name": OPENAPI_RENDER_VALUES["system_name"],
            "service_registry_provider_url": OPENAPI_RENDER_VALUES["service_registry_provider_url"],
            "service_registry_group_id": OPENAPI_RENDER_VALUES["service_registry_group_id"],
            "mock_provider_url": OPENAPI_RENDER_VALUES["mock_provider_url"],
        },
    },
    "quarkus-camel-openapi": {
        "component-template": {
            **JAVA_COMPONENT_RENDER_VALUES,
            "service_registry_provider_url": JAVA_COMPONENT_RENDER_VALUES["service_registry_provider_url"],
            "service_registry_group_id": JAVA_COMPONENT_RENDER_VALUES["service_registry_group_id"],
        },
        "system-template": JAVA_SYSTEM_RENDER_VALUES,
    },
    "quarkus-camel-openapi-yaml": {
        "component-template": {
            **JAVA_COMPONENT_RENDER_VALUES,
            "service_registry_provider_url": JAVA_COMPONENT_RENDER_VALUES["service_registry_provider_url"],
            "service_registry_group_id": JAVA_COMPONENT_RENDER_VALUES["service_registry_group_id"],
        },
        "system-template": JAVA_SYSTEM_RENDER_VALUES,
    },
    "spring-boot-camel-openapi": {
        "component-template": {
            **JAVA_COMPONENT_RENDER_VALUES,
            "service_registry_provider_url": JAVA_COMPONENT_RENDER_VALUES["service_registry_provider_url"],
            "service_registry_group_id": JAVA_COMPONENT_RENDER_VALUES["service_registry_group_id"],
        },
        "system-template": {
            key: value for key, value in JAVA_SYSTEM_RENDER_VALUES.items() if key != "deployment"
        },
    },
    "spring-boot-openapi": {
        "component-template": JAVA_COMPONENT_RENDER_VALUES,
        "system-template": {
            key: value for key, value in JAVA_SYSTEM_RENDER_VALUES.items() if key != "deployment"
        },
    },
    "system": {
        "system-template": SYSTEM_RENDER_VALUES,
        "domain-template": {
            "system_name": SYSTEM_RENDER_VALUES["system_name"],
            "description": SYSTEM_RENDER_VALUES["description"],
            "owner": SYSTEM_RENDER_VALUES["owner"],
            "git_org": SYSTEM_RENDER_VALUES["git_org"],
        },
    },
}


def load_template(template_path: pathlib.Path) -> tuple[dict, pathlib.Path]:
    with template_path.open("r", encoding="utf-8") as handle:
        data = yaml.safe_load(handle.read())
    return data, template_path.parent


@pytest.mark.parametrize("template_path", TEMPLATE_FILES, ids=lambda p: p.parent.name)
def test_template_yaml_is_well_formed(template_path: pathlib.Path) -> None:
    template, _ = load_template(template_path)

    assert template.get("apiVersion"), "Templates must declare an apiVersion"
    assert template.get("kind") == "Template", "Templates must be of kind Template"
    assert "spec" in template, "Templates must include a spec section"


@pytest.mark.parametrize("template_path", TEMPLATE_FILES, ids=lambda p: p.parent.name)
def test_required_parameters_are_declared(template_path: pathlib.Path) -> None:
    template, _ = load_template(template_path)
    parameters: Iterable[dict] = template.get("spec", {}).get("parameters", [])

    for section in parameters:
        properties = section.get("properties", {})
        for required_key in section.get("required", []):
            assert (
                required_key in properties
            ), f"Required parameter '{required_key}' missing property definition"


@pytest.mark.parametrize("template_path", TEMPLATE_FILES, ids=lambda p: p.parent.name)
def test_step_ids_are_unique(template_path: pathlib.Path) -> None:
    template, _ = load_template(template_path)
    steps: Iterable[dict] = template.get("spec", {}).get("steps", [])

    step_ids = [step.get("id") for step in steps if "id" in step]
    assert step_ids, "Every template must declare at least one step id"
    assert len(step_ids) == len(set(step_ids)), "Step ids must be unique"


@pytest.mark.parametrize("template_path", TEMPLATE_FILES, ids=lambda p: p.parent.name)
def test_fetch_template_sources_exist(template_path: pathlib.Path) -> None:
    template, template_dir = load_template(template_path)
    steps: Iterable[dict] = template.get("spec", {}).get("steps", [])

    for step in steps:
        if step.get("action") != "fetch:template":
            continue

        url = step.get("input", {}).get("url")
        assert url, "fetch:template steps must declare a url"

        if not url.startswith("./"):
            # Remote templates are outside the scope of these tests.
            continue

        relative_path = url[2:]
        candidate = (template_dir / relative_path).resolve()

        try:
            candidate.relative_to(template_dir.resolve())
        except ValueError as exc:  # pragma: no cover - defensive guard
            raise AssertionError(
                f"fetch:template url '{url}' escapes its template directory"
            ) from exc

        assert (
            candidate.exists()
        ), f"fetch:template url '{url}' does not exist within the template directory"


@pytest.mark.parametrize("template_path", TEMPLATE_FILES, ids=lambda p: p.parent.name)
def test_fetch_template_steps_render_successfully(template_path: pathlib.Path) -> None:
    template, template_dir = load_template(template_path)
    render_context = TEMPLATE_RENDER_CONTEXT.get(template_dir.name, {})
    steps: Iterable[dict] = template.get("spec", {}).get("steps", [])

    for step in steps:
        if step.get("action") != "fetch:template":
            continue

        url = step.get("input", {}).get("url")
        if not url or not url.startswith("./"):
            continue

        step_id = step.get("id")
        assert step_id, "fetch:template steps must define an id"
        assert (
            step_id in render_context
        ), f"No render context defined for template '{template_dir.name}' step '{step_id}'"

        template_root = (template_dir / url[2:]).resolve()
        render_template_directory(template_root, values=render_context[step_id])
