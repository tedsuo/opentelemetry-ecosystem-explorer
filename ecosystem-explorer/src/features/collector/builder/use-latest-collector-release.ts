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
import { useMemo } from "react";
import { useCollectorComponents, useCollectorVersions } from "@/hooks/use-collector-data";
import type { DataState } from "@/hooks/data-state";
import type { IndexComponent, VersionsIndex } from "@/types/collector";

export interface CollectorRelease {
  /** The release version, without a "v" prefix (e.g. "0.161.0"). */
  version: string;
  components: IndexComponent[];
}

/** A manifest takes all of its components from one release, so it needs both repositories'. */
const BUILD_DISTRIBUTIONS = ["core", "contrib"];

/**
 * The newest release that both core and contrib made. Core can release ahead of contrib, and
 * the latest release then lacks every contrib component. Data from before releases recorded
 * their distributions falls back to the latest release.
 */
export function selectBuildVersion(index: VersionsIndex | null | undefined): string {
  const releases = index?.versions ?? [];
  const complete = releases.find((release) =>
    BUILD_DISTRIBUTIONS.every((distribution) => release.distributions?.includes(distribution))
  );
  return (complete ?? releases.find((release) => release.is_latest) ?? releases[0])?.version ?? "";
}

/** The release every build targets (see selectBuildVersion), with all of its components. */
export function useLatestCollectorRelease(): DataState<CollectorRelease> {
  const versions = useCollectorVersions();
  const version = selectBuildVersion(versions.data);
  // Not "": that loads the active catalog, which mixes each distribution's latest release.
  const components = useCollectorComponents(version || null);
  // A stable object, so consumers can memoize work derived from it.
  const data = useMemo(
    () => (version && components.data ? { version, components: components.data } : null),
    [version, components.data]
  );

  if (versions.loading) return { data: null, loading: true, error: null };
  if (versions.error) return { data: null, loading: false, error: versions.error };
  if (!version) {
    return { data: null, loading: false, error: new Error("No Collector releases found") };
  }
  if (components.loading) return { data: null, loading: true, error: null };
  if (components.error) return { data: null, loading: false, error: components.error };
  return { data, loading: false, error: null };
}
