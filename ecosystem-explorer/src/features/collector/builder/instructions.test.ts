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
import { load } from "js-yaml";
import { describe, expect, it } from "vitest";
import {
  binaryPath,
  dockerBuildCommand,
  dockerRunCommand,
  dockerfile,
  githubWorkflow,
  localBuildCommand,
  localRunCommand,
  ocbInstallCommand,
  ocbReleaseUrl,
} from "./instructions";

const options = { name: "otelcol-custom", collectorVersion: "0.161.0" };

interface Workflow {
  on: { push: { paths: string[] } };
  jobs: { build: { steps: { uses?: string; run?: string; with?: Record<string, string> }[] } };
}

describe("local instructions", () => {
  it("pins OCB to the Collector version", () => {
    expect(ocbInstallCommand(options)).toBe(
      "go install go.opentelemetry.io/collector/cmd/builder@v0.161.0"
    );
    expect(ocbReleaseUrl("0.161.0")).toBe(
      "https://github.com/open-telemetry/opentelemetry-collector-releases/releases/tag/cmd%2Fbuilder%2Fv0.161.0"
    );
  });

  it("builds from the manifest and runs the binary OCB writes", () => {
    expect(localBuildCommand()).toBe("builder --config builder-config.yaml");
    expect(binaryPath(options)).toBe("_build/otelcol-custom");
    expect(localRunCommand(options)).toBe("./_build/otelcol-custom --config config.yaml");
  });
});

describe("docker instructions", () => {
  it("builds with the OCB image for the Collector version and runs on distroless", () => {
    const file = dockerfile(options);

    expect(file).toContain("FROM otel/opentelemetry-collector-builder:0.161.0 AS build");
    expect(file).toContain("RUN ocb --config builder-config.yaml");
    expect(file).toContain("COPY --from=build /home/ocb/_build/otelcol-custom /otelcol-custom");
    expect(file).toContain('ENTRYPOINT ["/otelcol-custom"]');
  });

  it("tags the image with the name and version, and mounts the config", () => {
    expect(dockerBuildCommand(options)).toBe("docker build -t otelcol-custom:0.161.0 .");
    expect(dockerRunCommand(options)).toBe(
      'docker run --rm -v "$(pwd)/config.yaml:/etc/otelcol/config.yaml" otelcol-custom:0.161.0'
    );
  });
});

describe("githubWorkflow", () => {
  const workflow = load(githubWorkflow(options)) as Workflow;
  const steps = workflow.jobs.build.steps;

  it("is valid YAML that builds when the manifest changes", () => {
    expect(workflow.on.push.paths).toEqual(["builder-config.yaml"]);
  });

  it("pins every action to a full commit SHA with a version comment", () => {
    const text = githubWorkflow(options);
    const uses = steps.flatMap((step) => (step.uses ? [step.uses] : []));

    expect(uses).toHaveLength(3);
    for (const ref of uses) {
      expect(ref).toMatch(/^[\w-]+\/[\w-]+@[0-9a-f]{40}$/);
      expect(text).toMatch(new RegExp(`uses: ${ref} # v\\d+\\.\\d+\\.\\d+`));
    }
  });

  it("installs the pinned OCB and uploads the binary", () => {
    const runs = steps.flatMap((step) => (step.run ? [step.run] : []));

    expect(runs).toEqual([ocbInstallCommand(options), localBuildCommand()]);
    expect(steps.at(-1)?.with).toEqual({ name: "otelcol-custom", path: "_build/otelcol-custom" });
  });
});
