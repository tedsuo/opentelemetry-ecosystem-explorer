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
import { useId, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Boxes, FileCode2, Settings2 } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useCollectorBuild } from "@/hooks/use-collector-build";
import type { IndexComponent } from "@/types/collector";
import {
  BuildImportError,
  DISTRIBUTIONS,
  distributionComponentIds,
  importCollectorConfig,
  importManifest,
  type BuildImportErrorReason,
  type BuildImportResult,
} from "./importers";
import { PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from "./styles";

interface ImportOutcome {
  /** Components the import added that weren't already in the build. */
  added: number;
  unrecognized: string[];
  name?: string;
}

/** Adds an import's components to the build and reports what changed. */
function useApplyImport(): (result: BuildImportResult) => ImportOutcome {
  const { componentIds, addComponents, setName } = useCollectorBuild();
  return (result) => {
    const added = result.componentIds.filter((id) => !componentIds.includes(id)).length;
    addComponents(result.componentIds);
    if (result.name) setName(result.name);
    return { added, unrecognized: result.unrecognized, name: result.name };
  };
}

function ImportSummary({ outcome }: { outcome: ImportOutcome }) {
  const { t } = useTranslation("collector");
  return (
    <div className="space-y-3 text-sm" role="status">
      <p>{t("builder.import.added", { count: outcome.added })}</p>
      {outcome.name && <p>{t("builder.import.nameSet", { name: outcome.name })}</p>}
      {outcome.unrecognized.length > 0 && (
        <div className="space-y-1">
          <p className="text-muted-foreground">{t("builder.import.unrecognizedHeading")}</p>
          <ul className="bg-muted/40 max-h-48 overflow-auto rounded-md p-3 font-mono text-xs">
            {outcome.unrecognized.map((entry) => (
              <li key={entry} className="break-all">
                {entry}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

interface ImportDialogShellProps {
  trigger: ReactNode;
  triggerLabel: string;
  title: string;
  description: string;
  /** Called when the dialog closes, so the caller can clear its state for next time. */
  onClosed: () => void;
  children: ReactNode;
}

function ImportDialogShell({
  trigger,
  triggerLabel,
  title,
  description,
  onClosed,
  children,
}: ImportDialogShellProps) {
  return (
    <Dialog onOpenChange={(open) => !open && onClosed()}>
      <DialogTrigger asChild>
        <button type="button" className={`${SECONDARY_BUTTON_CLASS} justify-start`}>
          {trigger}
          {triggerLabel}
        </button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[85dvh] w-[90vw] max-w-2xl flex-col gap-4">
        <div className="space-y-2 pr-8">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </div>
        {children}
      </DialogContent>
    </Dialog>
  );
}

function DoneButton() {
  const { t } = useTranslation("collector");
  return (
    <div className="flex justify-end">
      <DialogClose asChild>
        <button type="button" className={PRIMARY_BUTTON_CLASS}>
          {t("builder.import.done")}
        </button>
      </DialogClose>
    </div>
  );
}

interface PasteImportDialogProps {
  kind: "manifest" | "config";
  releaseComponents: readonly IndexComponent[];
}

/** Imports components from a pasted OCB manifest or Collector config file. */
export function PasteImportDialog({ kind, releaseComponents }: PasteImportDialogProps) {
  const { t } = useTranslation("collector");
  const applyImport = useApplyImport();
  const [text, setText] = useState("");
  const [error, setError] = useState<BuildImportErrorReason | null>(null);
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null);
  const textareaId = useId();
  const errorId = useId();

  const submit = () => {
    try {
      const parse = kind === "manifest" ? importManifest : importCollectorConfig;
      setOutcome(applyImport(parse(text, releaseComponents)));
      setError(null);
    } catch (err) {
      if (!(err instanceof BuildImportError)) throw err;
      setError(err.reason);
    }
  };

  const errorMessage =
    error === "no-components"
      ? t(`builder.import.${kind}.noComponents`)
      : error && t(`builder.import.errors.${error}`);

  return (
    <ImportDialogShell
      trigger={
        kind === "manifest" ? (
          <FileCode2 className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Settings2 className="h-4 w-4" aria-hidden="true" />
        )
      }
      triggerLabel={t(`builder.import.${kind}.button`)}
      title={t(`builder.import.${kind}.title`)}
      description={t(`builder.import.${kind}.description`)}
      onClosed={() => {
        setText("");
        setError(null);
        setOutcome(null);
      }}
    >
      {outcome ? (
        <>
          <ImportSummary outcome={outcome} />
          <DoneButton />
        </>
      ) : (
        <form
          className="flex min-h-0 flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <label htmlFor={textareaId} className="text-sm font-medium">
            {t(`builder.import.${kind}.label`)}
          </label>
          <textarea
            id={textareaId}
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={14}
            spellCheck={false}
            autoComplete="off"
            aria-invalid={error !== null}
            aria-describedby={error ? errorId : undefined}
            className="border-border/60 bg-code-bg text-code-fg focus-visible:ring-primary min-h-0 w-full resize-y rounded-md border p-3 font-mono text-xs focus-visible:ring-2 focus-visible:outline-none"
          />
          {errorMessage && (
            <p id={errorId} role="alert" className="text-sm text-red-400">
              {errorMessage}
            </p>
          )}
          {kind === "manifest" && (
            <p className="text-muted-foreground text-xs">
              {t("builder.import.manifest.skippedNote")}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <button type="button" className={SECONDARY_BUTTON_CLASS}>
                {t("builder.import.cancel")}
              </button>
            </DialogClose>
            <button type="submit" className={PRIMARY_BUTTON_CLASS}>
              {t("builder.import.submit")}
            </button>
          </div>
        </form>
      )}
    </ImportDialogShell>
  );
}

/** Adds every component of one of the official Collector distributions. */
export function DistributionDialog({
  releaseComponents,
}: {
  releaseComponents: readonly IndexComponent[];
}) {
  const { t } = useTranslation("collector");
  const applyImport = useApplyImport();
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null);

  return (
    <ImportDialogShell
      trigger={<Boxes className="h-4 w-4" aria-hidden="true" />}
      triggerLabel={t("builder.distributions.button")}
      title={t("builder.distributions.title")}
      description={t("builder.distributions.description")}
      onClosed={() => setOutcome(null)}
    >
      {outcome ? (
        <>
          <ImportSummary outcome={outcome} />
          <DoneButton />
        </>
      ) : (
        <ul className="min-h-0 space-y-3 overflow-auto">
          {DISTRIBUTIONS.map(({ name, tag }) => {
            const ids = distributionComponentIds(tag, releaseComponents);
            return (
              <li
                key={name}
                className="border-border/50 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
              >
                <div className="min-w-0 space-y-1">
                  <p className="font-mono text-sm font-semibold">{name}</p>
                  <p className="text-muted-foreground text-sm">
                    {t(`builder.distributions.${name}`)}
                  </p>
                </div>
                <button
                  type="button"
                  className={SECONDARY_BUTTON_CLASS}
                  disabled={ids.length === 0}
                  aria-label={t("builder.distributions.addAriaLabel", { count: ids.length, name })}
                  onClick={() => setOutcome(applyImport({ componentIds: ids, unrecognized: [] }))}
                >
                  {t("builder.distributions.add", { count: ids.length })}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </ImportDialogShell>
  );
}
