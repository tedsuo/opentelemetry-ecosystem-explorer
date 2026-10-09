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
import { load as loadYaml, CORE_SCHEMA, mergeTag } from "js-yaml";
import { isValidBuildName } from "@/hooks/use-collector-build";
import { isPlainObject } from "@/lib/value-guards";
import type { IndexComponent } from "@/types/collector";
import { MANIFEST_SECTIONS } from "./manifest";

export type BuildImportErrorReason = "empty" | "invalid-yaml" | "not-a-mapping" | "no-components";

/** A pasted file that can't be imported at all, as opposed to one with unrecognized entries. */
export class BuildImportError extends Error {
  reason: BuildImportErrorReason;

  constructor(reason: BuildImportErrorReason, options?: ErrorOptions) {
    super(`Cannot import file: ${reason}`, options);
    this.name = "BuildImportError";
    this.reason = reason;
  }
}

export interface BuildImportResult {
  /** IDs of the recognized components without duplicates, section by section in pipeline order. */
  componentIds: string[];
  /** Entries that match no component of the release, as written in the file. */
  unrecognized: string[];
  /** The manifest's `dist.name`, when it is a valid build name. */
  name?: string;
}

function parseDocument(text: string): Record<string, unknown> {
  if (text.trim() === "") throw new BuildImportError("empty");
  let value: unknown;
  try {
    // Same options as the configuration builder: merge keys (`<<`) resolve, alias expansion is bounded.
    value = loadYaml(text, {
      schema: CORE_SCHEMA.withTags(mergeTag),
      maxAliases: 100,
      maxTotalMergeKeys: 10000,
    });
  } catch (cause) {
    throw new BuildImportError("invalid-yaml", { cause });
  }
  if (!isPlainObject(value)) throw new BuildImportError("not-a-mapping");
  return value;
}

function collect() {
  const componentIds: string[] = [];
  const unrecognized: string[] = [];
  return {
    componentIds,
    unrecognized,
    add: (id: string) => {
      if (!componentIds.includes(id)) componentIds.push(id);
    },
    report: (entry: string) => {
      if (!unrecognized.includes(entry)) unrecognized.push(entry);
    },
  };
}

/**
 * Reads the components out of an OCB manifest by matching each `gomod` module path.
 * Providers, converters and `replaces` aren't components, so they're not read.
 */
export function importManifest(
  text: string,
  releaseComponents: readonly IndexComponent[]
): BuildImportResult {
  const document = parseDocument(text);
  const idByModule = new Map<string, string>();
  for (const component of releaseComponents) {
    if (component.go_module) idByModule.set(component.go_module, component.id);
  }

  const result = collect();
  let foundSection = false;
  for (const { section } of MANIFEST_SECTIONS) {
    const entries = document[section];
    if (!Array.isArray(entries)) continue;
    foundSection = true;
    for (const entry of entries) {
      const gomod =
        isPlainObject(entry) && typeof entry.gomod === "string" ? entry.gomod.trim() : "";
      if (!gomod) continue;
      const id = idByModule.get(gomod.split(/\s+/)[0]);
      if (id) {
        result.add(id);
      } else {
        result.report(gomod);
      }
    }
  }
  if (!foundSection) throw new BuildImportError("no-components");

  const { dist } = document;
  const name =
    isPlainObject(dist) && typeof dist.name === "string" && isValidBuildName(dist.name)
      ? dist.name
      : undefined;
  return { componentIds: result.componentIds, unrecognized: result.unrecognized, name };
}

/**
 * Reads the components a Collector config file configures. A component ID such as
 * `otlp/internal` is `type[/name]`, and the type is unique within each section.
 */
export function importCollectorConfig(
  text: string,
  releaseComponents: readonly IndexComponent[]
): BuildImportResult {
  const document = parseDocument(text);
  const idByKey = new Map<string, string>();
  // Deprecated keys first, so a current key always wins if a rename ever reused one.
  for (const field of ["deprecated_config_type", "config_type"] as const) {
    for (const component of releaseComponents) {
      const key = component[field];
      if (key) idByKey.set(`${component.type}:${key}`, component.id);
    }
  }

  const result = collect();
  let foundSection = false;
  for (const { type, section } of MANIFEST_SECTIONS) {
    const entries = document[section];
    if (!isPlainObject(entries)) continue;
    foundSection = true;
    for (const componentId of Object.keys(entries)) {
      const configType = componentId.split("/")[0];
      const id = idByKey.get(`${type}:${configType}`);
      if (id) {
        result.add(id);
      } else {
        result.report(`${section}: ${configType}`);
      }
    }
  }
  if (!foundSection) throw new BuildImportError("no-components");
  return { componentIds: result.componentIds, unrecognized: result.unrecognized };
}

/**
 * The official Collector distributions, keyed by the tag components declare membership with
 * in `status.distributions`. The otelcol-ebpf-profiler distribution is absent: no component
 * declares it, and its receiver lives outside the core and contrib repositories.
 */
export const DISTRIBUTIONS = [
  { name: "otelcol", tag: "core" },
  { name: "otelcol-contrib", tag: "contrib" },
  { name: "otelcol-k8s", tag: "k8s" },
  { name: "otelcol-otlp", tag: "otlp" },
] as const;

export type DistributionName = (typeof DISTRIBUTIONS)[number]["name"];

/** IDs of the release's components that declare membership in the distribution with this tag. */
export function distributionComponentIds(
  tag: string,
  releaseComponents: readonly IndexComponent[]
): string[] {
  return releaseComponents
    .filter((component) => component.distributions?.includes(tag))
    .map((component) => component.id);
}
