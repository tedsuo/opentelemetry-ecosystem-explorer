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
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CollectorBuildToggle } from "./collector-build-toggle";

describe("CollectorBuildToggle", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubEnv("VITE_FEATURE_FLAG_COLLECTOR_BUILDER", "true");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("renders nothing while the feature flag is off", () => {
    vi.stubEnv("VITE_FEATURE_FLAG_COLLECTOR_BUILDER", "false");
    const { container } = render(
      <CollectorBuildToggle
        componentId="core-otlpreceiver"
        componentName="OTLP Receiver"
        className=""
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("is an icon button named for its component that toggles it in and out of the build", async () => {
    const user = userEvent.setup();
    render(
      <CollectorBuildToggle
        componentId="core-otlpreceiver"
        componentName="OTLP Receiver"
        className=""
      />
    );
    const button = screen.getByRole("button", { name: "Add OTLP Receiver to build" });
    expect(button).toHaveAttribute("aria-pressed", "false");

    await user.click(button);
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(localStorage.getItem("explorer:collectorBuild:v1")).toContain("core-otlpreceiver");

    await user.click(button);
    expect(button).toHaveAttribute("aria-pressed", "false");
  });

  it("uses its visible text as its name when labeled", () => {
    render(
      <CollectorBuildToggle
        componentId="core-otlpreceiver"
        componentName="OTLP Receiver"
        showLabel
        className=""
      />
    );

    expect(screen.getByRole("button", { name: "Add to build" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
  });
});
