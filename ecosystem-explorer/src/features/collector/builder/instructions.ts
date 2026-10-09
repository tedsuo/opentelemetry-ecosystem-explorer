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
import { BUILD_OUTPUT_PATH, MANIFEST_FILENAME } from "./manifest";

/*
 * The commands and files the build page tells users to run. Every OCB reference is pinned to
 * the build's Collector version, because OCB's strict versioning rejects components whose
 * minor version differs from the builder's own.
 */

export interface BuildInstructionOptions {
  /** The distribution's binary name. */
  name: string;
  /** The Collector release the build targets, without a "v" prefix (e.g. "0.161.0"). */
  collectorVersion: string;
}

export const GITHUB_WORKFLOW_PATH = ".github/workflows/build-collector.yaml";

/** The Collector config file the run commands point at. */
const CONFIG_FILENAME = "config.yaml";

const OUTPUT_DIR = BUILD_OUTPUT_PATH.replace(/^\.\//, "");

export function ocbReleaseUrl(collectorVersion: string): string {
  return `https://github.com/open-telemetry/opentelemetry-collector-releases/releases/tag/cmd%2Fbuilder%2Fv${collectorVersion}`;
}

/** `go install` names the binary after the package: `builder`, not `ocb`. */
export function ocbInstallCommand({ collectorVersion }: BuildInstructionOptions): string {
  return `go install go.opentelemetry.io/collector/cmd/builder@v${collectorVersion}`;
}

/** Where OCB writes the binary, relative to where it runs. */
export function binaryPath({ name }: BuildInstructionOptions): string {
  return `${OUTPUT_DIR}/${name}`;
}

export function localBuildCommand(): string {
  return `builder --config ${MANIFEST_FILENAME}`;
}

export function localRunCommand({ name }: BuildInstructionOptions): string {
  return `${BUILD_OUTPUT_PATH}/${name} --config ${CONFIG_FILENAME}`;
}

/** A two-stage build: OCB's own image compiles the Collector, distroless runs it. */
export function dockerfile({ name, collectorVersion }: BuildInstructionOptions): string {
  return [
    `FROM otel/opentelemetry-collector-builder:${collectorVersion} AS build`,
    `COPY ${MANIFEST_FILENAME} .`,
    `RUN ocb --config ${MANIFEST_FILENAME}`,
    "",
    "FROM gcr.io/distroless/static-debian13:nonroot",
    `COPY --from=build /home/ocb/${OUTPUT_DIR}/${name} /${name}`,
    `ENTRYPOINT ["/${name}"]`,
    `CMD ["--config", "/etc/otelcol/${CONFIG_FILENAME}"]`,
    "",
  ].join("\n");
}

export function dockerBuildCommand({ name, collectorVersion }: BuildInstructionOptions): string {
  return `docker build -t ${name}:${collectorVersion} .`;
}

export function dockerRunCommand({ name, collectorVersion }: BuildInstructionOptions): string {
  return `docker run --rm -v "$(pwd)/${CONFIG_FILENAME}:/etc/otelcol/${CONFIG_FILENAME}" ${name}:${collectorVersion}`;
}

/**
 * A workflow that builds the Collector when the manifest changes. Actions are pinned to
 * verified commit SHAs, matching this repository's own workflows; Renovate keeps the pins
 * current through a custom manager in `.github/renovate.json5`.
 */
export function githubWorkflow({ name, collectorVersion }: BuildInstructionOptions): string {
  return `name: Build OpenTelemetry Collector

on:
  push:
    paths:
      - ${MANIFEST_FILENAME}
  workflow_dispatch:

permissions:
  contents: read

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
      - uses: actions/setup-go@b7ad1dad31e06c5925ef5d2fc7ad053ef454303e # v7.0.0
        with:
          go-version: stable
          cache: false
      - name: Install OCB
        run: ${ocbInstallCommand({ name, collectorVersion })}
      - name: Build the Collector
        run: ${localBuildCommand()}
      - uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1
        with:
          name: ${name}
          path: ${OUTPUT_DIR}/${name}
`;
}
