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
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_BUILD_NAME, isValidBuildName, useCollectorBuild } from "./use-collector-build";

const STORAGE_KEY = "explorer:collectorBuild:v1";

function stored(): unknown {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
}

describe("useCollectorBuild", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("starts as an empty build with the default name", () => {
    const { result } = renderHook(() => useCollectorBuild());

    expect(result.current.name).toBe(DEFAULT_BUILD_NAME);
    expect(result.current.componentIds).toEqual([]);
  });

  it("adds components without duplicates, in the order they were added", () => {
    const { result } = renderHook(() => useCollectorBuild());

    act(() => result.current.addComponents(["core-otlpreceiver", "core-otlpexporter"]));
    act(() => result.current.addComponents(["core-otlpexporter", "core-batchprocessor"]));

    expect(result.current.componentIds).toEqual([
      "core-otlpreceiver",
      "core-otlpexporter",
      "core-batchprocessor",
    ]);
  });

  it("toggles and removes components", () => {
    const { result } = renderHook(() => useCollectorBuild());

    act(() => result.current.toggleComponent("core-otlpreceiver"));
    act(() => result.current.toggleComponent("core-otlpexporter"));
    act(() => result.current.toggleComponent("core-otlpreceiver"));
    expect(result.current.componentIds).toEqual(["core-otlpexporter"]);

    act(() => result.current.removeComponent("core-otlpexporter"));
    expect(result.current.componentIds).toEqual([]);
  });

  it("writes every change to localStorage immediately", () => {
    const { result } = renderHook(() => useCollectorBuild());

    act(() => result.current.addComponents(["core-otlpreceiver"]));
    act(() => result.current.setName("otelcol-edge"));

    // No timers to flush: a navigation right after a change must not lose it.
    expect(stored()).toEqual({ name: "otelcol-edge", componentIds: ["core-otlpreceiver"] });
  });

  it("restores a saved build", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ name: "otelcol-saved", componentIds: ["core-otlpreceiver"] })
    );

    const { result } = renderHook(() => useCollectorBuild());

    expect(result.current.name).toBe("otelcol-saved");
    expect(result.current.componentIds).toEqual(["core-otlpreceiver"]);
  });

  it.each([
    ["invalid JSON", "{not json"],
    ["a non-object", "[1, 2]"],
    ["wrong field types", JSON.stringify({ name: 42, componentIds: "core-otlpreceiver" })],
  ])("falls back to an empty build when the saved value is %s", (_label, raw) => {
    localStorage.setItem(STORAGE_KEY, raw);

    const { result } = renderHook(() => useCollectorBuild());

    expect(result.current.name).toBe(DEFAULT_BUILD_NAME);
    expect(result.current.componentIds).toEqual([]);
  });

  it("drops non-string and duplicate IDs from a saved build", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ name: "x", componentIds: ["a", 7, "a", null, "b"] })
    );

    const { result } = renderHook(() => useCollectorBuild());

    expect(result.current.componentIds).toEqual(["a", "b"]);
  });

  it("shares one build across every component that uses it", () => {
    const first = renderHook(() => useCollectorBuild());
    const second = renderHook(() => useCollectorBuild());

    act(() => first.result.current.addComponents(["core-otlpreceiver"]));

    expect(second.result.current.componentIds).toEqual(["core-otlpreceiver"]);
  });

  it("picks up a build changed in another tab", () => {
    const { result } = renderHook(() => useCollectorBuild());

    act(() => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ name: "otelcol-tab", componentIds: ["core-otlpexporter"] })
      );
      window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
    });

    expect(result.current.name).toBe("otelcol-tab");
    expect(result.current.componentIds).toEqual(["core-otlpexporter"]);
  });

  it("clearComponents empties the build but keeps its name", () => {
    const { result } = renderHook(() => useCollectorBuild());
    act(() => result.current.setName("otelcol-keep"));
    act(() => result.current.addComponents(["core-otlpreceiver"]));

    act(() => result.current.clearComponents());

    expect(result.current.name).toBe("otelcol-keep");
    expect(result.current.componentIds).toEqual([]);
  });
});

describe("isValidBuildName", () => {
  it.each(["otelcol-custom", "otelcol", "my.collector_2", "a"])("accepts %s", (name) => {
    expect(isValidBuildName(name)).toBe(true);
  });

  it.each(["", "OtelCol", "-leading", "trailing-", "double--dash", "has space", "../escape"])(
    "rejects %j",
    (name) => {
      expect(isValidBuildName(name)).toBe(false);
    }
  );
});
