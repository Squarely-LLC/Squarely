import { useNotificationsStore } from "@/stores/notifications";

type ShareResult = { success: boolean; reason?: string };

async function openWhatsAppIntent({
  url,
  text,
}: {
  url?: string;
  text?: string;
}): Promise<ShareResult> {
  const notifications = useNotificationsStore();

  try {
    const messageParts: string[] = [];
    if (text) messageParts.push(text);
    if (url) messageParts.push(url);
    const message = encodeURIComponent(messageParts.join("\n"));

    const isMobile = /Android|iPhone|iPad|iPod/i.test(
      navigator.userAgent || "",
    );
    const target = isMobile
      ? `whatsapp://send?text=${message}`
      : `https://web.whatsapp.com/send?text=${message}`;

    window.open(target, "_blank", "noopener");
    notifications.push("Opened WhatsApp", "success", 3000);
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
    if (navigator.share && file) {
      const canShareFiles = (navigator as any).canShare?.({ files: [file] });
      if (canShareFiles === false)
        throw new Error("File sharing is not supported in this browser");

      await navigator.share({
        files: [file],
        text: text ?? "",
        title: file.name,
      });
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

export { openWhatsAppIntent, shareToWhatsApp };
export type { ShareResult };
