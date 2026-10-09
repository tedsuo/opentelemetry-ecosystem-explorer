/*
 * Copyright The OpenTelemetry Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { describe, expect, it } from "vitest";
import type { IndexComponent } from "@/types/collector";
import {
  BuildImportError,
  distributionComponentIds,
  importCollectorConfig,
  importManifest,
} from "./importers";
import { RELEASE_COMPONENTS } from "./test-fixtures";

function reasonOf(run: () => unknown): string | undefined {
  try {
    run();
  } catch (error) {
    if (error instanceof BuildImportError) return error.reason;
    throw error;
  }
  return undefined;
}

describe("importManifest", () => {
  const manifest = `
dist:
  name: otelcol-edge
  output_path: ./_build
receivers:
  - gomod: go.opentelemetry.io/collector/receiver/otlpreceiver v0.150.0
  - gomod: github.com/example/acme/receiver/acmereceiver v1.2.3
processors:
  - gomod: github.com/open-telemetry/opentelemetry-collector-contrib/processor/k8sattributesprocessor v0.160.0
exporters:
  - gomod: go.opentelemetry.io/collector/exporter/otlpexporter v0.150.0
  - gomod: go.opentelemetry.io/collector/exporter/otlpexporter v0.150.0
extensions:
  - gomod: github.com/open-telemetry/opentelemetry-collector-contrib/extension/storage/filestorage v0.150.0
providers:
  - gomod: go.opentelemetry.io/collector/confmap/provider/envprovider v1.56.0
`;

  it("matches components by module path, whatever version the manifest pins", () => {
    const result = importManifest(manifest, RELEASE_COMPONENTS);

    expect(result.componentIds).toEqual([
      "core-otlpreceiver",
      "contrib-k8sattributesprocessor",
      "core-otlpexporter",
      "contrib-filestorage",
    ]);
  });

  it("reports modules it doesn't recognize, but not providers", () => {
    const result = importManifest(manifest, RELEASE_COMPONENTS);

    expect(result.unrecognized).toEqual(["github.com/example/acme/receiver/acmereceiver v1.2.3"]);
  });

  it("reads a valid dist.name", () => {
    expect(importManifest(manifest, RELEASE_COMPONENTS).name).toBe("otelcol-edge");
  });

  it("ignores a dist.name that isn't a valid build name", () => {
    const result = importManifest(
      "dist:\n  name: Not Valid\nreceivers:\n  - gomod: go.opentelemetry.io/collector/receiver/otlpreceiver v0.161.0\n",
      RELEASE_COMPONENTS
    );

    expect(result.name).toBeUndefined();
    expect(result.componentIds).toEqual(["core-otlpreceiver"]);
  });

  it("rejects a Collector config pasted in by mistake", () => {
    expect(reasonOf(() => importManifest("receivers:\n  otlp: {}\n", RELEASE_COMPONENTS))).toBe(
      "no-components"
    );
  });
});

describe("importCollectorConfig", () => {
  const config = `
extensions:
  file_storage: {}
receivers:
  otlp:
    protocols:
      grpc: {}
  acme/primary: {}
  acme/secondary: {}
processors:
  batch: {}
  k8sattributes: {}
exporters:
  otlp: {}
  otlp_grpc/backup: {}
connectors:
  forward: {}
service:
  extensions: [file_storage]
  pipelines:
    traces:
      receivers: [otlp]
      exporters: [otlp]
`;

  it("maps component IDs to components by type, including deprecated keys", () => {
    const result = importCollectorConfig(config, RELEASE_COMPONENTS);

    expect(result.componentIds).toEqual([
      "core-otlpreceiver",
      "core-batchprocessor",
      "contrib-k8sattributesprocessor",
      "core-otlpexporter",
      "core-forwardconnector",
      "contrib-filestorage",
    ]);
  });

  it("reports each unknown component type once", () => {
    expect(importCollectorConfig(config, RELEASE_COMPONENTS).unrecognized).toEqual([
      "receivers: acme",
    ]);
  });

  it("prefers a current key over another component's deprecated alias", () => {
    const renamed: IndexComponent = {
      id: "contrib-oldnameprocessor",
      name: "oldnameprocessor",
      distribution: "contrib",
      type: "processor",
      config_type: "old_name",
      deprecated_config_type: "batch",
    };

    const result = importCollectorConfig("processors:\n  batch: {}\n", [
      renamed,
      ...RELEASE_COMPONENTS,
    ]);

    expect(result.componentIds).toEqual(["core-batchprocessor"]);
  });

  it("resolves YAML anchors and merge keys", () => {
    const result = importCollectorConfig(
      "base: &base\n  batch: {}\nprocessors:\n  <<: *base\n",
      RELEASE_COMPONENTS
    );

    expect(result.componentIds).toEqual(["core-batchprocessor"]);
  });

  it("rejects a file with no component sections", () => {
    expect(reasonOf(() => importCollectorConfig("service: {}\n", RELEASE_COMPONENTS))).toBe(
      "no-components"
    );
  });
});

describe("unparseable input", () => {
  it.each([
    ["empty", "   \n"],
    ["invalid-yaml", "receivers: [unclosed"],
    ["not-a-mapping", "- just\n- a list\n"],
  ])("raises %s", (reason, text) => {
    expect(reasonOf(() => importManifest(text, RELEASE_COMPONENTS))).toBe(reason);
    expect(reasonOf(() => importCollectorConfig(text, RELEASE_COMPONENTS))).toBe(reason);
  });
});

describe("distributionComponentIds", () => {
  it("lists components that declare membership in a distribution", () => {
    expect(distributionComponentIds("otlp", RELEASE_COMPONENTS)).toEqual([
      "core-otlpreceiver",
      "core-otlpexporter",
    ]);
  });
});
