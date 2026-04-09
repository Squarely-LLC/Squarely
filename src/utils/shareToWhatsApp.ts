import { useNotificationsStore } from "@/stores/notifications";

type ShareResult = { success: boolean; reason?: string };

async function shareToWhatsApp({
  file,
  url,
  text,
}: {
  file?: File;
  url?: string;
  text?: string;
}): Promise<ShareResult> {
  const notifications = useNotificationsStore();

  // Try Web Share API with files when available (mobile / modern browsers)
  try {
    if (
      navigator.share &&
      file &&
      (navigator as any).canShare?.({ files: [file] })
    ) {
      await navigator.share({ files: [file], text: text ?? "", title: "" });
      notifications.push(
        "Shared to WhatsApp (via OS share sheet)",
        "success",
        3000,
      );
      return { success: true };
    }
  } catch (err) {
    // ignore and fall back
  }

  // If we don't have a file share, try to open WhatsApp Web with a prefilled message.
  try {
    const messageParts: string[] = [];
    if (text) messageParts.push(text);
    if (url) messageParts.push(url);
    const message = encodeURIComponent(messageParts.join("\n"));

    // If on mobile, use wa.me; otherwise open web.whatsapp.com
    const isMobile = /Android|iPhone|iPad|iPod/i.test(
      navigator.userAgent || "",
    );
    const base = isMobile
      ? "https://wa.me/?text="
      : "https://web.whatsapp.com/send?text=";
    const target = base + message;
    window.open(target, "_blank");
    notifications.push("Opened WhatsApp to share attachment", "success", 3000);
    return { success: true };
  } catch (err: any) {
    notifications.push(
      "Failed to open WhatsApp: " + String(err ?? "unknown"),
      "error",
      4500,
    );
    return { success: false, reason: String(err ?? "unknown") };
  }
}

export { shareToWhatsApp };
export type { ShareResult };
