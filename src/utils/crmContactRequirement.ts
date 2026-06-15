import type {
  CrmContactRequirement,
  CrmEntitySettings,
} from "@/plugins/fake-api/handlers/config/types";

export const CONTACT_REQUIREMENT_OPTIONS: Array<{
  title: string;
  value: CrmContactRequirement;
}> = [
  { title: "None", value: "none" },
  { title: "Phone", value: "phone" },
  { title: "Email", value: "email" },
  { title: "Phone and email", value: "both" },
  { title: "Phone or email", value: "either" },
];

export const resolveContactRequirement = (
  settings?: CrmEntitySettings | null,
): CrmContactRequirement => {
  const explicit = settings?.contactRequirement;
  if (
    explicit === "none" ||
    explicit === "phone" ||
    explicit === "email" ||
    explicit === "both" ||
    explicit === "either"
  ) {
    return explicit;
  }

  if (settings?.requirePhone && settings?.requireEmail) return "both";
  if (settings?.requirePhone) return "phone";
  if (settings?.requireEmail) return "email";

  return "none";
};

export const contactRequirementToFlags = (
  requirement: CrmContactRequirement,
) => ({
  requirePhone: requirement === "phone" || requirement === "both",
  requireEmail: requirement === "email" || requirement === "both",
});
