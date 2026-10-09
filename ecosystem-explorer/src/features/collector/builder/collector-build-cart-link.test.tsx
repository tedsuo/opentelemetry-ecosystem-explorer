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
import { act, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { collectorBuildActions } from "@/hooks/use-collector-build";
import { CollectorBuildCartLink } from "./collector-build-cart-link";

function renderLink() {
  return render(
    <MemoryRouter>
      <CollectorBuildCartLink className="cart" countClassName="count" />
    </MemoryRouter>
  );
}

describe("CollectorBuildCartLink", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubEnv("VITE_FEATURE_FLAG_COLLECTOR_BUILDER", "true");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("renders nothing while the feature flag is off", () => {
    vi.stubEnv("VITE_FEATURE_FLAG_COLLECTOR_BUILDER", "false");
    const { container } = renderLink();

    expect(container).toBeEmptyDOMElement();
  });

  it("links to the builder and announces an empty build", () => {
    renderLink();

    const link = screen.getByRole("link", { name: "Collector build, empty" });
    expect(link).toHaveAttribute("href", "/collector/builder");
    expect(link.querySelector(".count")).toBeNull();
  });

  it("shows how many components the build holds", () => {
    renderLink();

    act(() => collectorBuildActions.addComponents(["core-otlpreceiver", "core-otlpexporter"]));

    const link = screen.getByRole("link", { name: "Collector build, 2 components" });
    expect(link.querySelector(".count")).toHaveTextContent("2");
  });
});
