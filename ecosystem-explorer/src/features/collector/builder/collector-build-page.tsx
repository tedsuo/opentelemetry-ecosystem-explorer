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
import { useMemo, useState, type ReactElement, type ReactNode } from "react";
import { Trans, useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { AlertTriangle, Download, PackageOpen, Pencil } from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";
import { Seo } from "@/components/seo/seo";
import { BackButton } from "@/components/ui/back-button";
import { BetaBadge } from "@/components/ui/beta-badge";
import { CopyButton } from "@/components/ui/copy-button";
import { Loader } from "@/components/ui/loader";
import { SegmentedTabList } from "@/components/ui/segmented-tabs";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { YamlCodeBlock } from "@/features/java-agent/configuration/components/yaml-code-block";
import { isValidBuildName, useCollectorBuild } from "@/hooks/use-collector-build";
import { downloadText } from "@/lib/download-text";
import {
  GITHUB_WORKFLOW_PATH,
  binaryPath,
  dockerBuildCommand,
  dockerRunCommand,
  dockerfile,
  githubWorkflow,
  localBuildCommand,
  localRunCommand,
  ocbInstallCommand,
  ocbReleaseUrl,
  type BuildInstructionOptions,
} from "./instructions";
import { MANIFEST_FILENAME, generateManifest, planBuild } from "./manifest";
import { BUILDER_PATH } from "./paths";
import {
  CARD_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  TOOLBAR_BUTTON_CLASS,
} from "./styles";
import { useLatestCollectorRelease, type CollectorRelease } from "./use-latest-collector-release";

const CODE_CLASS = "bg-code-bg text-code-fg rounded-md p-4 pr-28 font-mono text-xs";

const INLINE_CODE = (
  <code className="bg-muted text-foreground/90 rounded px-1 py-0.5 font-mono text-xs" />
);

function externalLink(href: string): ReactElement {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline underline-offset-2"
    />
  );
}

/** A copyable block. Shell and Dockerfile text is shown unhighlighted: the tokenizer is YAML-only. */
function CodeSnippet({
  code,
  copyLabel,
  yaml = false,
}: {
  code: string;
  copyLabel: string;
  yaml?: boolean;
}) {
  return (
    <div className="relative">
      {yaml ? (
        <YamlCodeBlock code={code} className={CODE_CLASS} />
      ) : (
        <pre className={`${CODE_CLASS} [overflow-wrap:anywhere] whitespace-pre-wrap`}>
          <code>{code}</code>
        </pre>
      )}
      <CopyButton
        text={code}
        label={copyLabel}
        className={`${TOOLBAR_BUTTON_CLASS} absolute top-2 right-2`}
      />
    </div>
  );
}

function Step({ children }: { children: ReactNode }) {
  return <li className="space-y-2 text-sm leading-relaxed">{children}</li>;
}

function Steps({ children }: { children: ReactNode }) {
  return (
    <ol className="marker:text-muted-foreground list-decimal space-y-5 pt-2 pl-5">{children}</ol>
  );
}

function InstructionTabs({ options }: { options: BuildInstructionOptions }) {
  const { t } = useTranslation("collector");
  const [tab, setTab] = useState("local");
  const { name, collectorVersion: version } = options;
  const copyCommand = t("builder.buildPage.copyCommand");
  const copyFile = t("builder.buildPage.copyFile");
  const files = {
    file: MANIFEST_FILENAME,
    binary: binaryPath(options),
    path: GITHUB_WORKFLOW_PATH,
  };

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <SegmentedTabList
        value={tab}
        tabs={[
          { value: "local", label: t("builder.buildPage.tabs.local") },
          { value: "docker", label: t("builder.buildPage.tabs.docker") },
          { value: "github", label: t("builder.buildPage.tabs.github") },
        ]}
      />
      <TabsContent value="local">
        <Steps>
          <Step>
            <Trans
              i18nKey="builder.buildPage.local.go"
              ns="collector"
              components={{ goLink: externalLink("https://go.dev/doc/install") }}
            />
          </Step>
          <Step>
            <Trans
              i18nKey="builder.buildPage.local.save"
              ns="collector"
              values={files}
              components={{ code: INLINE_CODE }}
            />
          </Step>
          <Step>
            <p>{t("builder.buildPage.local.install", { version })}</p>
            <CodeSnippet code={ocbInstallCommand(options)} copyLabel={copyCommand} />
            <p className="text-muted-foreground text-xs">
              <Trans
                i18nKey="builder.buildPage.local.installAlt"
                ns="collector"
                values={{ version }}
                components={{
                  code: INLINE_CODE,
                  releaseLink: externalLink(ocbReleaseUrl(version)),
                }}
              />
            </p>
          </Step>
          <Step>
            <p>
              <Trans
                i18nKey="builder.buildPage.local.build"
                ns="collector"
                values={files}
                components={{ code: INLINE_CODE }}
              />
            </p>
            <CodeSnippet code={localBuildCommand()} copyLabel={copyCommand} />
          </Step>
          <Step>
            <p>{t("builder.buildPage.local.run")}</p>
            <CodeSnippet code={localRunCommand(options)} copyLabel={copyCommand} />
          </Step>
        </Steps>
      </TabsContent>
      <TabsContent value="docker">
        <Steps>
          <Step>
            <Trans
              i18nKey="builder.buildPage.docker.save"
              ns="collector"
              values={files}
              components={{ code: INLINE_CODE }}
            />
          </Step>
          <Step>
            <p>
              <Trans
                i18nKey="builder.buildPage.docker.dockerfile"
                ns="collector"
                components={{ code: INLINE_CODE }}
              />
            </p>
            <CodeSnippet code={dockerfile(options)} copyLabel={copyFile} />
          </Step>
          <Step>
            <p>{t("builder.buildPage.docker.build")}</p>
            <CodeSnippet code={dockerBuildCommand(options)} copyLabel={copyCommand} />
          </Step>
          <Step>
            <p>{t("builder.buildPage.docker.run")}</p>
            <CodeSnippet code={dockerRunCommand(options)} copyLabel={copyCommand} />
          </Step>
        </Steps>
      </TabsContent>
      <TabsContent value="github">
        <Steps>
          <Step>
            <Trans
              i18nKey="builder.buildPage.github.save"
              ns="collector"
              values={files}
              components={{ code: INLINE_CODE }}
            />
          </Step>
          <Step>
            <p>
              <Trans
                i18nKey="builder.buildPage.github.workflow"
                ns="collector"
                values={files}
                components={{ code: INLINE_CODE }}
              />
            </p>
            <CodeSnippet code={githubWorkflow(options)} copyLabel={copyFile} yaml />
          </Step>
          <Step>
            <Trans
              i18nKey="builder.buildPage.github.artifact"
              ns="collector"
              values={{ name }}
              components={{ code: INLINE_CODE }}
            />
          </Step>
        </Steps>
      </TabsContent>
    </Tabs>
  );
}

function BuildContent({ release }: { release: CollectorRelease }) {
  const { t } = useTranslation("collector");
  const { name, componentIds } = useCollectorBuild();
  const plan = useMemo(
    () => planBuild(componentIds, release.components),
    [componentIds, release.components]
  );
  const manifest = useMemo(
    () => generateManifest({ name, collectorVersion: release.version, components: plan.included }),
    [name, release.version, plan.included]
  );

  const buildable = isValidBuildName(name) && plan.included.length > 0;
  const excludedNames = plan.missingModule.map((c) => c.display_name?.trim() || c.name);

  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold md:text-4xl">
              <span className="text-gradient-brand">{t("builder.buildPage.title")}</span>
            </h1>
            <BetaBadge />
          </div>
          {buildable && (
            <p className="text-muted-foreground font-mono text-sm">
              {t("builder.buildPage.summary", {
                name,
                count: plan.included.length,
                version: release.version,
              })}
            </p>
          )}
        </div>
        <Link to={BUILDER_PATH} className={SECONDARY_BUTTON_CLASS}>
          <Pencil className="h-4 w-4" aria-hidden="true" />
          {t("builder.buildPage.editBuild")}
        </Link>
      </header>

      {!buildable ? (
        <div className="border-border/40 rounded-2xl border-2 border-dashed px-6 py-16 text-center">
          <PackageOpen
            className="text-muted-foreground/40 mx-auto mb-4 h-10 w-10"
            aria-hidden="true"
          />
          <h2 className="text-lg font-semibold">{t("builder.buildPage.empty.title")}</h2>
          <p className="text-muted-foreground mx-auto mt-2 max-w-md text-sm">
            {isValidBuildName(name)
              ? t("builder.buildPage.empty.description")
              : t("builder.page.nameError")}
          </p>
          <Link to={BUILDER_PATH} className={`${PRIMARY_BUTTON_CLASS} mt-6`}>
            {t("builder.buildPage.empty.action")}
          </Link>
        </div>
      ) : (
        <>
          {(plan.unavailableIds.length > 0 || excludedNames.length > 0) && (
            <section
              aria-labelledby="build-excluded-heading"
              className="border-border/60 bg-muted/30 flex gap-3 rounded-lg border p-4"
            >
              <AlertTriangle
                className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0"
                aria-hidden="true"
              />
              <div className="space-y-1 text-sm">
                <h2 id="build-excluded-heading" className="font-medium">
                  {t("builder.buildPage.excludedHeading")}
                </h2>
                {plan.unavailableIds.length > 0 && (
                  <p className="text-muted-foreground">
                    {t("builder.buildPage.excludedUnavailable", {
                      version: release.version,
                      names: plan.unavailableIds.join(", "),
                    })}
                  </p>
                )}
                {excludedNames.length > 0 && (
                  <p className="text-muted-foreground">
                    {t("builder.buildPage.excludedMissingModule", {
                      names: excludedNames.join(", "),
                    })}
                  </p>
                )}
              </div>
            </section>
          )}

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <section
              aria-labelledby="build-manifest-heading"
              className={`${CARD_CLASS} min-w-0 space-y-3 xl:sticky xl:top-20 xl:self-start`}
            >
              <header className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <h2 id="build-manifest-heading" className="text-sm font-medium">
                    {t("builder.buildPage.manifestHeading")}
                  </h2>
                  <p className="text-muted-foreground font-mono text-xs">{MANIFEST_FILENAME}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <CopyButton
                    text={manifest}
                    label={t("builder.buildPage.copyManifest")}
                    className={TOOLBAR_BUTTON_CLASS}
                  />
                  <button
                    type="button"
                    className={TOOLBAR_BUTTON_CLASS}
                    onClick={() => downloadText(MANIFEST_FILENAME, manifest, "text/yaml")}
                  >
                    <Download className="h-3 w-3" aria-hidden="true" />
                    {t("builder.buildPage.download")}
                  </button>
                </div>
              </header>
              <YamlCodeBlock
                code={manifest}
                className="bg-code-bg text-code-fg max-h-[70vh] overflow-auto rounded-md p-4 font-mono text-xs"
              />
            </section>

            <section
              aria-labelledby="build-instructions-heading"
              className={`${CARD_CLASS} min-w-0 space-y-4`}
            >
              <h2 id="build-instructions-heading" className="text-sm font-medium">
                {t("builder.buildPage.instructionsHeading")}
              </h2>
              <InstructionTabs options={{ name, collectorVersion: release.version }} />
            </section>
          </div>
        </>
      )}
    </>
  );
}

export function CollectorBuildPage() {
  const { t } = useTranslation("collector");
  const release = useLatestCollectorRelease();

  return (
    <PageContainer>
      <Seo />
      <div className="space-y-6">
        <BackButton />
        {release.loading ? (
          <Loader size="lg" label={t("builder.page.loading")} />
        ) : release.error || !release.data ? (
          <p role="alert" className="mt-4 text-sm text-red-400">
            {t("builder.page.error")}
          </p>
        ) : (
          <BuildContent release={release.data} />
        )}
      </div>
    </PageContainer>
  );
}
