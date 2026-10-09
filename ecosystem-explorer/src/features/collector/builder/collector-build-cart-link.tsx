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
import { ShoppingCart } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useCollectorBuild } from "@/hooks/use-collector-build";
import { isEnabled } from "@/lib/feature-flags";
import { BUILDER_PATH } from "./paths";

interface CollectorBuildCartLinkProps {
  /** Styling for the host app's header. */
  className: string;
  countClassName: string;
  onClick?: () => void;
}

/**
 * The header's link to the Collector Builder, showing how many components the build holds.
 * Renders nothing while the COLLECTOR_BUILDER flag is off.
 */
export function CollectorBuildCartLink({
  className,
  countClassName,
  onClick,
}: CollectorBuildCartLinkProps) {
  const { t } = useTranslation("collector");
  const { componentIds } = useCollectorBuild();
  if (!isEnabled("COLLECTOR_BUILDER")) return null;

  const count = componentIds.length;
  return (
    <Link
      to={BUILDER_PATH}
      className={className}
      aria-label={t("builder.cart.ariaLabel", { count })}
      title={t("builder.title")}
      onClick={onClick}
    >
      <ShoppingCart className="h-5 w-5" aria-hidden="true" />
      {count > 0 && (
        <span className={countClassName} aria-hidden="true">
          {count}
        </span>
      )}
    </Link>
  );
}
