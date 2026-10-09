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
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DataState } from "@/hooks/data-state";
import { collectorBuildActions } from "@/hooks/use-collector-build";
import { CollectorBuilderPage } from "./collector-builder-page";
import { RELEASE_COMPONENTS } from "./test-fixtures";
import type { CollectorRelease } from "./use-latest-collector-release";

const release = vi.hoisted(() => ({
  state: { data: null, loading: true, error: null } as DataState<CollectorRelease>,
}));

vi.mock("./use-latest-collector-release", () => ({
  useLatestCollectorRelease: () => release.state,
}));

const READY: DataState<CollectorRelease> = {
  data: { version: "0.161.0", components: RELEASE_COMPONENTS },
  loading: false,
  error: null,
};

const STORAGE_KEY = "explorer:collectorBuild:v1";

function renderPage() {
  return render(
    <MemoryRouter>
      <CollectorBuilderPage />
    </MemoryRouter>
  );
}

function storedIds(): string[] {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}").componentIds ?? [];
}

describe("CollectorBuilderPage", () => {
  beforeEach(() => {
    localStorage.clear();
    release.state = READY;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows a loader while the release loads", () => {
    release.state = { data: null, loading: true, error: null };
    renderPage();

    expect(screen.getByRole("status")).toHaveTextContent("Loading Collector components…");
  });

  it("shows an error when the release can't load", () => {
    release.state = { data: null, loading: false, error: new Error("boom") };
    renderPage();

    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't load Collector components");
  });

  it("tells people their build stays in this browser", () => {
    renderPage();

    expect(screen.getByText(/saved only in this browser/)).toBeInTheDocument();
  });

  it("starts empty, pointing to the component list, with Build disabled", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "Your build is empty" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse components" })).toHaveAttribute(
      "href",
      "/collector/components"
    );
    expect(screen.getByRole("button", { name: "Build" })).toBeDisabled();
  });

  it("groups picked components by type and links Build to the build page", () => {
    act(() => collectorBuildActions.addComponents(["core-otlpexporter", "core-otlpreceiver"]));
    renderPage();

    expect(screen.getByRole("heading", { name: "Receivers" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Exporters" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "OTLP Receiver" })).toHaveAttribute(
      "href",
      "/collector/components/core/otlpreceiver"
    );
    expect(screen.getByRole("link", { name: "Build" })).toHaveAttribute(
      "href",
      "/collector/builder/build"
    );
  });

  it("removes a component", async () => {
    const user = userEvent.setup();
    act(() => collectorBuildActions.addComponents(["core-otlpreceiver"]));
    renderPage();

    await user.click(screen.getByRole("button", { name: "Remove OTLP Receiver from build" }));

    expect(storedIds()).toEqual([]);
  });

  it("flags components the release lacks or can't build", () => {
    act(() =>
      collectorBuildActions.addComponents(["contrib-removedreceiver", "contrib-filelogreceiver"])
    );
    renderPage();

    expect(screen.getByRole("heading", { name: "Not in v0.161.0" })).toBeInTheDocument();
    expect(screen.getByText("contrib-removedreceiver")).toBeInTheDocument();
    expect(screen.getByText(/No Go module data yet/)).toBeInTheDocument();
    // Neither can go in a manifest, so there's nothing to build.
    expect(screen.getByRole("button", { name: "Build" })).toBeDisabled();
  });

  it("validates the distribution name", async () => {
    const user = userEvent.setup();
    act(() => collectorBuildActions.addComponents(["core-otlpreceiver"]));
    renderPage();
    const name = screen.getByRole("textbox", { name: "Name" });

    await user.clear(name);
    await user.type(name, "Bad Name");

    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(name).toHaveAccessibleDescription(/Use lowercase letters and numbers/);
    expect(screen.getByRole("button", { name: "Build" })).toBeDisabled();
  });

  it("removes all components after confirming", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "confirm",
      vi.fn(() => true)
    );
    act(() => collectorBuildActions.addComponents(["core-otlpreceiver", "core-otlpexporter"]));
    renderPage();

    await user.click(screen.getByRole("button", { name: "Remove all" }));

    expect(storedIds()).toEqual([]);
  });

  it("imports an OCB manifest and reports what it couldn't match", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "OCB manifest" }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("textbox", { name: "OCB manifest" }));
    await user.paste(
      [
        "dist:",
        "  name: otelcol-edge",
        "receivers:",
        "  - gomod: go.opentelemetry.io/collector/receiver/otlpreceiver v0.150.0",
        "  - gomod: github.com/example/acmereceiver v1.0.0",
      ].join("\n")
    );
    await user.click(within(dialog).getByRole("button", { name: "Add to build" }));

    expect(within(dialog).getByText("Added 1 component to your build.")).toBeInTheDocument();
    expect(within(dialog).getByText("Distribution name set to otelcol-edge.")).toBeInTheDocument();
    expect(within(dialog).getByText("github.com/example/acmereceiver v1.0.0")).toBeInTheDocument();
    expect(storedIds()).toEqual(["core-otlpreceiver"]);
  });

  it("explains why a Collector config can't be imported", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Collector config" }));
    const dialog = screen.getByRole("dialog");
    const textbox = within(dialog).getByRole("textbox", { name: "Collector config" });
    await user.click(textbox);
    await user.paste("receivers: [unclosed");
    await user.click(within(dialog).getByRole("button", { name: "Add to build" }));

    expect(within(dialog).getByRole("alert")).toHaveTextContent("This isn't valid YAML.");
    expect(textbox).toHaveAttribute("aria-invalid", "true");
  });

  it("adds every component of a pre-built distribution", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Pre-built distribution" }));
    const dialog = screen.getByRole("dialog");
    await user.click(
      within(dialog).getByRole("button", { name: "Add 2 components from otelcol-otlp" })
    );

    expect(within(dialog).getByText("Added 2 components to your build.")).toBeInTheDocument();
    expect(storedIds()).toEqual(["core-otlpreceiver", "core-otlpexporter"]);
  });
});
