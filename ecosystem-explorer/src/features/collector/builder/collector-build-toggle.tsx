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
import { Check, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useCollectorBuild } from "@/hooks/use-collector-build";
import { isEnabled } from "@/lib/feature-flags";

interface CollectorBuildToggleProps {
  componentId: string;
  /** The component's display name, used in the icon-only variant's accessible name. */
  componentName: string;
  /** Shows the "Add to build" text. Without it the button is icon-only. */
  showLabel?: boolean;
  /** Styling for the host app; legacy and v1 pages style buttons differently. */
  className: string;
}

/**
 * Adds a component to, or removes it from, the Collector build. Renders nothing while the
 * COLLECTOR_BUILDER flag is off.
 */
export function CollectorBuildToggle({
  componentId,
  componentName,
  showLabel = false,
  className,
}: CollectorBuildToggleProps) {
  const { t } = useTranslation("collector");
  const { componentIds, toggleComponent } = useCollectorBuild();
  if (!isEnabled("COLLECTOR_BUILDER")) return null;

  const inBuild = componentIds.includes(componentId);
  const Icon = inBuild ? Check : Plus;
  return (
    <button
      type="button"
      className={className}
      aria-pressed={inBuild}
      aria-label={showLabel ? undefined : t("builder.toggle.ariaLabel", { name: componentName })}
      title={t(inBuild ? "builder.toggle.titleRemove" : "builder.toggle.titleAdd")}
      onClick={() => toggleComponent(componentId)}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      {showLabel && <span>{t("builder.toggle.label")}</span>}
    </button>
  );
}
