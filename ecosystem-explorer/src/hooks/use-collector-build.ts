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
import { useSyncExternalStore } from "react";

/*
 * The Collector Builder's build (its "cart"): a distribution name plus the IDs of the
 * components the user picked. The build is anonymous and lives only in this browser's
 * localStorage; nothing is sent to or stored on a server.
 *
 * A module-level store rather than a React context, because the header cart link, list
 * rows, detail pages and builder pages all read it, and they render in different parts of
 * both route trees. Every change is written synchronously, so an "Add" immediately followed
 * by navigation is never lost, and the `storage` event keeps other open tabs in sync.
 */

export const DEFAULT_BUILD_NAME = "otelcol-custom";

const STORAGE_KEY = "explorer:collectorBuild:v1";

export interface CollectorBuild {
  /** The distribution's binary name, written to the manifest's `dist.name`. */
  name: string;
  /** IDs of the picked components (e.g. "core-otlpreceiver"), in the order they were added. */
  componentIds: string[];
}

const EMPTY_BUILD: CollectorBuild = { name: DEFAULT_BUILD_NAME, componentIds: [] };

const listeners = new Set<() => void>();

// Serves reads once storage proves unusable (private browsing quotas, disabled storage).
let memoryBuild: CollectorBuild = EMPTY_BUILD;
let storageUnavailable = false;

// useSyncExternalStore needs a stable snapshot between changes, so parsing is cached per
// raw stored value.
let cachedRaw: string | null | undefined;
let cachedBuild: CollectorBuild = EMPTY_BUILD;

function parseBuild(raw: string | null): CollectorBuild {
  if (!raw) return EMPTY_BUILD;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return EMPTY_BUILD;
    const { name, componentIds } = value as Record<string, unknown>;
    return {
      name: typeof name === "string" ? name : DEFAULT_BUILD_NAME,
      componentIds: Array.isArray(componentIds)
        ? [...new Set(componentIds.filter((id): id is string => typeof id === "string"))]
        : [],
    };
  } catch {
    return EMPTY_BUILD;
  }
}

function getSnapshot(): CollectorBuild {
  if (storageUnavailable) return memoryBuild;
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    storageUnavailable = true;
    return memoryBuild;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedBuild = parseBuild(raw);
  }
  return cachedBuild;
}

function emitChange() {
  listeners.forEach((listener) => listener());
}

function onStorage(event: StorageEvent) {
  // A null key means another tab cleared all of this origin's storage.
  if (event.key === STORAGE_KEY || event.key === null) emitChange();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

function updateBuild(change: (build: CollectorBuild) => CollectorBuild) {
  const next = change(getSnapshot());
  memoryBuild = next;
  if (!storageUnavailable) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      storageUnavailable = true;
    }
  }
  emitChange();
}

export const collectorBuildActions = {
  addComponents(ids: string[]) {
    updateBuild((build) => ({
      ...build,
      componentIds: [...new Set([...build.componentIds, ...ids])],
    }));
  },
  removeComponent(id: string) {
    updateBuild((build) => ({
      ...build,
      componentIds: build.componentIds.filter((existing) => existing !== id),
    }));
  },
  toggleComponent(id: string) {
    updateBuild((build) => ({
      ...build,
      componentIds: build.componentIds.includes(id)
        ? build.componentIds.filter((existing) => existing !== id)
        : [...build.componentIds, id],
    }));
  },
  setName(name: string) {
    updateBuild((build) => ({ ...build, name }));
  },
  /** Empties the build but keeps its name. */
  clearComponents() {
    updateBuild((build) => ({ ...build, componentIds: [] }));
  },
};

/** The current build plus actions to change it. Re-renders whenever the build changes. */
export function useCollectorBuild(): CollectorBuild & typeof collectorBuildActions {
  const build = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY_BUILD);
  return { ...build, ...collectorBuildActions };
}

// The name becomes the binary's file name and the Docker image name in the build
// instructions, so it follows Docker's stricter rules: lowercase, single separators.
const BUILD_NAME_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;

export function isValidBuildName(name: string): boolean {
  return BUILD_NAME_PATTERN.test(name);
}
