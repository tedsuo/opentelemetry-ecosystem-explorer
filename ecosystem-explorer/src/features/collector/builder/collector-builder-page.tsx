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
import { useId, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Hammer, Lock, PackageOpen, Trash2, X } from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";
import { Seo } from "@/components/seo/seo";
import { BackButton } from "@/components/ui/back-button";
import { BetaBadge } from "@/components/ui/beta-badge";
import { GlowBadge } from "@/components/ui/glow-badge";
import { Loader } from "@/components/ui/loader";
import { SearchableMultiSelect } from "@/components/ui/searchable-multi-select";
import { StatusPill, type Stability } from "@/components/ui/status-pill";
import { TypeStripe } from "@/components/ui/type-stripe";
import type { CollectorComponentType } from "@/components/ui/type-stripe-colors";
import { isValidBuildName, useCollectorBuild } from "@/hooks/use-collector-build";
import type { IndexComponent } from "@/types/collector";
import { DistributionDialog, PasteImportDialog } from "./import-dialogs";
import { MANIFEST_SECTIONS, planBuild } from "./manifest";
import { BUILD_PATH } from "./paths";
import {
  CARD_CLASS,
  ICON_BUTTON_CLASS,
  PRIMARY_BUTTON_CLASS,
  TOOLBAR_BUTTON_CLASS,
} from "./styles";
import { useLatestCollectorRelease, type CollectorRelease } from "./use-latest-collector-release";

function displayName(component: IndexComponent): string {
  return component.display_name?.trim() || component.name;
}

function byDisplayName(a: IndexComponent, b: IndexComponent): number {
  return displayName(a).localeCompare(displayName(b));
}

function BuildItem({
  component,
  missingModule,
  onRemove,
}: {
  component: IndexComponent;
  missingModule: boolean;
  onRemove: () => void;
}) {
  const { t } = useTranslation("collector");
  const name = displayName(component);
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <TypeStripe
        type={component.type as CollectorComponentType}
        className="h-9 w-1 shrink-0 rounded-full"
      />
      <div className="min-w-0 flex-1 space-y-1">
        <Link
          to={`/collector/components/${component.distribution}/${component.name}`}
          className="hover:text-primary font-medium hover:underline"
        >
          {name}
        </Link>
        <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
          <code className="bg-muted/50 rounded px-1.5 py-0.5 font-mono">{component.name}</code>
          <span className="uppercase">{component.distribution}</span>
        </div>
        {missingModule && (
          <GlowBadge variant="warning" className="text-[11px]">
            {t("builder.page.missingModule")}
          </GlowBadge>
        )}
      </div>
      <StatusPill
        stability={(component.stability ?? "development") as Stability}
        className="hidden sm:inline-flex"
      />
      <button
        type="button"
        className={ICON_BUTTON_CLASS}
        aria-label={t("builder.page.removeAriaLabel", { name })}
        onClick={onRemove}
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </li>
  );
}

function BuilderContent({ release }: { release: CollectorRelease }) {
  const { t } = useTranslation("collector");
  const build = useCollectorBuild();
  const nameId = useId();
  const hintId = useId();

  const byId = useMemo(
    () => new Map(release.components.map((component) => [component.id, component])),
    [release.components]
  );
  const pickerOptions = useMemo(
    () => [...release.components].sort(byDisplayName).map((component) => component.id),
    [release.components]
  );
  const plan = useMemo(
    () => planBuild(build.componentIds, release.components),
    [build.componentIds, release.components]
  );

  const missingModuleIds = new Set(plan.missingModule.map((component) => component.id));
  const groups = MANIFEST_SECTIONS.map(({ type }) => ({
    type,
    components: [...plan.included, ...plan.missingModule]
      .filter((component) => component.type === type)
      .sort(byDisplayName),
  })).filter((group) => group.components.length > 0);

  const pickedInRelease = build.componentIds.filter((id) => byId.has(id));
  const nameValid = isValidBuildName(build.name);
  const canBuild = nameValid && plan.included.length > 0;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8">
      <section aria-labelledby="build-components-heading" className="min-w-0 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="build-components-heading" className="text-xl font-semibold">
            {t("builder.page.componentsHeading")}{" "}
            <span className="text-muted-foreground text-sm font-normal">
              {t("builder.page.componentCount", { count: build.componentIds.length })}
            </span>
          </h2>
          {build.componentIds.length > 0 && (
            <button
              type="button"
              className={TOOLBAR_BUTTON_CLASS}
              onClick={() => {
                if (window.confirm(t("builder.page.clearConfirm"))) build.clearComponents();
              }}
            >
              <Trash2 className="h-3 w-3" aria-hidden="true" />
              {t("builder.page.clear")}
            </button>
          )}
        </div>

        <SearchableMultiSelect
          label={t("builder.page.pickerLabel")}
          placeholder={t("builder.page.pickerPlaceholder")}
          options={pickerOptions}
          selected={pickedInRelease}
          onChange={(next) => {
            build.addComponents(next.filter((id) => !build.componentIds.includes(id)));
            pickedInRelease.filter((id) => !next.includes(id)).forEach(build.removeComponent);
          }}
          renderOption={(id) => {
            const component = byId.get(id);
            return component ? (
              <>
                {displayName(component)}{" "}
                <span className="text-muted-foreground text-xs">
                  {component.type} · {component.distribution}
                </span>
              </>
            ) : (
              id
            );
          }}
        />

        {build.componentIds.length === 0 ? (
          <div className="border-border/40 rounded-2xl border-2 border-dashed px-6 py-16 text-center">
            <PackageOpen
              className="text-muted-foreground/40 mx-auto mb-4 h-10 w-10"
              aria-hidden="true"
            />
            <h3 className="text-lg font-semibold">{t("builder.page.emptyTitle")}</h3>
            <p className="text-muted-foreground mx-auto mt-2 max-w-md text-sm">
              {t("builder.page.emptyDescription")}
            </p>
            <Link to="/collector/components" className={`${PRIMARY_BUTTON_CLASS} mt-6`}>
              {t("builder.page.browseComponents")}
            </Link>
          </div>
        ) : (
          <div className="space-y-5">
            {groups.map((group) => (
              <div key={group.type} className="space-y-2">
                <h3 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                  {t(`detail.typeLabels.${group.type}`)}
                </h3>
                <ul className="border-border/50 bg-surface-card divide-border/40 divide-y overflow-hidden rounded-lg border">
                  {group.components.map((component) => (
                    <BuildItem
                      key={component.id}
                      component={component}
                      missingModule={missingModuleIds.has(component.id)}
                      onRemove={() => build.removeComponent(component.id)}
                    />
                  ))}
                </ul>
              </div>
            ))}
            {plan.unavailableIds.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                  {t("builder.page.unavailableHeading", { version: release.version })}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {t("builder.page.unavailableDescription")}
                </p>
                <ul className="border-border/50 divide-border/40 divide-y overflow-hidden rounded-lg border">
                  {plan.unavailableIds.map((id) => (
                    <li key={id} className="flex items-center justify-between gap-3 px-4 py-2">
                      <code className="text-muted-foreground font-mono text-sm">{id}</code>
                      <button
                        type="button"
                        className={ICON_BUTTON_CLASS}
                        aria-label={t("builder.page.removeAriaLabel", { name: id })}
                        onClick={() => build.removeComponent(id)}
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>

      <aside className="space-y-6 lg:sticky lg:top-20 lg:self-start">
        <section aria-labelledby="build-settings-heading" className={`${CARD_CLASS} space-y-4`}>
          <h2 id="build-settings-heading" className="text-sm font-medium">
            {t("builder.page.settingsHeading")}
          </h2>
          <div className="space-y-1.5">
            <label htmlFor={nameId} className="text-sm font-medium">
              {t("builder.page.nameLabel")}
            </label>
            <input
              id={nameId}
              type="text"
              value={build.name}
              onChange={(event) => build.setName(event.target.value)}
              spellCheck={false}
              autoComplete="off"
              aria-invalid={!nameValid}
              aria-describedby={`${nameId}-help`}
              className="border-border/60 bg-background/80 focus-visible:ring-primary/20 w-full rounded-lg border px-3 py-2 font-mono text-sm focus-visible:ring-2 focus-visible:outline-none aria-[invalid=true]:border-red-400"
            />
            <p
              id={`${nameId}-help`}
              className={nameValid ? "text-muted-foreground text-xs" : "text-xs text-red-400"}
            >
              {nameValid ? t("builder.page.nameHelp") : t("builder.page.nameError")}
            </p>
          </div>
          <dl className="space-y-1">
            <dt className="text-sm font-medium">{t("builder.page.versionLabel")}</dt>
            <dd className="text-muted-foreground text-sm">
              {t("builder.page.versionValue", { version: release.version })}
            </dd>
          </dl>
          {canBuild ? (
            <Link to={BUILD_PATH} className={`${PRIMARY_BUTTON_CLASS} w-full`}>
              <Hammer className="h-4 w-4" aria-hidden="true" />
              {t("builder.page.build")}
            </Link>
          ) : (
            <>
              <button
                type="button"
                disabled
                className={`${PRIMARY_BUTTON_CLASS} w-full`}
                aria-describedby={nameValid ? hintId : `${nameId}-help`}
              >
                <Hammer className="h-4 w-4" aria-hidden="true" />
                {t("builder.page.build")}
              </button>
              {nameValid && (
                <p id={hintId} className="text-muted-foreground text-xs">
                  {t("builder.page.buildHint")}
                </p>
              )}
            </>
          )}
        </section>

        <section aria-labelledby="build-import-heading" className={`${CARD_CLASS} space-y-3`}>
          <h2 id="build-import-heading" className="text-sm font-medium">
            {t("builder.import.heading")}
          </h2>
          <div className="flex flex-col gap-2">
            <PasteImportDialog kind="manifest" releaseComponents={release.components} />
            <PasteImportDialog kind="config" releaseComponents={release.components} />
            <DistributionDialog releaseComponents={release.components} />
          </div>
        </section>
      </aside>
    </div>
  );
}

export function CollectorBuilderPage() {
  const { t } = useTranslation("collector");
  const release = useLatestCollectorRelease();

  return (
    <PageContainer>
      <Seo />
      <div className="space-y-6">
        <BackButton />
        <header className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold md:text-4xl">
              <span className="text-gradient-brand">{t("builder.title")}</span>
            </h1>
            <BetaBadge />
          </div>
          <p className="text-muted-foreground max-w-3xl text-base">{t("builder.description")}</p>
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {t("builder.privacyNote")}
          </p>
        </header>
        {release.loading ? (
          <Loader size="lg" label={t("builder.page.loading")} />
        ) : release.error || !release.data ? (
          <p role="alert" className="mt-4 text-sm text-red-400">
            {t("builder.page.error")}
          </p>
        ) : (
          <BuilderContent release={release.data} />
        )}
      </div>
    </PageContainer>
  );
}
