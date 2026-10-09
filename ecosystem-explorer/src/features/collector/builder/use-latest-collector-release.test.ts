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
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCollectorComponents, useCollectorVersions } from "@/hooks/use-collector-data";
import type { VersionsIndex } from "@/types/collector";
import { selectBuildVersion, useLatestCollectorRelease } from "./use-latest-collector-release";
import { RELEASE_COMPONENTS } from "./test-fixtures";

vi.mock("@/hooks/use-collector-data", () => ({
  useCollectorVersions: vi.fn(),
  useCollectorComponents: vi.fn(),
}));

const IN_SYNC: VersionsIndex = {
  versions: [
    { version: "0.162.0", is_latest: true, distributions: ["core", "contrib"] },
    { version: "0.161.0", is_latest: false, distributions: ["core", "contrib"] },
  ],
};

describe("selectBuildVersion", () => {
  it("picks the newest release when both core and contrib made it", () => {
    expect(selectBuildVersion(IN_SYNC)).toBe("0.162.0");
  });

  it("skips a newer release only core made", () => {
    const coreAhead: VersionsIndex = {
      versions: [
        { version: "0.162.1", is_latest: true, distributions: ["core"] },
        ...IN_SYNC.versions,
      ],
    };

    expect(selectBuildVersion(coreAhead)).toBe("0.162.0");
  });

  it("falls back to the latest release for data without release distributions", () => {
    const legacy: VersionsIndex = {
      versions: [
        { version: "0.161.0", is_latest: true },
        { version: "0.160.0", is_latest: false },
      ],
    };

    expect(selectBuildVersion(legacy)).toBe("0.161.0");
  });

  it("has no version without releases", () => {
    expect(selectBuildVersion(null)).toBe("");
    expect(selectBuildVersion({ versions: [] })).toBe("");
  });
});

describe("useLatestCollectorRelease", () => {
  beforeEach(() => {
    vi.mocked(useCollectorComponents).mockReset();
  });

  it("loads no components until it knows the version", () => {
    vi.mocked(useCollectorVersions).mockReturnValue({ data: null, loading: true, error: null });
    vi.mocked(useCollectorComponents).mockReturnValue({ data: null, loading: false, error: null });

    const { result } = renderHook(() => useLatestCollectorRelease());

    expect(useCollectorComponents).toHaveBeenCalledWith(null);
    expect(result.current.loading).toBe(true);
  });

  it("returns the selected release's components", () => {
    vi.mocked(useCollectorVersions).mockReturnValue({ data: IN_SYNC, loading: false, error: null });
    vi.mocked(useCollectorComponents).mockReturnValue({
      data: RELEASE_COMPONENTS,
      loading: false,
      error: null,
    });

    const { result } = renderHook(() => useLatestCollectorRelease());

    expect(useCollectorComponents).toHaveBeenCalledWith("0.162.0");
    expect(result.current.data).toEqual({ version: "0.162.0", components: RELEASE_COMPONENTS });
  });
});
