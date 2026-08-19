"use client";

import * as React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Input,
  Label,
} from "@/ui_engine";
import { cn } from "@/lib/utils";

export interface AppConfirmOptions {
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Require an exact phrase for unusually destructive operations. */
  requiredText?: string;
}

/**
 * App-owned replacement for the browser's native confirmation dialog.
 *
 * It keeps the call site sequential with an awaited boolean result while
 * rendering an accessible AlertDialog that the browser cannot permanently
 * suppress. Only one request can be active per hook instance; a superseded or
 * unmounted request resolves to `false`.
 */
export function useAppConfirm() {
  const [request, setRequest] = React.useState<AppConfirmOptions | null>(null);
  const [typedValue, setTypedValue] = React.useState("");
  const resolveRef = React.useRef<((confirmed: boolean) => void) | null>(null);

  const settle = React.useCallback((confirmed: boolean) => {
    const resolve = resolveRef.current;
    resolveRef.current = null;
    setRequest(null);
    setTypedValue("");
    resolve?.(confirmed);
  }, []);

  const confirm = React.useCallback((options: AppConfirmOptions) => {
    resolveRef.current?.(false);
    setTypedValue("");
    setRequest(options);
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  React.useEffect(
    () => () => {
      resolveRef.current?.(false);
      resolveRef.current = null;
    },
    []
  );

  const requiredTextMatches =
    !request?.requiredText || typedValue === request.requiredText;

  const dialog = (
    <AlertDialog
      open={request !== null}
      onOpenChange={(open) => {
        if (!open) settle(false);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{request?.title}</AlertDialogTitle>
          <AlertDialogDescription>{request?.description}</AlertDialogDescription>
        </AlertDialogHeader>

        {request?.requiredText ? (
          <div className="flex flex-col gap-[calc(var(--ui-section-gap)/4)]">
            <Label htmlFor="app-confirm-required-text">
              Type <strong>{request.requiredText}</strong> to confirm
            </Label>
            <Input
              id="app-confirm-required-text"
              value={typedValue}
              onChange={(event) => setTypedValue(event.target.value)}
              autoComplete="off"
            />
          </div>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel>{request?.cancelLabel ?? "Cancel"}</AlertDialogCancel>
          <AlertDialogAction
            disabled={!requiredTextMatches}
            onClick={(event) => {
              event.preventDefault();
              settle(true);
            }}
            className={cn(
              "bg-[var(--ui-change-before)] text-[var(--ui-text-inverse)] hover:bg-[color-mix(in_srgb,var(--ui-change-before)_88%,black)]"
            )}
          >
            {request?.confirmLabel ?? "Confirm"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { confirm, dialog };
}
