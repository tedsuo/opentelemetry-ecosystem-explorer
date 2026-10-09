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
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { DataState } from "@/hooks/data-state";
import { collectorBuildActions } from "@/hooks/use-collector-build";
import * as downloadModule from "@/lib/download-text";
import { CollectorBuildPage } from "./collector-build-page";
import { RELEASE_COMPONENTS } from "./test-fixtures";
import type { CollectorRelease } from "./use-latest-collector-release";

const release = vi.hoisted(() => ({
  state: { data: null, loading: true, error: null } as DataState<CollectorRelease>,
}));

vi.mock("./use-latest-collector-release", () => ({
  useLatestCollectorRelease: () => release.state,
}));

const downloadSpy = vi.spyOn(downloadModule, "downloadText").mockImplementation(() => {});

function renderPage() {
  return render(
    <MemoryRouter>
      <CollectorBuildPage />
    </MemoryRouter>
  );
}

function manifestText(): string {
  const section = screen.getByRole("region", { name: "OCB manifest" });
  return section.querySelector("pre")?.textContent ?? "";
}

describe("CollectorBuildPage", () => {
  beforeEach(() => {
    localStorage.clear();
    downloadSpy.mockClear();
    release.state = {
      data: { version: "0.161.0", components: RELEASE_COMPONENTS },
      loading: false,
      error: null,
    };
  });

  afterAll(() => {
    downloadSpy.mockRestore();
  });

  it("shows the manifest for the picked components", () => {
    act(() => {
      collectorBuildActions.setName("otelcol-edge");
      collectorBuildActions.addComponents(["core-otlpreceiver", "contrib-k8sattributesprocessor"]);
    });
    renderPage();

    expect(screen.getByText("otelcol-edge: 2 components, Collector v0.161.0")).toBeInTheDocument();
    const manifest = manifestText();
    expect(manifest).toContain("name: otelcol-edge");
    expect(manifest).toContain(
      "- gomod: go.opentelemetry.io/collector/receiver/otlpreceiver v0.161.0"
    );
    expect(manifest).toContain(
      "- gomod: github.com/open-telemetry/opentelemetry-collector-contrib/processor/k8sattributesprocessor v1.0.0"
    );
  });

  it("downloads the manifest as builder-config.yaml", async () => {
    const user = userEvent.setup();
    act(() => collectorBuildActions.addComponents(["core-otlpreceiver"]));
    renderPage();

    await user.click(screen.getByRole("button", { name: "Download" }));

    expect(downloadSpy).toHaveBeenCalledWith("builder-config.yaml", manifestText(), "text/yaml");
  });

  it("lists what the manifest leaves out", () => {
    act(() =>
      collectorBuildActions.addComponents([
        "core-otlpreceiver",
        "contrib-removedreceiver",
        "contrib-filelogreceiver",
      ])
    );
    renderPage();

    const excluded = screen.getByRole("region", { name: "Left out of the manifest" });
    expect(excluded).toHaveTextContent("Not in v0.161.0: contrib-removedreceiver");
    expect(excluded).toHaveTextContent("No Go module data yet: Filelog Receiver");
    expect(manifestText()).not.toContain("filelogreceiver");
  });

  it("has nothing to build without a component that can go in a manifest", () => {
    act(() => collectorBuildActions.addComponents(["contrib-filelogreceiver"]));
    renderPage();

    expect(screen.getByRole("heading", { name: "Nothing to build yet" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "OCB manifest" })).not.toBeInTheDocument();
  });

  it("gives local, Docker, and GitHub Actions instructions pinned to the release", async () => {
    const user = userEvent.setup();
    act(() => collectorBuildActions.addComponents(["core-otlpreceiver"]));
    renderPage();
    const instructions = screen.getByRole("region", { name: "Build instructions" });

    expect(
      within(instructions).getByText(
        "go install go.opentelemetry.io/collector/cmd/builder@v0.161.0"
      )
    ).toBeInTheDocument();
    expect(
      within(instructions).getByRole("link", { name: "OCB v0.161.0 release" })
    ).toHaveAttribute(
      "href",
      "https://github.com/open-telemetry/opentelemetry-collector-releases/releases/tag/cmd%2Fbuilder%2Fv0.161.0"
    );

    await user.click(within(instructions).getByRole("tab", { name: "Docker" }));
    expect(
      within(instructions).getByText(
        /FROM otel\/opentelemetry-collector-builder:0\.161\.0 AS build/
      )
    ).toBeInTheDocument();

    await user.click(within(instructions).getByRole("tab", { name: "GitHub Actions" }));
    expect(
      within(instructions).getByText(".github/workflows/build-collector.yaml")
    ).toBeInTheDocument();
    expect(within(instructions).getByRole("tabpanel")).toHaveTextContent(
      "go install go.opentelemetry.io/collector/cmd/builder@v0.161.0"
    );
  });
});
