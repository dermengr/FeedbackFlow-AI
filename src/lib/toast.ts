import { toast } from "sonner";

export type ToastType = "success" | "error" | "info" | "warning";

export function showToast(message: string, type: ToastType = "info", description?: string) {
  switch (type) {
    case "success":
      toast.success(message, { description });
      break;
    case "error":
      toast.error(message, { description });
      break;
    case "warning":
      toast.warning(message, { description });
      break;
    default:
      toast.info(message, { description });
  }
}

export function dismissToast(toastId?: string) {
  if (toastId) {
    toast.dismiss(toastId);
  } else {
    toast.dismiss();
  }
}

export { toast };
