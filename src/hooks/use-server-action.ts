import { useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function useServerAction<T, P extends any[]>(
  action: (...args: P) => Promise<T>,
  options?: {
    onSuccess?: (result: T) => void;
    successMessage?: string;
  }
) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const runAction = async (...args: P) => {
    startTransition(async () => {
      try {
        const result = await action(...args);
        toast.success(options?.successMessage || "Action successful");
        router.refresh();
        if (options?.onSuccess) options.onSuccess(result);
      } catch (error: unknown) {
        console.error(error);
        toast.error(error instanceof Error ? error.message : "Something went wrong");
      }
    });
  };

  return { runAction, isPending };
}
