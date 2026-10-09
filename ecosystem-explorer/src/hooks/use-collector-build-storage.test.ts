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
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { useCollectorBuild } from "./use-collector-build";

// Its own file: once storage fails, the store stays in memory for the rest of the module's life.
describe("useCollectorBuild without usable storage", () => {
  beforeAll(() => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Storage disabled", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Storage disabled", "SecurityError");
    });
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it("keeps the build in memory", () => {
    const { result } = renderHook(() => useCollectorBuild());

    act(() => result.current.addComponents(["core-otlpreceiver"]));

    expect(result.current.componentIds).toEqual(["core-otlpreceiver"]);
  });
});
