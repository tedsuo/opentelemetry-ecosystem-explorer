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

/*
 * Tailwind class strings for the builder pages and the legacy app's "Add to build"
 * controls. There's no shared Button primitive, so these follow the button recipes in
 * DESIGN.md and the configuration builder's toolbar buttons.
 */

const FOCUS =
  "focus-visible:ring-primary focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none";

export const CARD_CLASS = "border-border/50 bg-surface-card shadow-surface rounded-xl border p-5";

export const PRIMARY_BUTTON_CLASS = `bg-primary text-primary-foreground hover:bg-primary/90 inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`;

export const SECONDARY_BUTTON_CLASS = `border-border/60 bg-card text-foreground hover:bg-muted/50 inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${FOCUS}`;

export const TOOLBAR_BUTTON_CLASS = `border-border/60 bg-card text-foreground hover:bg-muted/50 inline-flex cursor-pointer items-center gap-1 rounded-md border px-3 py-1.5 text-xs ${FOCUS}`;

export const ICON_BUTTON_CLASS = `text-muted-foreground hover:text-foreground hover:bg-muted/50 inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors ${FOCUS}`;

const PRESSED =
  "aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground";

/** The icon-only "Add to build" toggle on legacy list cards. */
export const LEGACY_ICON_TOGGLE_CLASS = `border-border/60 bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border transition-colors ${PRESSED} ${FOCUS}`;

/** The labeled "Add to build" toggle in the legacy detail header. */
export const LEGACY_LABEL_TOGGLE_CLASS = `border-border/60 bg-card text-foreground hover:border-primary/50 inline-flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${PRESSED} ${FOCUS}`;
