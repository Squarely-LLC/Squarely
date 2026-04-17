import { useNotificationsStore } from "@/stores/notifications";

type SystemShareOptions = {
  file?: File;
  text?: string;
  title?: string;
  url?: string;
};

async function shareWithSystem({ file, text, title, url }: SystemShareOptions) {
  const notifications = useNotificationsStore();

  if (!navigator.share) {
    notifications.push(
      "System share is not available in this browser",
      "error",
      4000,
    );
    return false;
  }

  try {
    const payload: ShareData = {
      text: text ?? "",
      title: title ?? file?.name ?? "Share",
      url,
    };

    if (file) {
      const canShareFiles = (
        navigator as Navigator & {
          canShare?: (data?: ShareData) => boolean;
        }
      ).canShare?.({ files: [file] });

      if (canShareFiles === false) {
        notifications.push(
          "File sharing is not supported in this browser",
          "error",
          4000,
        );
        return false;
      }

      payload.files = [file];
    }

    await navigator.share(payload);
    notifications.push("Opened share dialog", "success", 3000);
    return true;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError")
      return false;

    notifications.push(
      "Failed to open share dialog: " + String(error ?? "unknown"),
      "error",
      4500,
    );
    return false;
  }
}

export { shareWithSystem };
export type { SystemShareOptions };
