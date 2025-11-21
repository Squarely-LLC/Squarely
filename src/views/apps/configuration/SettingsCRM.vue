<script setup lang="ts">
import { useConfigStore } from "@/stores/config";
import { useNotificationsStore } from "@/stores/notifications";
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";

const store = useConfigStore();
store.init();
const notifications = useNotificationsStore();

const categories = ref<string[]>([]);
const categoriesModel = ref<string[]>([]);
const lastCommittedCategories = ref<string[]>([]);
const isSavingCategories = ref(false);
const searchValue = ref("");
const lastTypedValue = ref("");
const hoveredChip = ref<string | null>(null);
const editingChip = ref<{ original: string; index: number } | null>(null);
const editingValue = ref("");
const editingDuplicate = ref(false);
const editingInputRef = ref<HTMLInputElement | null>(null);
const editingChipElement = ref<HTMLElement | null>(null);
const pendingEditDecision = ref<{ formatted: string } | null>(null);
const isEditConfirmDialogVisible = ref(false);
const isDeleteDialogVisible = ref(false);
const pendingDeletion = ref<{ removed: string[]; next: string[] } | null>(null);

const requirePhone = ref(false);
const requireEmail = ref(false);
const inactiveAfterMonths = ref(0);
const isSavingFlags = ref(false);
let inactiveSaveHandle: ReturnType<typeof setTimeout> | null = null;

// Default contact type selector
const defaultContactType = ref<string>("Individual");
const isSavingDefaultContactType = ref(false);

const indCategories = ref<string[]>([]);
const indCategoriesModel = ref<string[]>([]);
const lastCommittedIndCategories = ref<string[]>([]);
const isSavingIndCategories = ref(false);
const indSearchValue = ref("");
const indLastTypedValue = ref("");
const indHoveredChip = ref<string | null>(null);
const indEditingChip = ref<{ original: string; index: number } | null>(null);
const indEditingValue = ref("");
const indEditingDuplicate = ref(false);
const indEditingInputRef = ref<HTMLInputElement | null>(null);
const indEditingChipElement = ref<HTMLElement | null>(null);
const indPendingEditDecision = ref<{ formatted: string } | null>(null);
const isIndEditConfirmVisible = ref(false);
const isIndDeleteDialogVisible = ref(false);
const indPendingDeletion = ref<{ removed: string[]; next: string[] } | null>(
  null
);
const indRequirePhone = ref(false);
const indRequireEmail = ref(false);
const indInactiveAfterMonths = ref(0);
const isSavingIndFlags = ref(false);
let indInactiveSaveHandle: ReturnType<typeof setTimeout> | null = null;

// Channels
const channels = ref<string[]>([]);
const channelsModel = ref<string[]>([]);
const lastCommittedChannels = ref<string[]>([]);
const isSavingChannels = ref(false);
const channelsSearchValue = ref("");
const channelsLastTypedValue = ref("");
const channelsHoveredChip = ref<string | null>(null);
const channelsEditingChip = ref<{ original: string; index: number } | null>(
  null
);
const channelsEditingValue = ref("");
const channelsEditingDuplicate = ref(false);
const channelsEditingInputRef = ref<HTMLInputElement | null>(null);
const channelsEditingChipElement = ref<HTMLElement | null>(null);
const channelsPendingEditDecision = ref<{ formatted: string } | null>(null);
const isChannelsEditConfirmVisible = ref(false);
const channelsPendingDeletion = ref<{
  removed: string[];
  next: string[];
} | null>(null);
const isChannelsDeleteDialogVisible = ref(false);

// Documents (as comboboxes)
const docTypes = ref<string[]>([]);
const docTypesModel = ref<string[]>([]);
const lastCommittedDocTypes = ref<string[]>([]);
const isSavingDocTypes = ref(false);
const docTypesSearchValue = ref("");
const docTypesLastTypedValue = ref("");
const docTypesHoveredChip = ref<string | null>(null);
const docTypesEditingChip = ref<{ original: string; index: number } | null>(
  null
);
const docTypesEditingValue = ref("");
const docTypesEditingDuplicate = ref(false);
const docTypesEditingInputRef = ref<HTMLInputElement | null>(null);
const docTypesEditingChipElement = ref<HTMLElement | null>(null);
const docTypesPendingEditDecision = ref<{ formatted: string } | null>(null);
const isDocTypesEditConfirmVisible = ref(false);
const docTypesPendingDeletion = ref<{
  removed: string[];
  next: string[];
} | null>(null);
const isDocTypesDeleteDialogVisible = ref(false);

const docCategories = ref<string[]>([]);
const docCategoriesModel = ref<string[]>([]);
const lastCommittedDocCategories = ref<string[]>([]);
const isSavingDocCategories = ref(false);
const docCategoriesSearchValue = ref("");
const docCategoriesLastTypedValue = ref("");
const docCategoriesHoveredChip = ref<string | null>(null);
const docCategoriesEditingChip = ref<{
  original: string;
  index: number;
} | null>(null);
const docCategoriesEditingValue = ref("");
const docCategoriesEditingDuplicate = ref(false);
const docCategoriesEditingInputRef = ref<HTMLInputElement | null>(null);
const docCategoriesEditingChipElement = ref<HTMLElement | null>(null);
const docCategoriesPendingEditDecision = ref<{ formatted: string } | null>(
  null
);
const isDocCategoriesEditConfirmVisible = ref(false);
const docCategoriesPendingDeletion = ref<{
  removed: string[];
  next: string[];
} | null>(null);
const isDocCategoriesDeleteDialogVisible = ref(false);

const documentRenewable = ref<boolean | null>(null);
const isSavingDocuments = ref(false);

// Call Purposes
const callPurposes = ref<string[]>([]);
const callPurposesModel = ref<string[]>([]);
const lastCommittedCallPurposes = ref<string[]>([]);
const isSavingCallPurposes = ref(false);
const callPurposesSearchValue = ref("");
const callPurposesLastTypedValue = ref("");
const callPurposesHoveredChip = ref<string | null>(null);
const callPurposesEditingChip = ref<{ original: string; index: number } | null>(
  null
);
const callPurposesEditingValue = ref("");
const callPurposesEditingDuplicate = ref(false);
const callPurposesEditingInputRef = ref<HTMLInputElement | null>(null);
const callPurposesEditingChipElement = ref<HTMLElement | null>(null);
const callPurposesPendingEditDecision = ref<{ formatted: string } | null>(null);
const isCallPurposesEditConfirmVisible = ref(false);
const callPurposesPendingDeletion = ref<{
  removed: string[];
  next: string[];
} | null>(null);
const isCallPurposesDeleteDialogVisible = ref(false);

// Sentiments
const sentiments = ref<string[]>([]);
const notes = ref<string[]>([]);
const sentimentsModel = ref<string[]>([]);
const lastCommittedSentiments = ref<string[]>([]);
const isSavingSentiments = ref(false);
const sentimentsSearchValue = ref("");
const sentimentsLastTypedValue = ref("");
const sentimentsHoveredChip = ref<string | null>(null);
const sentimentsEditingChip = ref<{ original: string; index: number } | null>(
  null
);
const sentimentsEditingValue = ref("");
const sentimentsEditingDuplicate = ref(false);
const sentimentsEditingInputRef = ref<HTMLInputElement | null>(null);
const sentimentsEditingChipElement = ref<HTMLElement | null>(null);
const sentimentsPendingEditDecision = ref<{ formatted: string } | null>(null);
const isSentimentsEditConfirmVisible = ref(false);
const sentimentsPendingDeletion = ref<{
  removed: string[];
  next: string[];
} | null>(null);
const isSentimentsDeleteDialogVisible = ref(false);

// Notes state
const notesModel = ref<string[]>([]);
const lastCommittedNotes = ref<string[]>([]);
const isSavingNotes = ref(false);
const notesSearchValue = ref("");
const notesLastTypedValue = ref("");
const notesHoveredChip = ref<string | null>(null);
const notesEditingChip = ref<{ original: string; index: number } | null>(null);
const notesEditingValue = ref("");
const notesEditingDuplicate = ref(false);
const notesEditingInputRef = ref<HTMLInputElement | null>(null);
const notesEditingChipElement = ref<HTMLElement | null>(null);
const notesPendingEditDecision = ref<{ formatted: string } | null>(null);
const isNotesEditConfirmVisible = ref(false);
const notesPendingDeletion = ref<{
  removed: string[];
  next: string[];
} | null>(null);
const isNotesDeleteDialogVisible = ref(false);

const categoryLabel = computed(() => "Category");
const categoryPlaceholder = computed(
  () => `Add ${categoryLabel.value.toLowerCase()}s`
);
const indCategoryPlaceholder = computed(
  () => `Add ${categoryLabel.value.toLowerCase()}s`
);

const normalizeValue = (value: string) => value.toLowerCase();
const formatEntry = (value?: string | null) => {
  const trimmed = (value ?? "").toString().trim();
  if (!trimmed) return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
};

const cleanEntries = (values?: (string | null | undefined)[] | null) => {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => formatEntry(value ?? ""))
    .filter((value) => value.length);
};

const buildCounts = (list: string[]) => {
  const counts = new Map<string, number>();
  for (const item of list) {
    counts.set(item, (counts.get(item) || 0) + 1);
  }
  return counts;
};

const diffLists = (prev: string[], next: string[]) => {
  const added: string[] = [];
  const removed: string[] = [];

  const prevCounts = buildCounts(prev.map(normalizeValue));
  const nextCounts = buildCounts(next.map(normalizeValue));

  for (const item of prev) {
    const key = normalizeValue(item);
    const remaining = nextCounts.get(key) ?? 0;
    if (remaining > 0) {
      nextCounts.set(key, remaining - 1);
    } else {
      removed.push(item);
    }
  }

  for (const item of next) {
    const key = normalizeValue(item);
    const remaining = prevCounts.get(key) ?? 0;
    if (remaining > 0) {
      prevCounts.set(key, remaining - 1);
    } else {
      added.push(item);
    }
  }

  return { added, removed };
};

let programmaticUpdateDepth = 0;
let programmaticResetHandle: ReturnType<typeof setTimeout> | null = null;

const markProgrammaticUpdate = () => {
  programmaticUpdateDepth += 1;
  if (programmaticResetHandle) clearTimeout(programmaticResetHandle);
  programmaticResetHandle = setTimeout(() => {
    programmaticUpdateDepth = 0;
    programmaticResetHandle = null;
  }, 0);
};

const shouldIgnoreUpdate = () => {
  if (programmaticUpdateDepth > 0) {
    programmaticUpdateDepth = Math.max(0, programmaticUpdateDepth - 1);
    return true;
  }
  return false;
};

const setModelValues = (values: string[], commit = false) => {
  if (commit) lastCommittedCategories.value = [...values];
  markProgrammaticUpdate();
  categoriesModel.value = [...values];
};

const setIndModelValues = (values: string[], commit = false) => {
  if (commit) lastCommittedIndCategories.value = [...values];
  markProgrammaticUpdate();
  indCategoriesModel.value = [...values];
};

const revertCategories = () => {
  setModelValues(lastCommittedCategories.value, false);
};

const revertIndCategories = () => {
  setIndModelValues(lastCommittedIndCategories.value, false);
};

const loadData = () => {
  const org = store.configurations.crm || {};
  // load default contact type (default to Individual)
  defaultContactType.value = (org as any)?.DefaultContactType ?? "Individual";
  const orgSection = org.organization || {};
  requirePhone.value = !!orgSection.requirePhone;
  requireEmail.value = !!orgSection.requireEmail;
  inactiveAfterMonths.value = Number(orgSection.inactiveAfterMonths ?? 0);
  const cats = (org as any)?.organizationCategories || [];
  categories.value = cleanEntries(cats);
  lastCommittedCategories.value = [...categories.value];
  setModelValues(categories.value, false);

  const indSection = org.individual || {};
  indRequirePhone.value = !!indSection.requirePhone;
  indRequireEmail.value = !!indSection.requireEmail;
  indInactiveAfterMonths.value = Number(indSection.inactiveAfterMonths ?? 0);
  const indCats = (org as any)?.individualCategories || [];
  indCategories.value = cleanEntries(indCats);
  lastCommittedIndCategories.value = [...indCategories.value];
  setIndModelValues(indCategories.value, false);

  const ch = (org as any)?.channels || [];
  channels.value = cleanEntries(ch);
  lastCommittedChannels.value = [...channels.value];
  channelsModel.value = [...channels.value];

  const cp = (org as any)?.callPurposes || [];
  callPurposes.value = cleanEntries(cp);
  lastCommittedCallPurposes.value = [...callPurposes.value];
  callPurposesModel.value = [...callPurposes.value];

  const st = (org as any)?.sentiment || [];
  sentiments.value = cleanEntries(st);
  lastCommittedSentiments.value = [...sentiments.value];
  sentimentsModel.value = [...sentiments.value];

  const nt = (org as any)?.notes || [];
  notes.value = cleanEntries(nt);
  lastCommittedNotes.value = [...notes.value];
  notesModel.value = [...notes.value];

  // load documents settings — prefer explicit arrays, fallback to legacy `documents` entry
  const explicitTypes = (org as any)?.documentTypes;
  const explicitCats = (org as any)?.documentCategories;
  if (Array.isArray(explicitTypes) || Array.isArray(explicitCats)) {
    const typesArr = Array.isArray(explicitTypes) ? explicitTypes : [];
    docTypes.value = cleanEntries(typesArr);
    lastCommittedDocTypes.value = [...docTypes.value];
    docTypesModel.value = [...docTypes.value];

    const catsArr = Array.isArray(explicitCats) ? explicitCats : [];
    docCategories.value = cleanEntries(catsArr);
    lastCommittedDocCategories.value = [...docCategories.value];
    docCategoriesModel.value = [...docCategories.value];

    // documentRenewable: support stored string 'yes'/'no' or boolean
    const dr = (org as any)?.documentRenewable;
    if (typeof dr === "string") {
      documentRenewable.value =
        dr === "yes" ? true : dr === "no" ? false : null;
    } else if (typeof dr === "boolean") {
      documentRenewable.value = dr;
    } else {
      documentRenewable.value = null;
    }
  } else {
    // legacy: single documents entry
    const docs = (org as any)?.documents || [];
    const docEntry = docs[0] || {};
    const typesArr = (docEntry.type || "").toString().split(",");
    docTypes.value = cleanEntries(typesArr);
    lastCommittedDocTypes.value = [...docTypes.value];
    docTypesModel.value = [...docTypes.value];

    const catsArr = (docEntry.category || "").toString().split(",");
    docCategories.value = cleanEntries(catsArr);
    lastCommittedDocCategories.value = [...docCategories.value];
    docCategoriesModel.value = [...docCategories.value];

    documentRenewable.value =
      typeof docEntry.renewable === "boolean" ? docEntry.renewable : null;
  }
};

onMounted(loadData);

const handleChipClose = (name: string) => {
  if (
    editingChip.value &&
    normalizeValue(editingChip.value.original) === normalizeValue(name)
  )
    return;
  const next = categoriesModel.value.filter(
    (val) => normalizeValue(val) !== normalizeValue(name)
  );
  pendingDeletion.value = { removed: [name], next };
  isDeleteDialogVisible.value = true;
  revertCategories();
};

const handleIndChipClose = (name: string) => {
  if (
    indEditingChip.value &&
    normalizeValue(indEditingChip.value.original) === normalizeValue(name)
  )
    return;
  const next = indCategoriesModel.value.filter(
    (val) => normalizeValue(val) !== normalizeValue(name)
  );
  indPendingDeletion.value = { removed: [name], next };
  isIndDeleteDialogVisible.value = true;
  revertIndCategories();
};

const startChannelsEditingChip = async (name: string) => {
  const index = lastCommittedChannels.value.findIndex(
    (item) => normalizeValue(item) === normalizeValue(name)
  );
  if (index === -1) return;
  channelsHoveredChip.value = null;
  channelsEditingChip.value = { original: name, index };
  channelsEditingValue.value = name;
  channelsEditingDuplicate.value = false;
  await nextTick();
  channelsEditingInputRef.value?.focus();
  channelsEditingInputRef.value?.select();
};

const startCallPurposesEditingChip = async (name: string) => {
  const index = lastCommittedCallPurposes.value.findIndex(
    (item) => normalizeValue(item) === normalizeValue(name)
  );
  if (index === -1) return;
  callPurposesHoveredChip.value = null;
  callPurposesEditingChip.value = { original: name, index };
  callPurposesEditingValue.value = name;
  callPurposesEditingDuplicate.value = false;
  await nextTick();
  callPurposesEditingInputRef.value?.focus();
  callPurposesEditingInputRef.value?.select();
};

const startSentimentsEditingChip = async (name: string) => {
  const index = lastCommittedSentiments.value.findIndex(
    (item) => normalizeValue(item) === normalizeValue(name)
  );
  if (index === -1) return;
  sentimentsHoveredChip.value = null;
  sentimentsEditingChip.value = { original: name, index };
  sentimentsEditingValue.value = name;
  sentimentsEditingDuplicate.value = false;
  await nextTick();
  sentimentsEditingInputRef.value?.focus();
  sentimentsEditingInputRef.value?.select();
};

const startEditingChip = async (name: string) => {
  const index = lastCommittedCategories.value.findIndex(
    (item) => normalizeValue(item) === normalizeValue(name)
  );
  if (index === -1) return;
  hoveredChip.value = null;
  editingChip.value = { original: name, index };
  editingValue.value = name;
  editingDuplicate.value = false;
  await nextTick();
  editingInputRef.value?.focus();
  editingInputRef.value?.select();
};

const startIndEditingChip = async (name: string) => {
  const index = lastCommittedIndCategories.value.findIndex(
    (item) => normalizeValue(item) === normalizeValue(name)
  );
  if (index === -1) return;
  indHoveredChip.value = null;
  indEditingChip.value = { original: name, index };
  indEditingValue.value = name;
  indEditingDuplicate.value = false;
  await nextTick();
  indEditingInputRef.value?.focus();
  indEditingInputRef.value?.select();
};

// Documents editing helpers - Types
const startDocTypesEditingChip = async (name: string) => {
  const index = lastCommittedDocTypes.value.findIndex(
    (item) => normalizeValue(item) === normalizeValue(name)
  );
  if (index === -1) return;
  docTypesHoveredChip.value = null;
  docTypesEditingChip.value = { original: name, index };
  docTypesEditingValue.value = name;
  docTypesEditingDuplicate.value = false;
  await nextTick();
  docTypesEditingInputRef.value?.focus();
  docTypesEditingInputRef.value?.select();
};

const startDocCategoriesEditingChip = async (name: string) => {
  const index = lastCommittedDocCategories.value.findIndex(
    (item) => normalizeValue(item) === normalizeValue(name)
  );
  if (index === -1) return;
  docCategoriesHoveredChip.value = null;
  docCategoriesEditingChip.value = { original: name, index };
  docCategoriesEditingValue.value = name;
  docCategoriesEditingDuplicate.value = false;
  await nextTick();
  docCategoriesEditingInputRef.value?.focus();
  docCategoriesEditingInputRef.value?.select();
};

const cancelDocTypesChipEdit = () => {
  docTypesEditingChip.value = null;
  docTypesEditingValue.value = "";
  docTypesEditingDuplicate.value = false;
  docTypesEditingChipElement.value = null;
};

const cancelDocCategoriesChipEdit = () => {
  docCategoriesEditingChip.value = null;
  docCategoriesEditingValue.value = "";
  docCategoriesEditingDuplicate.value = false;
  docCategoriesEditingChipElement.value = null;
};

const commitDocTypesChipEdit = async () => {
  if (!docTypesEditingChip.value) return;
  const formatted = formatEntry(docTypesEditingValue.value);
  if (!formatted) {
    notifications.push("Document type cannot be empty", "warning", 2000);
    docTypesEditingValue.value = docTypesEditingChip.value.original;
    return;
  }

  const currentList = [...lastCommittedDocTypes.value];
  const targetIndex = docTypesEditingChip.value.index;
  const originalNormalized = normalizeValue(docTypesEditingChip.value.original);
  const nextNormalized = normalizeValue(formatted);

  if (
    targetIndex < 0 ||
    targetIndex >= currentList.length ||
    normalizeValue(currentList[targetIndex]) !== originalNormalized
  ) {
    cancelDocTypesChipEdit();
    revertDocTypes();
    return;
  }

  const duplicateExists = currentList.some((item, index) => {
    if (index === targetIndex) return false;
    return normalizeValue(item) === nextNormalized;
  });

  if (duplicateExists) {
    notifications.push("Document type already exists", "warning", 2000);
    docTypesEditingDuplicate.value = true;
    return;
  }

  if (currentList[targetIndex] === formatted) {
    cancelDocTypesChipEdit();
    return;
  }

  currentList[targetIndex] = formatted;
  cancelDocTypesChipEdit();
  setDocTypesModelValues(currentList, true);
  await saveDocuments();
};

const commitDocCategoriesChipEdit = async () => {
  if (!docCategoriesEditingChip.value) return;
  const formatted = formatEntry(docCategoriesEditingValue.value);
  if (!formatted) {
    notifications.push("Document category cannot be empty", "warning", 2000);
    docCategoriesEditingValue.value = docCategoriesEditingChip.value.original;
    return;
  }

  const currentList = [...lastCommittedDocCategories.value];
  const targetIndex = docCategoriesEditingChip.value.index;
  const originalNormalized = normalizeValue(
    docCategoriesEditingChip.value.original
  );
  const nextNormalized = normalizeValue(formatted);

  if (
    targetIndex < 0 ||
    targetIndex >= currentList.length ||
    normalizeValue(currentList[targetIndex]) !== originalNormalized
  ) {
    cancelDocCategoriesChipEdit();
    revertDocCategories();
    return;
  }

  const duplicateExists = currentList.some((item, index) => {
    if (index === targetIndex) return false;
    return normalizeValue(item) === nextNormalized;
  });

  if (duplicateExists) {
    notifications.push("Document category already exists", "warning", 2000);
    docCategoriesEditingDuplicate.value = true;
    return;
  }

  if (currentList[targetIndex] === formatted) {
    cancelDocCategoriesChipEdit();
    return;
  }

  currentList[targetIndex] = formatted;
  cancelDocCategoriesChipEdit();
  setDocCategoriesModelValues(currentList, true);
  await saveDocuments();
};

const cancelChannelsChipEdit = () => {
  channelsEditingChip.value = null;
  channelsEditingValue.value = "";
  channelsEditingDuplicate.value = false;
  channelsEditingChipElement.value = null;
};

const cancelCallPurposesChipEdit = () => {
  callPurposesEditingChip.value = null;
  callPurposesEditingValue.value = "";
  callPurposesEditingDuplicate.value = false;
  callPurposesEditingChipElement.value = null;
};

const cancelSentimentsChipEdit = () => {
  sentimentsEditingChip.value = null;
  sentimentsEditingValue.value = "";
  sentimentsEditingDuplicate.value = false;
  sentimentsEditingChipElement.value = null;
};

const cancelChipEdit = () => {
  editingChip.value = null;
  editingValue.value = "";
  editingDuplicate.value = false;
  editingChipElement.value = null;
};

const cancelIndChipEdit = () => {
  indEditingChip.value = null;
  indEditingValue.value = "";
  indEditingDuplicate.value = false;
  indEditingChipElement.value = null;
};

const commitChannelsChipEdit = async () => {
  if (!channelsEditingChip.value) return;
  const formatted = formatEntry(channelsEditingValue.value);
  if (!formatted) {
    notifications.push("Channel cannot be empty", "warning", 2000);
    channelsEditingValue.value = channelsEditingChip.value.original;
    return;
  }

  const currentList = [...lastCommittedChannels.value];
  const targetIndex = channelsEditingChip.value.index;
  const originalNormalized = normalizeValue(channelsEditingChip.value.original);
  const nextNormalized = normalizeValue(formatted);

  if (
    targetIndex < 0 ||
    targetIndex >= currentList.length ||
    normalizeValue(currentList[targetIndex]) !== originalNormalized
  ) {
    cancelChannelsChipEdit();
    revertChannels();
    return;
  }

  const duplicateExists = currentList.some((item, index) => {
    if (index === targetIndex) return false;
    return normalizeValue(item) === nextNormalized;
  });

  if (duplicateExists) {
    notifications.push("Channel already exists", "warning", 2000);
    channelsEditingDuplicate.value = true;
    return;
  }

  if (currentList[targetIndex] === formatted) {
    cancelChannelsChipEdit();
    return;
  }

  currentList[targetIndex] = formatted;
  cancelChannelsChipEdit();
  setChannelsModelValues(currentList, true);
  await saveChannels(currentList);
};

const commitCallPurposesChipEdit = async () => {
  if (!callPurposesEditingChip.value) return;
  const formatted = formatEntry(callPurposesEditingValue.value);
  if (!formatted) {
    notifications.push("Call purpose cannot be empty", "warning", 2000);
    callPurposesEditingValue.value = callPurposesEditingChip.value.original;
    return;
  }

  const currentList = [...lastCommittedCallPurposes.value];
  const targetIndex = callPurposesEditingChip.value.index;
  const originalNormalized = normalizeValue(
    callPurposesEditingChip.value.original
  );
  const nextNormalized = normalizeValue(formatted);

  if (
    targetIndex < 0 ||
    targetIndex >= currentList.length ||
    normalizeValue(currentList[targetIndex]) !== originalNormalized
  ) {
    cancelCallPurposesChipEdit();
    revertCallPurposes();
    return;
  }

  const duplicateExists = currentList.some((item, index) => {
    if (index === targetIndex) return false;
    return normalizeValue(item) === nextNormalized;
  });

  if (duplicateExists) {
    notifications.push("Call purpose already exists", "warning", 2000);
    callPurposesEditingDuplicate.value = true;
    return;
  }

  if (currentList[targetIndex] === formatted) {
    cancelCallPurposesChipEdit();
    return;
  }

  currentList[targetIndex] = formatted;
  cancelCallPurposesChipEdit();
  setCallPurposesModelValues(currentList, true);
  await saveCallPurposes(currentList);
};

const commitSentimentsChipEdit = async () => {
  if (!sentimentsEditingChip.value) return;
  const formatted = formatEntry(sentimentsEditingValue.value);
  if (!formatted) {
    notifications.push("Sentiment cannot be empty", "warning", 2000);
    sentimentsEditingValue.value = sentimentsEditingChip.value.original;
    return;
  }

  const currentList = [...lastCommittedSentiments.value];
  const targetIndex = sentimentsEditingChip.value.index;
  const originalNormalized = normalizeValue(
    sentimentsEditingChip.value.original
  );
  const nextNormalized = normalizeValue(formatted);

  if (
    targetIndex < 0 ||
    targetIndex >= currentList.length ||
    normalizeValue(currentList[targetIndex]) !== originalNormalized
  ) {
    cancelSentimentsChipEdit();
    revertSentiments();
    return;
  }

  const duplicateExists = currentList.some((item, index) => {
    if (index === targetIndex) return false;
    return normalizeValue(item) === nextNormalized;
  });

  if (duplicateExists) {
    notifications.push("Sentiment already exists", "warning", 2000);
    sentimentsEditingDuplicate.value = true;
    return;
  }

  if (currentList[targetIndex] === formatted) {
    cancelSentimentsChipEdit();
    return;
  }

  currentList[targetIndex] = formatted;
  cancelSentimentsChipEdit();
  setSentimentsModelValues(currentList, true);
  await saveSentiments(currentList);
};

const commitChipEdit = async () => {
  if (!editingChip.value) return;
  const formatted = formatEntry(editingValue.value);
  if (!formatted) {
    notifications.push("Category cannot be empty", "warning", 2000);
    editingValue.value = editingChip.value.original;
    return;
  }

  const currentList = [...lastCommittedCategories.value];
  const targetIndex = editingChip.value.index;
  const originalNormalized = normalizeValue(editingChip.value.original);
  const nextNormalized = normalizeValue(formatted);

  if (
    targetIndex < 0 ||
    targetIndex >= currentList.length ||
    normalizeValue(currentList[targetIndex]) !== originalNormalized
  ) {
    cancelChipEdit();
    revertCategories();
    return;
  }

  const duplicateExists = currentList.some((item, index) => {
    if (index === targetIndex) return false;
    return normalizeValue(item) === nextNormalized;
  });

  if (duplicateExists) {
    notifications.push("Category already exists", "warning", 2000);
    editingDuplicate.value = true;
    return;
  }

  if (currentList[targetIndex] === formatted) {
    cancelChipEdit();
    return;
  }

  currentList[targetIndex] = formatted;
  cancelChipEdit();
  setModelValues(currentList, true);
  await saveCategories(currentList);
};

const commitIndChipEdit = async () => {
  if (!indEditingChip.value) return;
  const formatted = formatEntry(indEditingValue.value);
  if (!formatted) {
    notifications.push("Category cannot be empty", "warning", 2000);
    indEditingValue.value = indEditingChip.value.original;
    return;
  }

  const currentList = [...lastCommittedIndCategories.value];
  const targetIndex = indEditingChip.value.index;
  const originalNormalized = normalizeValue(indEditingChip.value.original);
  const nextNormalized = normalizeValue(formatted);

  if (
    targetIndex < 0 ||
    targetIndex >= currentList.length ||
    normalizeValue(currentList[targetIndex]) !== originalNormalized
  ) {
    cancelIndChipEdit();
    revertIndCategories();
    return;
  }

  const duplicateExists = currentList.some((item, index) => {
    if (index === targetIndex) return false;
    return normalizeValue(item) === nextNormalized;
  });

  if (duplicateExists) {
    notifications.push("Category already exists", "warning", 2000);
    indEditingDuplicate.value = true;
    return;
  }

  if (currentList[targetIndex] === formatted) {
    cancelIndChipEdit();
    return;
  }

  currentList[targetIndex] = formatted;
  cancelIndChipEdit();
  setIndModelValues(currentList, true);
  await saveIndCategories(currentList);
};

const handleEditKeydown = async (event: KeyboardEvent) => {
  if (event.key === "Enter" || event.key === "Tab") {
    event.preventDefault();
    event.stopPropagation();
    await commitChipEdit();
  } else if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    cancelChipEdit();
    revertCategories();
  }
};

const handleIndEditKeydown = async (event: KeyboardEvent) => {
  if (event.key === "Enter" || event.key === "Tab") {
    event.preventDefault();
    event.stopPropagation();
    await commitIndChipEdit();
  } else if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    cancelIndChipEdit();
    revertIndCategories();
  }
};

const handleChannelsEditKeydown = async (event: KeyboardEvent) => {
  if (event.key === "Enter" || event.key === "Tab") {
    event.preventDefault();
    event.stopPropagation();
    await commitChannelsChipEdit();
  } else if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    cancelChannelsChipEdit();
    revertChannels();
  }
};

const handleCallPurposesEditKeydown = async (event: KeyboardEvent) => {
  if (event.key === "Enter" || event.key === "Tab") {
    event.preventDefault();
    event.stopPropagation();
    await commitCallPurposesChipEdit();
  } else if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    cancelCallPurposesChipEdit();
    revertCallPurposes();
  }
};

const handleSentimentsEditKeydown = async (event: KeyboardEvent) => {
  if (event.key === "Enter" || event.key === "Tab") {
    event.preventDefault();
    event.stopPropagation();
    await commitSentimentsChipEdit();
  } else if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    cancelSentimentsChipEdit();
    revertSentiments();
  }
};

const resolveElement = (el: any): HTMLElement | null => {
  if (!el) return null;
  if (el instanceof HTMLElement) return el;
  if (el?.$el instanceof HTMLElement) return el.$el;
  return null;
};

const registerChipElement = (el: any, name: string) => {
  const domEl = resolveElement(el);
  if (
    editingChip.value &&
    normalizeValue(editingChip.value.original) === normalizeValue(name)
  ) {
    editingChipElement.value = domEl;
  } else if (
    !domEl &&
    editingChipElement.value &&
    editingChip.value &&
    normalizeValue(editingChip.value.original) === normalizeValue(name)
  ) {
    editingChipElement.value = null;
  }
};

const registerIndChipElement = (el: any, name: string) => {
  const domEl = resolveElement(el);
  if (
    indEditingChip.value &&
    normalizeValue(indEditingChip.value.original) === normalizeValue(name)
  ) {
    indEditingChipElement.value = domEl;
  } else if (
    !domEl &&
    indEditingChipElement.value &&
    indEditingChip.value &&
    normalizeValue(indEditingChip.value.original) === normalizeValue(name)
  ) {
    indEditingChipElement.value = null;
  }
};

const registerChannelsChipElement = (el: any, name: string) => {
  const domEl = resolveElement(el);
  if (
    channelsEditingChip.value &&
    normalizeValue(channelsEditingChip.value.original) === normalizeValue(name)
  ) {
    channelsEditingChipElement.value = domEl;
  } else if (
    !domEl &&
    channelsEditingChipElement.value &&
    channelsEditingChip.value &&
    normalizeValue(channelsEditingChip.value.original) === normalizeValue(name)
  ) {
    channelsEditingChipElement.value = null;
  }
};

const registerCallPurposesChipElement = (el: any, name: string) => {
  const domEl = resolveElement(el);
  if (
    callPurposesEditingChip.value &&
    normalizeValue(callPurposesEditingChip.value.original) ===
      normalizeValue(name)
  ) {
    callPurposesEditingChipElement.value = domEl;
  } else if (
    !domEl &&
    callPurposesEditingChipElement.value &&
    callPurposesEditingChip.value &&
    normalizeValue(callPurposesEditingChip.value.original) ===
      normalizeValue(name)
  ) {
    callPurposesEditingChipElement.value = null;
  }
};

const registerSentimentsChipElement = (el: any, name: string) => {
  const domEl = resolveElement(el);
  if (
    sentimentsEditingChip.value &&
    normalizeValue(sentimentsEditingChip.value.original) ===
      normalizeValue(name)
  ) {
    sentimentsEditingChipElement.value = domEl;
  } else if (
    !domEl &&
    sentimentsEditingChipElement.value &&
    sentimentsEditingChip.value &&
    normalizeValue(sentimentsEditingChip.value.original) ===
      normalizeValue(name)
  ) {
    sentimentsEditingChipElement.value = null;
  }
};

const registerDocTypesChipElement = (el: any, name: string) => {
  const domEl = resolveElement(el);
  if (
    docTypesEditingChip.value &&
    normalizeValue(docTypesEditingChip.value.original) === normalizeValue(name)
  ) {
    docTypesEditingChipElement.value = domEl;
  } else if (
    !domEl &&
    docTypesEditingChipElement.value &&
    docTypesEditingChip.value &&
    normalizeValue(docTypesEditingChip.value.original) === normalizeValue(name)
  ) {
    docTypesEditingChipElement.value = null;
  }
};

const registerDocCategoriesChipElement = (el: any, name: string) => {
  const domEl = resolveElement(el);
  if (
    docCategoriesEditingChip.value &&
    normalizeValue(docCategoriesEditingChip.value.original) ===
      normalizeValue(name)
  ) {
    docCategoriesEditingChipElement.value = domEl;
  } else if (
    !domEl &&
    docCategoriesEditingChipElement.value &&
    docCategoriesEditingChip.value &&
    normalizeValue(docCategoriesEditingChip.value.original) ===
      normalizeValue(name)
  ) {
    docCategoriesEditingChipElement.value = null;
  }
};

const isEventInsideEditingChip = (target: EventTarget | null) => {
  if (!target) return false;
  const node = target as Node;
  if (editingInputRef.value && editingInputRef.value.contains(node))
    return true;
  if (editingChipElement.value && editingChipElement.value.contains(node))
    return true;
  return false;
};

const isEventInsideIndEditingChip = (target: EventTarget | null) => {
  if (!target) return false;
  const node = target as Node;
  if (indEditingInputRef.value && indEditingInputRef.value.contains(node))
    return true;
  if (indEditingChipElement.value && indEditingChipElement.value.contains(node))
    return true;
  return false;
};

const isEventInsideChannelsEditingChip = (target: EventTarget | null) => {
  if (!target) return false;
  const node = target as Node;
  if (
    channelsEditingInputRef.value &&
    channelsEditingInputRef.value.contains(node)
  )
    return true;
  if (
    channelsEditingChipElement.value &&
    channelsEditingChipElement.value.contains(node)
  )
    return true;
  return false;
};

const isEventInsideCallPurposesEditingChip = (target: EventTarget | null) => {
  if (!target) return false;
  const node = target as Node;
  if (
    callPurposesEditingInputRef.value &&
    callPurposesEditingInputRef.value.contains(node)
  )
    return true;
  if (
    callPurposesEditingChipElement.value &&
    callPurposesEditingChipElement.value.contains(node)
  )
    return true;
  return false;
};

const isEventInsideSentimentsEditingChip = (target: EventTarget | null) => {
  if (!target) return false;
  const node = target as Node;
  if (
    sentimentsEditingInputRef.value &&
    sentimentsEditingInputRef.value.contains(node)
  )
    return true;
  if (
    sentimentsEditingChipElement.value &&
    sentimentsEditingChipElement.value.contains(node)
  )
    return true;
  return false;
};

const isEventInsideDocTypesEditingChip = (target: EventTarget | null) => {
  if (!target) return false;
  const node = target as Node;
  if (
    docTypesEditingInputRef.value &&
    docTypesEditingInputRef.value.contains(node)
  )
    return true;
  if (
    docTypesEditingChipElement.value &&
    docTypesEditingChipElement.value.contains(node)
  )
    return true;
  return false;
};

const isEventInsideDocCategoriesEditingChip = (target: EventTarget | null) => {
  if (!target) return false;
  const node = target as Node;
  if (
    docCategoriesEditingInputRef.value &&
    docCategoriesEditingInputRef.value.contains(node)
  )
    return true;
  if (
    docCategoriesEditingChipElement.value &&
    docCategoriesEditingChipElement.value.contains(node)
  )
    return true;
  return false;
};

const promptEditDecisionIfNeeded = () => {
  if (!editingChip.value || isEditConfirmDialogVisible.value) return;
  if (editingDuplicate.value) {
    notifications.push("Category already exists", "warning", 2000);
    return;
  }
  const formatted = formatEntry(editingValue.value);
  if (formatted === editingChip.value.original) {
    cancelChipEdit();
    return;
  }
  pendingEditDecision.value = { formatted };
  isEditConfirmDialogVisible.value = true;
};

const promptIndEditDecisionIfNeeded = () => {
  if (!indEditingChip.value || isIndEditConfirmVisible.value) return;
  if (indEditingDuplicate.value) {
    notifications.push("Category already exists", "warning", 2000);
    return;
  }
  const formatted = formatEntry(indEditingValue.value);
  if (formatted === indEditingChip.value.original) {
    cancelIndChipEdit();
    return;
  }
  indPendingEditDecision.value = { formatted };
  isIndEditConfirmVisible.value = true;
};

const promptChannelsEditDecisionIfNeeded = () => {
  if (!channelsEditingChip.value || isChannelsEditConfirmVisible.value) return;
  if (channelsEditingDuplicate.value) {
    notifications.push("Channel already exists", "warning", 2000);
    return;
  }
  const formatted = formatEntry(channelsEditingValue.value);
  if (formatted === channelsEditingChip.value.original) {
    cancelChannelsChipEdit();
    return;
  }
  channelsPendingEditDecision.value = { formatted };
  isChannelsEditConfirmVisible.value = true;
};

const promptCallPurposesEditDecisionIfNeeded = () => {
  if (!callPurposesEditingChip.value || isCallPurposesEditConfirmVisible.value)
    return;
  if (callPurposesEditingDuplicate.value) {
    notifications.push("Call purpose already exists", "warning", 2000);
    return;
  }
  const formatted = formatEntry(callPurposesEditingValue.value);
  if (formatted === callPurposesEditingChip.value.original) {
    cancelCallPurposesChipEdit();
    return;
  }
  callPurposesPendingEditDecision.value = { formatted };
  isCallPurposesEditConfirmVisible.value = true;
};

const promptSentimentsEditDecisionIfNeeded = () => {
  if (!sentimentsEditingChip.value || isSentimentsEditConfirmVisible.value)
    return;
  if (sentimentsEditingDuplicate.value) {
    notifications.push("Sentiment already exists", "warning", 2000);
    return;
  }
  const formatted = formatEntry(sentimentsEditingValue.value);
  if (formatted === sentimentsEditingChip.value.original) {
    cancelSentimentsChipEdit();
    return;
  }
  sentimentsPendingEditDecision.value = { formatted };
  isSentimentsEditConfirmVisible.value = true;
};

const handleDocTypesEditInput = () => {
  if (!docTypesEditingChip.value) return;
  const formatted = formatEntry(docTypesEditingValue.value);
  const currentList = [...lastCommittedDocTypes.value];
  const targetIndex = docTypesEditingChip.value.index;
  const duplicateExists = currentList.some((item, index) => {
    if (index === targetIndex) return false;
    return normalizeValue(item) === normalizeValue(formatted);
  });
  if (duplicateExists && !docTypesEditingDuplicate.value) {
    notifications.push("Document type already exists", "warning", 2000);
  }
  docTypesEditingDuplicate.value = duplicateExists;
};

const handleDocCategoriesEditInput = () => {
  if (!docCategoriesEditingChip.value) return;
  const formatted = formatEntry(docCategoriesEditingValue.value);
  const currentList = [...lastCommittedDocCategories.value];
  const targetIndex = docCategoriesEditingChip.value.index;
  const duplicateExists = currentList.some((item, index) => {
    if (index === targetIndex) return false;
    return normalizeValue(item) === normalizeValue(formatted);
  });
  if (duplicateExists && !docCategoriesEditingDuplicate.value) {
    notifications.push("Document category already exists", "warning", 2000);
  }
  docCategoriesEditingDuplicate.value = duplicateExists;
};

const handleDocTypesEditKeydown = async (event: KeyboardEvent) => {
  if (event.key === "Enter" || event.key === "Tab") {
    event.preventDefault();
    event.stopPropagation();
    await commitDocTypesChipEdit();
  } else if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    cancelDocTypesChipEdit();
    revertDocTypes();
  }
};

const handleDocCategoriesEditKeydown = async (event: KeyboardEvent) => {
  if (event.key === "Enter" || event.key === "Tab") {
    event.preventDefault();
    event.stopPropagation();
    await commitDocCategoriesChipEdit();
  } else if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    cancelDocCategoriesChipEdit();
    revertDocCategories();
  }
};

const confirmDocTypesEditDecision = async () => {
  if (!docTypesPendingEditDecision.value) return;
  const { formatted } = docTypesPendingEditDecision.value;
  if (!formatted) {
    cancelDocTypesEditDecision();
    return;
  }
  docTypesPendingEditDecision.value = null;
  isDocTypesEditConfirmVisible.value = false;
  docTypesEditingValue.value = formatted;
  handleDocTypesEditInput();
  if (docTypesEditingDuplicate.value) return;
  await commitDocTypesChipEdit();
};

const cancelDocTypesEditDecision = () => {
  docTypesPendingEditDecision.value = null;
  isDocTypesEditConfirmVisible.value = false;
  cancelDocTypesChipEdit();
  revertDocTypes();
};

const confirmDocCategoriesEditDecision = async () => {
  if (!docCategoriesPendingEditDecision.value) return;
  const { formatted } = docCategoriesPendingEditDecision.value;
  if (!formatted) {
    cancelDocCategoriesEditDecision();
    return;
  }
  docCategoriesPendingEditDecision.value = null;
  isDocCategoriesEditConfirmVisible.value = false;
  docCategoriesEditingValue.value = formatted;
  handleDocCategoriesEditInput();
  if (docCategoriesEditingDuplicate.value) return;
  await commitDocCategoriesChipEdit();
};

const cancelDocCategoriesEditDecision = () => {
  docCategoriesPendingEditDecision.value = null;
  isDocCategoriesEditConfirmVisible.value = false;
  cancelDocCategoriesChipEdit();
  revertDocCategories();
};

const cancelDocTypesDeleteDialog = () => {
  isDocTypesDeleteDialogVisible.value = false;
  docTypesPendingDeletion.value = null;
  revertDocTypes();
};

const confirmDocTypesDeleteDialog = async () => {
  if (!docTypesPendingDeletion.value) return;
  const next = docTypesPendingDeletion.value.next;
  docTypesPendingDeletion.value = null;
  isDocTypesDeleteDialogVisible.value = false;
  await saveDocuments();
  setDocTypesModelValues(next, true);
};

const cancelDocCategoriesDeleteDialog = () => {
  isDocCategoriesDeleteDialogVisible.value = false;
  docCategoriesPendingDeletion.value = null;
  revertDocCategories();
};

const confirmDocCategoriesDeleteDialog = async () => {
  if (!docCategoriesPendingDeletion.value) return;
  const next = docCategoriesPendingDeletion.value.next;
  docCategoriesPendingDeletion.value = null;
  isDocCategoriesDeleteDialogVisible.value = false;
  await saveDocuments();
  setDocCategoriesModelValues(next, true);
};

const handleDocTypesClose = (name: string) => {
  if (
    docTypesEditingChip.value &&
    normalizeValue(docTypesEditingChip.value.original) === normalizeValue(name)
  )
    return;
  const next = docTypesModel.value.filter(
    (val) => normalizeValue(val) !== normalizeValue(name)
  );
  docTypesPendingDeletion.value = { removed: [name], next };
  isDocTypesDeleteDialogVisible.value = true;
  revertDocTypes();
};

const handleDocCategoriesClose = (name: string) => {
  if (
    docCategoriesEditingChip.value &&
    normalizeValue(docCategoriesEditingChip.value.original) ===
      normalizeValue(name)
  )
    return;
  const next = docCategoriesModel.value.filter(
    (val) => normalizeValue(val) !== normalizeValue(name)
  );
  docCategoriesPendingDeletion.value = { removed: [name], next };
  isDocCategoriesDeleteDialogVisible.value = true;
  revertDocCategories();
};

const promptDocTypesEditDecisionIfNeeded = () => {
  if (!docTypesEditingChip.value || isDocTypesEditConfirmVisible.value) return;
  if (docTypesEditingDuplicate.value) {
    notifications.push("Document type already exists", "warning", 2000);
    return;
  }
  const formatted = formatEntry(docTypesEditingValue.value);
  if (formatted === docTypesEditingChip.value.original) {
    cancelDocTypesChipEdit();
    return;
  }
  docTypesPendingEditDecision.value = { formatted };
  isDocTypesEditConfirmVisible.value = true;
};

const promptDocCategoriesEditDecisionIfNeeded = () => {
  if (
    !docCategoriesEditingChip.value ||
    isDocCategoriesEditConfirmVisible.value
  )
    return;
  if (docCategoriesEditingDuplicate.value) {
    notifications.push("Document category already exists", "warning", 2000);
    return;
  }
  const formatted = formatEntry(docCategoriesEditingValue.value);
  if (formatted === docCategoriesEditingChip.value.original) {
    cancelDocCategoriesChipEdit();
    return;
  }
  docCategoriesPendingEditDecision.value = { formatted };
  isDocCategoriesEditConfirmVisible.value = true;
};

const handleGlobalPointerDown = (event: PointerEvent) => {
  if (!editingChip.value) return;
  if (isEventInsideEditingChip(event.target)) return;
  promptEditDecisionIfNeeded();
};

const handleIndPointerDown = (event: PointerEvent) => {
  if (!indEditingChip.value) return;
  if (isEventInsideIndEditingChip(event.target)) return;
  promptIndEditDecisionIfNeeded();
};

const handleChannelsPointerDown = (event: PointerEvent) => {
  if (!channelsEditingChip.value) return;
  if (isEventInsideChannelsEditingChip(event.target)) return;
  promptChannelsEditDecisionIfNeeded();
};

const handleCallPurposesPointerDown = (event: PointerEvent) => {
  if (!callPurposesEditingChip.value) return;
  if (isEventInsideCallPurposesEditingChip(event.target)) return;
  promptCallPurposesEditDecisionIfNeeded();
};

const handleSentimentsPointerDown = (event: PointerEvent) => {
  if (!sentimentsEditingChip.value) return;
  if (isEventInsideSentimentsEditingChip(event.target)) return;
  promptSentimentsEditDecisionIfNeeded();
};

const handleDocTypesPointerDown = (event: PointerEvent) => {
  if (!docTypesEditingChip.value) return;
  if (isEventInsideDocTypesEditingChip(event.target)) return;
  promptDocTypesEditDecisionIfNeeded();
};

const handleDocCategoriesPointerDown = (event: PointerEvent) => {
  if (!docCategoriesEditingChip.value) return;
  if (isEventInsideDocCategoriesEditingChip(event.target)) return;
  promptDocCategoriesEditDecisionIfNeeded();
};

const confirmEditDecision = async () => {
  if (!pendingEditDecision.value) return;
  const { formatted } = pendingEditDecision.value;
  if (!formatted) {
    cancelEditDecision();
    return;
  }
  pendingEditDecision.value = null;
  isEditConfirmDialogVisible.value = false;
  editingValue.value = formatted;
  handleEditInput();
  if (editingDuplicate.value) return;
  await commitChipEdit();
};

const cancelEditDecision = () => {
  pendingEditDecision.value = null;
  isEditConfirmDialogVisible.value = false;
  cancelChipEdit();
  revertCategories();
};

const confirmIndEditDecision = async () => {
  if (!indPendingEditDecision.value) return;
  const { formatted } = indPendingEditDecision.value;
  if (!formatted) {
    cancelIndEditDecision();
    return;
  }
  indPendingEditDecision.value = null;
  isIndEditConfirmVisible.value = false;
  indEditingValue.value = formatted;
  handleIndEditInput();
  if (indEditingDuplicate.value) return;
  await commitIndChipEdit();
};

const cancelIndEditDecision = () => {
  indPendingEditDecision.value = null;
  isIndEditConfirmVisible.value = false;
  cancelIndChipEdit();
  revertIndCategories();
};

const confirmChannelsEditDecision = async () => {
  if (!channelsPendingEditDecision.value) return;
  const { formatted } = channelsPendingEditDecision.value;
  if (!formatted) {
    cancelChannelsEditDecision();
    return;
  }
  channelsPendingEditDecision.value = null;
  isChannelsEditConfirmVisible.value = false;
  channelsEditingValue.value = formatted;
  handleChannelsEditInput();
  if (channelsEditingDuplicate.value) return;
  await commitChannelsChipEdit();
};

const cancelChannelsEditDecision = () => {
  channelsPendingEditDecision.value = null;
  isChannelsEditConfirmVisible.value = false;
  cancelChannelsChipEdit();
  revertChannels();
};

const confirmCallPurposesEditDecision = async () => {
  if (!callPurposesPendingEditDecision.value) return;
  const { formatted } = callPurposesPendingEditDecision.value;
  if (!formatted) {
    cancelCallPurposesEditDecision();
    return;
  }
  callPurposesPendingEditDecision.value = null;
  isCallPurposesEditConfirmVisible.value = false;
  callPurposesEditingValue.value = formatted;
  handleCallPurposesEditInput();
  if (callPurposesEditingDuplicate.value) return;
  await commitCallPurposesChipEdit();
};

const cancelCallPurposesEditDecision = () => {
  callPurposesPendingEditDecision.value = null;
  isCallPurposesEditConfirmVisible.value = false;
  cancelCallPurposesChipEdit();
  revertCallPurposes();
};

const confirmSentimentsEditDecision = async () => {
  if (!sentimentsPendingEditDecision.value) return;
  const { formatted } = sentimentsPendingEditDecision.value;
  if (!formatted) {
    cancelSentimentsEditDecision();
    return;
  }
  sentimentsPendingEditDecision.value = null;
  isSentimentsEditConfirmVisible.value = false;
  sentimentsEditingValue.value = formatted;
  handleSentimentsEditInput();
  if (sentimentsEditingDuplicate.value) return;
  await commitSentimentsChipEdit();
};

const cancelSentimentsEditDecision = () => {
  sentimentsPendingEditDecision.value = null;
  isSentimentsEditConfirmVisible.value = false;
  cancelSentimentsChipEdit();
  revertSentiments();
};

const cancelDeleteDialog = () => {
  isDeleteDialogVisible.value = false;
  pendingDeletion.value = null;
  revertCategories();
};

const confirmDeleteDialog = async () => {
  if (!pendingDeletion.value) return;
  const next = pendingDeletion.value.next;
  pendingDeletion.value = null;
  isDeleteDialogVisible.value = false;
  await saveCategories(next);
  setModelValues(next, true);
};

const cancelIndDeleteDialog = () => {
  isIndDeleteDialogVisible.value = false;
  indPendingDeletion.value = null;
  revertIndCategories();
};

const confirmIndDeleteDialog = async () => {
  if (!indPendingDeletion.value) return;
  const next = indPendingDeletion.value.next;
  indPendingDeletion.value = null;
  isIndDeleteDialogVisible.value = false;
  await saveIndCategories(next);
  setIndModelValues(next, true);
};

const cancelCallPurposesDeleteDialog = () => {
  isCallPurposesDeleteDialogVisible.value = false;
  callPurposesPendingDeletion.value = null;
  revertCallPurposes();
};

const confirmCallPurposesDeleteDialog = async () => {
  if (!callPurposesPendingDeletion.value) return;
  const next = callPurposesPendingDeletion.value.next;
  callPurposesPendingDeletion.value = null;
  isCallPurposesDeleteDialogVisible.value = false;
  await saveCallPurposes(next);
  setCallPurposesModelValues(next, true);
};

const cancelSentimentsDeleteDialog = () => {
  isSentimentsDeleteDialogVisible.value = false;
  sentimentsPendingDeletion.value = null;
  revertSentiments();
};

const confirmSentimentsDeleteDialog = async () => {
  if (!sentimentsPendingDeletion.value) return;
  const next = sentimentsPendingDeletion.value.next;
  sentimentsPendingDeletion.value = null;
  isSentimentsDeleteDialogVisible.value = false;
  await saveSentiments(next);
  setSentimentsModelValues(next, true);
};

onMounted(() => {
  document.addEventListener("pointerdown", handleGlobalPointerDown, true);
  document.addEventListener("pointerdown", handleIndPointerDown, true);
  document.addEventListener("pointerdown", handleChannelsPointerDown, true);
  document.addEventListener("pointerdown", handleCallPurposesPointerDown, true);
  document.addEventListener("pointerdown", handleSentimentsPointerDown, true);
  document.addEventListener("pointerdown", handleDocTypesPointerDown, true);
  document.addEventListener(
    "pointerdown",
    handleDocCategoriesPointerDown,
    true
  );
});

onUnmounted(() => {
  document.removeEventListener("pointerdown", handleGlobalPointerDown, true);
  document.removeEventListener("pointerdown", handleIndPointerDown, true);
  document.removeEventListener("pointerdown", handleChannelsPointerDown, true);
  document.removeEventListener(
    "pointerdown",
    handleCallPurposesPointerDown,
    true
  );
  document.removeEventListener(
    "pointerdown",
    handleSentimentsPointerDown,
    true
  );
  document.removeEventListener("pointerdown", handleDocTypesPointerDown, true);
  document.removeEventListener(
    "pointerdown",
    handleDocCategoriesPointerDown,
    true
  );
  if (inactiveSaveHandle) {
    clearTimeout(inactiveSaveHandle);
    inactiveSaveHandle = null;
  }
  if (indInactiveSaveHandle) {
    clearTimeout(indInactiveSaveHandle);
    indInactiveSaveHandle = null;
  }
});

watch(
  () => searchValue.value,
  (val) => {
    const formatted = formatEntry(val);
    if (formatted) {
      lastTypedValue.value = formatted;
    }
  }
);

watch(
  () => indSearchValue.value,
  (val) => {
    const formatted = formatEntry(val);
    if (formatted) {
      indLastTypedValue.value = formatted;
    }
  }
);

watch(
  () => channelsSearchValue.value,
  (val) => {
    const formatted = formatEntry(val);
    if (formatted) {
      channelsLastTypedValue.value = formatted;
    }
  }
);

const saveCategories = async (vals: string[]) => {
  const cleaned = cleanEntries(vals);
  categories.value = cleaned;

  isSavingCategories.value = true;
  const res = await store.saveRemote({
    crm: {
      organizationCategories: cleaned,
    },
  } as any);
  isSavingCategories.value = false;
  if (res) {
    notifications.push("Categories saved", "success", 2000);
    categories.value = cleaned;
    lastCommittedCategories.value = [...cleaned];
  } else {
    notifications.push("Failed to save categories", "error", 3000);
    loadData();
  }
};

const saveIndCategories = async (vals: string[]) => {
  const cleaned = cleanEntries(vals);
  indCategories.value = cleaned;

  isSavingIndCategories.value = true;
  const res = await store.saveRemote({
    crm: {
      individualCategories: cleaned,
    },
  } as any);
  isSavingIndCategories.value = false;
  if (res) {
    notifications.push("Categories saved", "success", 2000);
    indCategories.value = cleaned;
    lastCommittedIndCategories.value = [...cleaned];
  } else {
    notifications.push("Failed to save categories", "error", 3000);
    loadData();
  }
};

const syncCategories = async (vals: string[]) => {
  if (shouldIgnoreUpdate()) return;

  const cleaned = cleanEntries(vals);
  const current = [...lastCommittedCategories.value];
  const cleanedNormalized = cleaned.map(normalizeValue);
  const typedNormalized = normalizeValue(lastTypedValue.value || "");

  const hasLocalDuplicates =
    new Set(cleanedNormalized).size !== cleanedNormalized.length;
  if (hasLocalDuplicates) {
    notifications.push("Category already exists", "warning", 2000);
    lastTypedValue.value = "";
    revertCategories();
    return;
  }

  const currentNormalized = current.map(normalizeValue);
  const sameValues =
    cleaned.length === current.length &&
    cleanedNormalized.every((val, idx) => val === currentNormalized[idx]);

  if (sameValues) {
    if (typedNormalized && currentNormalized.includes(typedNormalized)) {
      notifications.push("Category already exists", "warning", 2000);
      lastTypedValue.value = "";
    }
    revertCategories();
    return;
  }

  const { added, removed } = diffLists(current, cleaned);

  if (!added.length && !removed.length) {
    revertCategories();
    return;
  }

  const duplicateOfExisting = added.some((item) =>
    currentNormalized.includes(normalizeValue(item))
  );

  if (duplicateOfExisting) {
    notifications.push("Category already exists", "warning", 2000);
    lastTypedValue.value = "";
    revertCategories();
    return;
  }

  if (
    removed.length === 1 &&
    !added.length &&
    typedNormalized &&
    normalizeValue(removed[0]) === typedNormalized
  ) {
    notifications.push("Category already exists", "warning", 2000);
    lastTypedValue.value = "";
    revertCategories();
    return;
  }

  if (removed.length && !added.length) {
    pendingDeletion.value = { removed, next: cleaned };
    isDeleteDialogVisible.value = true;
    revertCategories();
    return;
  }

  setModelValues(cleaned, true);
  lastTypedValue.value = "";
  await saveCategories(cleaned);
};

const syncIndCategories = async (vals: string[]) => {
  if (shouldIgnoreUpdate()) return;

  const cleaned = cleanEntries(vals);
  const current = [...lastCommittedIndCategories.value];
  const cleanedNormalized = cleaned.map(normalizeValue);
  const typedNormalized = normalizeValue(indLastTypedValue.value || "");

  const hasLocalDuplicates =
    new Set(cleanedNormalized).size !== cleanedNormalized.length;
  if (hasLocalDuplicates) {
    notifications.push("Category already exists", "warning", 2000);
    indLastTypedValue.value = "";
    revertIndCategories();
    return;
  }

  const currentNormalized = current.map(normalizeValue);
  const sameValues =
    cleaned.length === current.length &&
    cleanedNormalized.every((val, idx) => val === currentNormalized[idx]);

  if (sameValues) {
    if (typedNormalized && currentNormalized.includes(typedNormalized)) {
      notifications.push("Category already exists", "warning", 2000);
      indLastTypedValue.value = "";
    }
    revertIndCategories();
    return;
  }

  const { added, removed } = diffLists(current, cleaned);

  if (!added.length && !removed.length) {
    revertIndCategories();
    return;
  }

  const duplicateOfExisting = added.some((item) =>
    currentNormalized.includes(normalizeValue(item))
  );

  if (duplicateOfExisting) {
    notifications.push("Category already exists", "warning", 2000);
    indLastTypedValue.value = "";
    revertIndCategories();
    return;
  }

  if (
    removed.length === 1 &&
    !added.length &&
    typedNormalized &&
    normalizeValue(removed[0]) === typedNormalized
  ) {
    notifications.push("Category already exists", "warning", 2000);
    indLastTypedValue.value = "";
    revertIndCategories();
    return;
  }

  if (removed.length && !added.length) {
    indPendingDeletion.value = { removed, next: cleaned };
    isIndDeleteDialogVisible.value = true;
    revertIndCategories();
    return;
  }

  setIndModelValues(cleaned, true);
  indLastTypedValue.value = "";
  await saveIndCategories(cleaned);
};

const handleEditInput = () => {
  if (!editingChip.value) return;
  const formatted = formatEntry(editingValue.value);
  const currentList = [...lastCommittedCategories.value];
  const targetIndex = editingChip.value.index;
  const duplicateExists = currentList.some((item, index) => {
    if (index === targetIndex) return false;
    return normalizeValue(item) === normalizeValue(formatted);
  });
  if (duplicateExists && !editingDuplicate.value) {
    notifications.push("Category already exists", "warning", 2000);
  }
  editingDuplicate.value = duplicateExists;
};

const handleIndEditInput = () => {
  if (!indEditingChip.value) return;
  const formatted = formatEntry(indEditingValue.value);
  const currentList = [...lastCommittedIndCategories.value];
  const targetIndex = indEditingChip.value.index;
  const duplicateExists = currentList.some((item, index) => {
    if (index === targetIndex) return false;
    return normalizeValue(item) === normalizeValue(formatted);
  });
  if (duplicateExists && !indEditingDuplicate.value) {
    notifications.push("Category already exists", "warning", 2000);
  }
  indEditingDuplicate.value = duplicateExists;
};

const handleChannelsEditInput = () => {
  if (!channelsEditingChip.value) return;
  const formatted = formatEntry(channelsEditingValue.value);
  const currentList = [...lastCommittedChannels.value];
  const targetIndex = channelsEditingChip.value.index;
  const duplicateExists = currentList.some((item, index) => {
    if (index === targetIndex) return false;
    return normalizeValue(item) === normalizeValue(formatted);
  });
  if (duplicateExists && !channelsEditingDuplicate.value) {
    notifications.push("Channel already exists", "warning", 2000);
  }
  channelsEditingDuplicate.value = duplicateExists;
};

const handleCallPurposesEditInput = () => {
  if (!callPurposesEditingChip.value) return;
  const formatted = formatEntry(callPurposesEditingValue.value);
  const currentList = [...lastCommittedCallPurposes.value];
  const targetIndex = callPurposesEditingChip.value.index;
  const duplicateExists = currentList.some((item, index) => {
    if (index === targetIndex) return false;
    return normalizeValue(item) === normalizeValue(formatted);
  });
  if (duplicateExists && !callPurposesEditingDuplicate.value) {
    notifications.push("Call purpose already exists", "warning", 2000);
  }
  callPurposesEditingDuplicate.value = duplicateExists;
};

const handleSentimentsEditInput = () => {
  if (!sentimentsEditingChip.value) return;
  const formatted = formatEntry(sentimentsEditingValue.value);
  const currentList = [...lastCommittedSentiments.value];
  const targetIndex = sentimentsEditingChip.value.index;
  const duplicateExists = currentList.some((item, index) => {
    if (index === targetIndex) return false;
    return normalizeValue(item) === normalizeValue(formatted);
  });
  if (duplicateExists && !sentimentsEditingDuplicate.value) {
    notifications.push("Sentiment already exists", "warning", 2000);
  }
  sentimentsEditingDuplicate.value = duplicateExists;
};

const saveFlags = async () => {
  if (isSavingFlags.value) return;
  isSavingFlags.value = true;
  const res = await store.saveRemote({
    crm: {
      organization: {
        ...(store.configurations.crm?.organization || {}),
        requirePhone: requirePhone.value,
        requireEmail: requireEmail.value,
        inactiveAfterMonths: inactiveAfterMonths.value,
      },
    },
  } as any);
  isSavingFlags.value = false;
  if (res) {
    notifications.push("Organization settings saved", "success", 2000);
  } else {
    notifications.push("Failed to save organization settings", "error", 3000);
    loadData();
  }
};

const saveDefaultContactType = async () => {
  if (isSavingDefaultContactType.value) return;
  isSavingDefaultContactType.value = true;
  const res = await store.saveRemote({
    crm: {
      ...(store.configurations.crm || {}),
      DefaultContactType: defaultContactType.value,
    },
  } as any);
  isSavingDefaultContactType.value = false;
  if (res) {
    notifications.push("Default contact type saved", "success", 2000);
  } else {
    notifications.push("Failed to save default contact type", "error", 3000);
    loadData();
  }
};

const onRequirePhoneChange = () => void saveFlags();
const onRequireEmailChange = () => void saveFlags();
const onInactiveInput = (event: Event) => {
  const val = parseFloat((event.target as HTMLInputElement).value);
  if (isNaN(val) || val < 0) {
    inactiveAfterMonths.value = 0;
  } else {
    inactiveAfterMonths.value = val;
  }
  if (inactiveSaveHandle) clearTimeout(inactiveSaveHandle);
  inactiveSaveHandle = setTimeout(() => {
    inactiveSaveHandle = null;
    void saveFlags();
  }, 400);
};

const saveIndFlags = async () => {
  if (isSavingIndFlags.value) return;
  isSavingIndFlags.value = true;
  const res = await store.saveRemote({
    crm: {
      individual: {
        ...(store.configurations.crm?.individual || {}),
        requirePhone: indRequirePhone.value,
        requireEmail: indRequireEmail.value,
        inactiveAfterMonths: indInactiveAfterMonths.value,
      },
    },
  } as any);
  isSavingIndFlags.value = false;
  if (res) {
    notifications.push("Individual settings saved", "success", 2000);
  } else {
    notifications.push("Failed to save individual settings", "error", 3000);
    loadData();
  }
};

const saveChannels = async (vals: string[]) => {
  const cleaned = cleanEntries(vals);
  channels.value = cleaned;

  isSavingChannels.value = true;
  const res = await store.saveRemote({
    crm: {
      ...(store.configurations.crm || {}),
      channels: cleaned,
    },
  } as any);
  isSavingChannels.value = false;
  if (res) {
    notifications.push("Channels saved", "success", 2000);
    channels.value = cleaned;
    lastCommittedChannels.value = [...cleaned];
  } else {
    notifications.push("Failed to save channels", "error", 3000);
    loadData();
  }
};

const saveCallPurposes = async (vals: string[]) => {
  const cleaned = cleanEntries(vals);
  callPurposes.value = cleaned;

  isSavingCallPurposes.value = true;
  const res = await store.saveRemote({
    crm: {
      ...(store.configurations.crm || {}),
      callPurposes: cleaned,
    },
  } as any);
  isSavingCallPurposes.value = false;
  if (res) {
    notifications.push("Call purposes saved", "success", 2000);
    callPurposes.value = cleaned;
    lastCommittedCallPurposes.value = [...cleaned];
  } else {
    notifications.push("Failed to save call purposes", "error", 3000);
    loadData();
  }
};

const saveSentiments = async (vals: string[]) => {
  const cleaned = cleanEntries(vals);
  sentiments.value = cleaned;

  isSavingSentiments.value = true;
  const res = await store.saveRemote({
    crm: {
      ...(store.configurations.crm || {}),
      sentiment: cleaned,
    },
  } as any);
  isSavingSentiments.value = false;
  if (res) {
    notifications.push("Sentiments saved", "success", 2000);
    sentiments.value = cleaned;
    lastCommittedSentiments.value = [...cleaned];
  } else {
    notifications.push("Failed to save sentiments", "error", 3000);
    loadData();
  }
};

const saveDocuments = async () => {
  const types = cleanEntries(docTypesModel.value);
  const categories = cleanEntries(docCategoriesModel.value);

  isSavingDocuments.value = true;
  const payload: any = {
    ...(store.configurations.crm || {}),
    documentTypes: types,
    documentCategories: categories,
    documentRenewable:
      documentRenewable.value === true
        ? "yes"
        : documentRenewable.value === false
        ? "no"
        : null,
  };
  const res = await store.saveRemote({ crm: payload } as any);
  isSavingDocuments.value = false;
  if (res) {
    notifications.push("Documents saved", "success", 2000);
    docTypes.value = types;
    lastCommittedDocTypes.value = [...types];
    docCategories.value = categories;
    lastCommittedDocCategories.value = [...categories];
  } else {
    notifications.push("Failed to save documents", "error", 3000);
    loadData();
  }
};

const setDocTypesModelValues = (values: string[], commit = false) => {
  if (commit) lastCommittedDocTypes.value = [...values];
  markProgrammaticUpdate();
  docTypesModel.value = [...values];
};

const revertDocTypes = () => {
  setDocTypesModelValues(lastCommittedDocTypes.value, false);
};

const setDocCategoriesModelValues = (values: string[], commit = false) => {
  if (commit) lastCommittedDocCategories.value = [...values];
  markProgrammaticUpdate();
  docCategoriesModel.value = [...values];
};

const revertDocCategories = () => {
  setDocCategoriesModelValues(lastCommittedDocCategories.value, false);
};

const onDocTypesChange = async (vals: string[]) => {
  if (shouldIgnoreUpdate()) return;
  const cleaned = cleanEntries(vals);
  const current = [...lastCommittedDocTypes.value];
  const cleanedNormalized = cleaned.map(normalizeValue);

  const hasLocalDuplicates =
    new Set(cleanedNormalized).size !== cleanedNormalized.length;
  if (hasLocalDuplicates) {
    notifications.push("Document type already exists", "warning", 2000);
    revertDocTypes();
    return;
  }

  const currentNormalized = current.map(normalizeValue);
  const sameValues =
    cleaned.length === current.length &&
    cleanedNormalized.every((val, idx) => val === currentNormalized[idx]);

  if (sameValues) {
    revertDocTypes();
    return;
  }

  const { added, removed } = diffLists(current, cleaned);

  if (!added.length && !removed.length) {
    revertDocTypes();
    return;
  }

  if (removed.length && !added.length) {
    docTypesPendingDeletion.value = { removed, next: cleaned };
    isDocTypesDeleteDialogVisible.value = true;
    revertDocTypes();
    return;
  }

  setDocTypesModelValues(cleaned, true);
  await saveDocuments();
};

const onDocCategoriesChange = async (vals: string[]) => {
  if (shouldIgnoreUpdate()) return;
  const cleaned = cleanEntries(vals);
  const current = [...lastCommittedDocCategories.value];
  const cleanedNormalized = cleaned.map(normalizeValue);

  const hasLocalDuplicates =
    new Set(cleanedNormalized).size !== cleanedNormalized.length;
  if (hasLocalDuplicates) {
    notifications.push("Document category already exists", "warning", 2000);
    revertDocCategories();
    return;
  }

  const currentNormalized = current.map(normalizeValue);
  const sameValues =
    cleaned.length === current.length &&
    cleanedNormalized.every((val, idx) => val === currentNormalized[idx]);

  if (sameValues) {
    revertDocCategories();
    return;
  }

  const { added, removed } = diffLists(current, cleaned);

  if (!added.length && !removed.length) {
    revertDocCategories();
    return;
  }

  if (removed.length && !added.length) {
    docCategoriesPendingDeletion.value = { removed, next: cleaned };
    isDocCategoriesDeleteDialogVisible.value = true;
    revertDocCategories();
    return;
  }

  setDocCategoriesModelValues(cleaned, true);
  await saveDocuments();
};

const setChannelsModelValues = (values: string[], commit = false) => {
  if (commit) lastCommittedChannels.value = [...values];
  markProgrammaticUpdate();
  channelsModel.value = [...values];
};

const revertChannels = () => {
  setChannelsModelValues(lastCommittedChannels.value, false);
};

const handleChannelsClose = (name: string) => {
  if (
    channelsEditingChip.value &&
    normalizeValue(channelsEditingChip.value.original) === normalizeValue(name)
  )
    return;
  const next = channelsModel.value.filter(
    (val) => normalizeValue(val) !== normalizeValue(name)
  );
  channelsPendingDeletion.value = { removed: [name], next };
  isChannelsDeleteDialogVisible.value = true;
  revertChannels();
};

const syncChannels = async (vals: string[]) => {
  if (shouldIgnoreUpdate()) return;

  const cleaned = cleanEntries(vals);
  const current = [...lastCommittedChannels.value];
  const cleanedNormalized = cleaned.map(normalizeValue);
  const typedNormalized = normalizeValue(channelsLastTypedValue.value || "");

  const hasLocalDuplicates =
    new Set(cleanedNormalized).size !== cleanedNormalized.length;
  if (hasLocalDuplicates) {
    notifications.push("Channel already exists", "warning", 2000);
    channelsLastTypedValue.value = "";
    revertChannels();
    return;
  }

  const currentNormalized = current.map(normalizeValue);
  const sameValues =
    cleaned.length === current.length &&
    cleanedNormalized.every((val, idx) => val === currentNormalized[idx]);

  if (sameValues) {
    if (typedNormalized && currentNormalized.includes(typedNormalized)) {
      notifications.push("Channel already exists", "warning", 2000);
      channelsLastTypedValue.value = "";
    }
    revertChannels();
    return;
  }

  const { added, removed } = diffLists(current, cleaned);

  if (!added.length && !removed.length) {
    revertChannels();
    return;
  }

  const duplicateOfExisting = added.some((item) =>
    currentNormalized.includes(normalizeValue(item))
  );

  if (duplicateOfExisting) {
    notifications.push("Channel already exists", "warning", 2000);
    channelsLastTypedValue.value = "";
    revertChannels();
    return;
  }

  if (removed.length && !added.length) {
    channelsPendingDeletion.value = { removed, next: cleaned };
    isChannelsDeleteDialogVisible.value = true;
    revertChannels();
    return;
  }

  setChannelsModelValues(cleaned, true);
  channelsLastTypedValue.value = "";
  await saveChannels(cleaned);
};

const setCallPurposesModelValues = (values: string[], commit = false) => {
  if (commit) lastCommittedCallPurposes.value = [...values];
  markProgrammaticUpdate();
  callPurposesModel.value = [...values];
};

const revertCallPurposes = () => {
  setCallPurposesModelValues(lastCommittedCallPurposes.value, false);
};

const handleCallPurposesClose = (name: string) => {
  if (
    callPurposesEditingChip.value &&
    normalizeValue(callPurposesEditingChip.value.original) ===
      normalizeValue(name)
  )
    return;
  const next = callPurposesModel.value.filter(
    (val) => normalizeValue(val) !== normalizeValue(name)
  );
  callPurposesPendingDeletion.value = { removed: [name], next };
  isCallPurposesDeleteDialogVisible.value = true;
  revertCallPurposes();
};

const syncCallPurposes = async (vals: string[]) => {
  if (shouldIgnoreUpdate()) return;

  const cleaned = cleanEntries(vals);
  const current = [...lastCommittedCallPurposes.value];
  const cleanedNormalized = cleaned.map(normalizeValue);
  const typedNormalized = normalizeValue(
    callPurposesLastTypedValue.value || ""
  );

  const hasLocalDuplicates =
    new Set(cleanedNormalized).size !== cleanedNormalized.length;
  if (hasLocalDuplicates) {
    notifications.push("Call purpose already exists", "warning", 2000);
    callPurposesLastTypedValue.value = "";
    revertCallPurposes();
    return;
  }

  const currentNormalized = current.map(normalizeValue);
  const sameValues =
    cleaned.length === current.length &&
    cleanedNormalized.every((val, idx) => val === currentNormalized[idx]);

  if (sameValues) {
    if (typedNormalized && currentNormalized.includes(typedNormalized)) {
      notifications.push("Call purpose already exists", "warning", 2000);
      callPurposesLastTypedValue.value = "";
    }
    revertCallPurposes();
    return;
  }

  const { added, removed } = diffLists(current, cleaned);

  if (!added.length && !removed.length) {
    revertCallPurposes();
    return;
  }

  const duplicateOfExisting = added.some((item) =>
    currentNormalized.includes(normalizeValue(item))
  );

  if (duplicateOfExisting) {
    notifications.push("Call purpose already exists", "warning", 2000);
    callPurposesLastTypedValue.value = "";
    revertCallPurposes();
    return;
  }

  if (removed.length && !added.length) {
    callPurposesPendingDeletion.value = { removed, next: cleaned };
    isCallPurposesDeleteDialogVisible.value = true;
    revertCallPurposes();
    return;
  }

  setCallPurposesModelValues(cleaned, true);
  callPurposesLastTypedValue.value = "";
  await saveCallPurposes(cleaned);
};

const setSentimentsModelValues = (values: string[], commit = false) => {
  if (commit) lastCommittedSentiments.value = [...values];
  markProgrammaticUpdate();
  sentimentsModel.value = [...values];
};

const revertSentiments = () => {
  setSentimentsModelValues(lastCommittedSentiments.value, false);
};

const handleSentimentsClose = (name: string) => {
  if (
    sentimentsEditingChip.value &&
    normalizeValue(sentimentsEditingChip.value.original) ===
      normalizeValue(name)
  )
    return;
  const next = sentimentsModel.value.filter(
    (val) => normalizeValue(val) !== normalizeValue(name)
  );
  sentimentsPendingDeletion.value = { removed: [name], next };
  isSentimentsDeleteDialogVisible.value = true;
  revertSentiments();
};

const syncSentiments = async (vals: string[]) => {
  if (shouldIgnoreUpdate()) return;

  const cleaned = cleanEntries(vals);
  const current = [...lastCommittedSentiments.value];
  const cleanedNormalized = cleaned.map(normalizeValue);
  const typedNormalized = normalizeValue(sentimentsLastTypedValue.value || "");

  const hasLocalDuplicates =
    new Set(cleanedNormalized).size !== cleanedNormalized.length;
  if (hasLocalDuplicates) {
    notifications.push("Sentiment already exists", "warning", 2000);
    sentimentsLastTypedValue.value = "";
    revertSentiments();
    return;
  }

  const currentNormalized = current.map(normalizeValue);
  const sameValues =
    cleaned.length === current.length &&
    cleanedNormalized.every((val, idx) => val === currentNormalized[idx]);

  if (sameValues) {
    if (typedNormalized && currentNormalized.includes(typedNormalized)) {
      notifications.push("Sentiment already exists", "warning", 2000);
      sentimentsLastTypedValue.value = "";
    }
    revertSentiments();
    return;
  }

  const { added, removed } = diffLists(current, cleaned);

  if (!added.length && !removed.length) {
    revertSentiments();
    return;
  }

  const duplicateOfExisting = added.some((item) =>
    currentNormalized.includes(normalizeValue(item))
  );

  if (duplicateOfExisting) {
    notifications.push("Sentiment already exists", "warning", 2000);
    sentimentsLastTypedValue.value = "";
    revertSentiments();
    return;
  }

  if (removed.length && !added.length) {
    sentimentsPendingDeletion.value = { removed, next: cleaned };
    isSentimentsDeleteDialogVisible.value = true;
    revertSentiments();
    return;
  }

  setSentimentsModelValues(cleaned, true);
  sentimentsLastTypedValue.value = "";
  await saveSentiments(cleaned);
};

// Notes functions
const setNotesModelValues = (values: string[], commit = false) => {
  if (commit) lastCommittedNotes.value = [...values];
  markProgrammaticUpdate();
  notesModel.value = [...values];
};

const revertNotes = () => {
  setNotesModelValues(lastCommittedNotes.value, false);
};

const saveNotes = async (vals: string[]) => {
  const cleaned = cleanEntries(vals);
  notes.value = cleaned;

  isSavingNotes.value = true;
  const res = await store.saveRemote({
    crm: {
      ...(store.configurations.crm || {}),
      notes: cleaned,
    },
  } as any);
  isSavingNotes.value = false;
  if (res) {
    notifications.push("Notes saved", "success", 2000);
    notes.value = cleaned;
    lastCommittedNotes.value = [...cleaned];
  } else {
    notifications.push("Failed to save notes", "error", 3000);
    loadData();
  }
};

const handleNotesClose = (name: string) => {
  if (
    notesEditingChip.value &&
    normalizeValue(notesEditingChip.value.original) === normalizeValue(name)
  )
    return;
  const next = notesModel.value.filter(
    (val) => normalizeValue(val) !== normalizeValue(name)
  );
  notesPendingDeletion.value = { removed: [name], next };
  isNotesDeleteDialogVisible.value = true;
  revertNotes();
};

const syncNotes = async (vals: string[]) => {
  if (shouldIgnoreUpdate()) return;

  const cleaned = cleanEntries(vals);
  const current = [...lastCommittedNotes.value];
  const cleanedNormalized = cleaned.map(normalizeValue);
  const typedNormalized = normalizeValue(notesLastTypedValue.value || "");

  const hasLocalDuplicates =
    new Set(cleanedNormalized).size !== cleanedNormalized.length;
  if (hasLocalDuplicates) {
    notifications.push("Note already exists", "warning", 2000);
    notesLastTypedValue.value = "";
    revertNotes();
    return;
  }

  const currentNormalized = current.map(normalizeValue);
  const sameValues =
    cleaned.length === current.length &&
    cleanedNormalized.every((val, idx) => val === currentNormalized[idx]);

  if (sameValues) {
    if (typedNormalized && currentNormalized.includes(typedNormalized)) {
      notifications.push("Note already exists", "warning", 2000);
      notesLastTypedValue.value = "";
    }
    revertNotes();
    return;
  }

  const { added, removed } = diffLists(current, cleaned);

  if (!added.length && !removed.length) {
    revertNotes();
    return;
  }

  const duplicateOfExisting = added.some((item) =>
    currentNormalized.includes(normalizeValue(item))
  );

  if (duplicateOfExisting) {
    notifications.push("Note already exists", "warning", 2000);
    notesLastTypedValue.value = "";
    revertNotes();
    return;
  }

  if (removed.length && !added.length) {
    notesPendingDeletion.value = { removed, next: cleaned };
    isNotesDeleteDialogVisible.value = true;
    revertNotes();
    return;
  }

  setNotesModelValues(cleaned, true);
  notesLastTypedValue.value = "";
  await saveNotes(cleaned);
};

const registerNotesChipElement = (el: any, value: string) => {
  if (
    el &&
    notesEditingChip.value &&
    normalizeValue(notesEditingChip.value.original) === normalizeValue(value)
  ) {
    notesEditingChipElement.value = el.$el || el;
  }
};

const startNotesEditingChip = (original: string) => {
  const idx = notesModel.value.findIndex(
    (v) => normalizeValue(v) === normalizeValue(original)
  );
  if (idx < 0) return;
  notesEditingChip.value = { original, index: idx };
  notesEditingValue.value = original;
  notesEditingDuplicate.value = false;
  nextTick(() => {
    notesEditingInputRef.value?.focus();
    notesEditingInputRef.value?.select();
  });
};

const cancelNotesChipEdit = () => {
  notesEditingChip.value = null;
  notesEditingValue.value = "";
  notesEditingDuplicate.value = false;
  notesPendingEditDecision.value = null;
};

const handleNotesEditInput = () => {
  const formatted = formatEntry(notesEditingValue.value);
  if (!formatted || !notesEditingChip.value) {
    notesEditingDuplicate.value = false;
    return;
  }
  const normalizedInput = normalizeValue(formatted);
  const normalizedOriginal = normalizeValue(notesEditingChip.value.original);
  if (normalizedInput === normalizedOriginal) {
    notesEditingDuplicate.value = false;
    return;
  }
  const isDupe = notesModel.value.some(
    (val, i) =>
      i !== notesEditingChip.value!.index &&
      normalizeValue(val) === normalizedInput
  );
  notesEditingDuplicate.value = isDupe;
};

const handleNotesEditKeydown = (event: KeyboardEvent) => {
  if (event.key === "Enter") {
    event.preventDefault();
    notesEditingInputRef.value?.blur();
  } else if (event.key === "Escape") {
    event.preventDefault();
    cancelNotesChipEdit();
  }
};

const confirmNotesEditDecision = async () => {
  if (!notesPendingEditDecision.value || !notesEditingChip.value) return;
  const updatedList = [...notesModel.value];
  updatedList[notesEditingChip.value.index] =
    notesPendingEditDecision.value.formatted;
  setNotesModelValues(updatedList, true);
  cancelNotesChipEdit();
  isNotesEditConfirmVisible.value = false;
  await saveNotes(updatedList);
};

const cancelNotesEditDecision = () => {
  cancelNotesChipEdit();
  isNotesEditConfirmVisible.value = false;
  revertNotes();
};

const promptNotesEditDecisionIfNeeded = () => {
  if (!notesEditingChip.value) return;
  const formatted = formatEntry(notesEditingValue.value);
  const normalizedFormatted = normalizeValue(formatted);
  const normalizedOriginal = normalizeValue(notesEditingChip.value.original);

  if (!formatted || normalizedFormatted === normalizedOriginal) {
    cancelNotesChipEdit();
    return;
  }

  if (notesEditingDuplicate.value) {
    notifications.push("Note already exists", "warning", 2000);
    cancelNotesChipEdit();
    return;
  }

  notesPendingEditDecision.value = { formatted };
  isNotesEditConfirmVisible.value = true;
};

const onIndInactiveInput = (event: Event) => {
  const val = parseFloat((event.target as HTMLInputElement).value);
  if (isNaN(val) || val < 0) {
    indInactiveAfterMonths.value = 0;
  } else {
    indInactiveAfterMonths.value = val;
  }
  if (indInactiveSaveHandle) clearTimeout(indInactiveSaveHandle);
  indInactiveSaveHandle = setTimeout(() => {
    indInactiveSaveHandle = null;
    void saveIndFlags();
  }, 400);
};
</script>

<template>
  <VCard class="mb-6" title="Contact Configuration">
    <VCardText>
      <VCard variant="flat" class="mb-4 testTed">
        <VCardItem>
          <VCardTitle>Organization</VCardTitle>
        </VCardItem>
        <VCardText>
          <div class="mb-4">
            <label class="text-caption mb-2 d-block">Categories</label>
            <VCombobox
              v-model="categoriesModel"
              multiple
              chips
              hide-details
              :placeholder="categoryPlaceholder"
              :loading="isSavingCategories"
              :disabled="isSavingCategories"
              class="mb-4"
              v-model:search="searchValue"
              @update:model-value="syncCategories($event as string[])"
            >
              <template #chip="{ props, item }">
                <VChip
                  v-bind="props"
                  size="small"
                  class="d-inline-flex align-center"
                  :class="{
                    'chip-editing':
                      editingChip &&
                      normalizeValue(editingChip.original) ===
                        normalizeValue(item.raw),
                    duplicate:
                      editingDuplicate &&
                      editingChip &&
                      normalizeValue(editingChip.original) ===
                        normalizeValue(item.raw),
                  }"
                  :variant="hoveredChip === item.raw ? 'tonal' : (props.variant as any)"
                  :color="hoveredChip === item.raw ? 'error' : (props.color as string)"
                  @dblclick.stop.prevent="startEditingChip(item.raw)"
                  @blur="promptEditDecisionIfNeeded"
                  tabindex="0"
                  :ref="(el: any) => registerChipElement(el, item.raw)"
                >
                  <template
                    v-if="
                      editingChip &&
                      normalizeValue(editingChip.original) ===
                        normalizeValue(item.raw)
                    "
                  >
                    <input ref="editingInputRef" v-model="editingValue"
                    class="chip-edit-input me-2"
                    @keydown.stop="handleEditKeydown" @input="handleEditInput"
                    @click.stop @mousedown.stop @pointerdown.stop" />
                    <VIcon
                      icon="tabler-x"
                      size="14"
                      class="cursor-pointer"
                      @click.stop.prevent="cancelChipEdit"
                    />
                  </template>
                  <template v-else>
                    <span class="me-2">{{ item.raw }}</span>
                    <VIcon
                      icon="tabler-x"
                      size="14"
                      class="cursor-pointer"
                      @mouseenter="hoveredChip = item.raw"
                      @mouseleave="hoveredChip = null"
                      @click.stop.prevent="handleChipClose(item.raw)"
                    />
                  </template>
                </VChip>
              </template>
            </VCombobox>
          </div>

          <VRow>
            <VCol cols="12" md="4">
              <label class="text-subtitle-2 mb-2 d-block">
                Inactive After (Months)
              </label>
              <AppTextField
                v-model.number="inactiveAfterMonths"
                type="number"
                min="0"
                hide-details
                density="compact"
                :loading="isSavingFlags"
                :disabled="isSavingFlags"
                @keydown="
                (e: KeyboardEvent) => {
                  if (
                    e.key === '-' ||
                    e.key === 'e' ||
                    e.key === 'E' ||
                    e.key === '+'
                  )
                    e.preventDefault();
                }
              "
                @input="onInactiveInput"
              />
            </VCol>
            <VCol cols="6" md="4">
              <VRadioGroup
                label="Require Phone?"
                v-model="requirePhone"
                inline
                :disabled="isSavingFlags"
                class="mb-0"
                @change="onRequirePhoneChange"
              >
                <VRadio :value="true" label="Yes" />
                <VRadio :value="false" label="No" />
              </VRadioGroup>
            </VCol>
            <VCol cols="6" md="4">
              <VRadioGroup
                label="Require Email?"
                v-model="requireEmail"
                inline
                :disabled="isSavingFlags"
                class="mb-0"
                @change="onRequireEmailChange"
              >
                <VRadio :value="true" label="Yes" />
                <VRadio :value="false" label="No" />
              </VRadioGroup>
            </VCol>
          </VRow>
        </VCardText>
      </VCard>

      <VCard variant="flat" class="mb-4 testTed">
        <VCardItem>
          <VCardTitle>Individual</VCardTitle>
        </VCardItem>
        <VCardText>
          <div class="mb-4">
            <label class="text-caption mb-2 d-block">Categories</label>
            <VCombobox
              v-model="indCategoriesModel"
              multiple
              chips
              hide-details
              :placeholder="indCategoryPlaceholder"
              :loading="isSavingIndCategories"
              :disabled="isSavingIndCategories"
              class="mb-4"
              v-model:search="indSearchValue"
              @update:model-value="syncIndCategories($event as string[])"
            >
              <template #chip="{ props, item }">
                <VChip
                  v-bind="props"
                  size="small"
                  class="d-inline-flex align-center"
                  :class="{
                    'chip-editing':
                      indEditingChip &&
                      normalizeValue(indEditingChip.original) ===
                        normalizeValue(item.raw),
                    duplicate:
                      indEditingDuplicate &&
                      indEditingChip &&
                      normalizeValue(indEditingChip.original) ===
                        normalizeValue(item.raw),
                  }"
                  :variant="
                  indHoveredChip === item.raw ? 'tonal' : (props.variant as any)
                "
                  :color="
                  indHoveredChip === item.raw ? 'error' : (props.color as string)
                "
                  @dblclick.stop.prevent="startIndEditingChip(item.raw)"
                  @blur="promptIndEditDecisionIfNeeded"
                  tabindex="0"
                  :ref="(el: any) => registerIndChipElement(el, item.raw)"
                >
                  <template
                    v-if="
                      indEditingChip &&
                      normalizeValue(indEditingChip.original) ===
                        normalizeValue(item.raw)
                    "
                  >
                    <input
                      ref="indEditingInputRef"
                      v-model="indEditingValue"
                      class="chip-edit-input me-2"
                      @keydown.stop="handleIndEditKeydown"
                      @input="handleIndEditInput"
                      @click.stop
                      @mousedown.stop
                      @pointerdown.stop
                    />
                    <VIcon
                      icon="tabler-x"
                      size="14"
                      class="cursor-pointer"
                      @click.stop.prevent="cancelIndChipEdit"
                    />
                  </template>
                  <template v-else>
                    <span class="me-2">{{ item.raw }}</span>
                    <VIcon
                      icon="tabler-x"
                      size="14"
                      class="cursor-pointer"
                      @mouseenter="indHoveredChip = item.raw"
                      @mouseleave="indHoveredChip = null"
                      @click.stop.prevent="handleIndChipClose(item.raw)"
                    />
                  </template>
                </VChip>
              </template>
            </VCombobox>
          </div>

          <VRow>
            <VCol cols="12" md="4">
              <label class="text-subtitle-2 mb-2 d-block">
                Inactive After (Months)
              </label>
              <VTextField
                v-model.number="indInactiveAfterMonths"
                type="number"
                min="0"
                hide-details
                density="compact"
                :loading="isSavingIndFlags"
                :disabled="isSavingIndFlags"
                @keydown="
                (e: KeyboardEvent) => {
                  if (
                    e.key === '-' ||
                    e.key === 'e' ||
                    e.key === 'E' ||
                    e.key === '+'
                  )
                    e.preventDefault();
                }
              "
                @input="onIndInactiveInput"
              />
            </VCol>
            <VCol cols="6" md="4">
              <VRadioGroup
                label="Require Phone?"
                v-model="indRequirePhone"
                inline
                :disabled="isSavingIndFlags"
                class="mb-0"
                @change="() => void saveIndFlags()"
              >
                <VRadio :value="true" label="Yes" />
                <VRadio :value="false" label="No" />
              </VRadioGroup>
            </VCol>
            <VCol cols="6" md="4">
              <VRadioGroup
                label="Require Email?"
                v-model="indRequireEmail"
                inline
                :disabled="isSavingIndFlags"
                class="mb-0"
                @change="() => void saveIndFlags()"
              >
                <VRadio :value="true" label="Yes" />
                <VRadio :value="false" label="No" />
              </VRadioGroup>
            </VCol>
          </VRow>
        </VCardText>
      </VCard>

      <VCard variant="flat" class="mb-4 testTed">
        <VCardItem>
          <VCardTitle>Default Contact Type</VCardTitle>
        </VCardItem>
        <VCardText>
          <VSelect
            v-model="defaultContactType"
            :items="['Organization', 'Individual', 'Ask Everytime']"
            hide-details
            density="compact"
            :loading="isSavingDefaultContactType"
            :disabled="isSavingDefaultContactType"
            @update:model-value="() => saveDefaultContactType()"
          />
        </VCardText>
      </VCard>

      <VCard variant="flat" class="mb-4 testTed">
        <VCardItem>
          <VCardTitle>Channels</VCardTitle>
        </VCardItem>
        <VCardText>
          <VCombobox
            v-model="channelsModel"
            multiple
            chips
            hide-details
            :placeholder="'Add channels'"
            :loading="isSavingChannels"
            :disabled="isSavingChannels"
            class="mb-4"
            v-model:search="channelsSearchValue"
            @update:model-value="syncChannels($event as string[])"
          >
            <template #chip="{ props, item }">
              <VChip
                v-bind="props"
                size="small"
                class="d-inline-flex align-center"
                :class="{
                  'chip-editing':
                    channelsEditingChip &&
                    normalizeValue(channelsEditingChip.original) ===
                      normalizeValue(item.raw),
                  duplicate:
                    channelsEditingDuplicate &&
                    channelsEditingChip &&
                    normalizeValue(channelsEditingChip.original) ===
                      normalizeValue(item.raw),
                }"
                :variant="
                channelsHoveredChip === item.raw ? 'tonal' : (props.variant as any)
              "
                :color="
                channelsHoveredChip === item.raw ? 'error' : (props.color as string)
              "
                @dblclick.stop.prevent="startChannelsEditingChip(item.raw)"
                @blur="promptChannelsEditDecisionIfNeeded"
                tabindex="0"
                :ref="(el: any) => registerChannelsChipElement(el, item.raw)"
              >
                <template
                  v-if="
                    channelsEditingChip &&
                    normalizeValue(channelsEditingChip.original) ===
                      normalizeValue(item.raw)
                  "
                >
                  <input
                    ref="channelsEditingInputRef"
                    v-model="channelsEditingValue"
                    class="chip-edit-input me-2"
                    @keydown.stop="handleChannelsEditKeydown"
                    @input="handleChannelsEditInput"
                    @click.stop
                    @mousedown.stop
                    @pointerdown.stop
                  />
                  <VIcon
                    icon="tabler-x"
                    size="14"
                    class="cursor-pointer"
                    @click.stop.prevent="cancelChannelsChipEdit"
                  />
                </template>
                <template v-else>
                  <span class="me-2">{{ item.raw }}</span>
                  <VIcon
                    icon="tabler-x"
                    size="14"
                    class="cursor-pointer"
                    @mouseenter="channelsHoveredChip = item.raw"
                    @mouseleave="channelsHoveredChip = null"
                    @click.stop.prevent="handleChannelsClose(item.raw)"
                  />
                </template>
              </VChip>
            </template>
          </VCombobox>
        </VCardText>
      </VCard>

      <VCard variant="flat" class="testTed">
        <VCardItem>
          <VCardTitle>Documents</VCardTitle>
        </VCardItem>
        <VCardText>
          <div class="mb-4">
            <label class="text-caption mb-2 d-block">Document Types</label>
            <VCombobox
              v-model="docTypesModel"
              multiple
              chips
              hide-details
              :placeholder="'Add document types'"
              :loading="isSavingDocuments"
              :disabled="isSavingDocuments"
              class="mb-4"
              v-model:search="docTypesSearchValue"
              @update:model-value="onDocTypesChange($event as string[])"
            >
              <template #chip="{ props, item }">
                <VChip
                  v-bind="props"
                  size="small"
                  class="d-inline-flex align-center"
                  :class="{
                    'chip-editing':
                      docTypesEditingChip &&
                      normalizeValue(docTypesEditingChip.original) ===
                        normalizeValue(item.raw),
                    duplicate:
                      docTypesEditingDuplicate &&
                      docTypesEditingChip &&
                      normalizeValue(docTypesEditingChip.original) ===
                        normalizeValue(item.raw),
                  }"
                  :variant="
                  docTypesHoveredChip === item.raw ? 'tonal' : (props.variant as any)
                "
                  :color="
                  docTypesHoveredChip === item.raw ? 'error' : (props.color as string)
                "
                  @dblclick.stop.prevent="startDocTypesEditingChip(item.raw)"
                  @blur="promptDocTypesEditDecisionIfNeeded"
                  tabindex="0"
                  :ref="(el: any) => registerDocTypesChipElement(el, item.raw)"
                >
                  <template
                    v-if="
                      docTypesEditingChip &&
                      normalizeValue(docTypesEditingChip.original) ===
                        normalizeValue(item.raw)
                    "
                  >
                    <input
                      ref="docTypesEditingInputRef"
                      v-model="docTypesEditingValue"
                      class="chip-edit-input me-2"
                      @keydown.stop="handleDocTypesEditKeydown"
                      @input="handleDocTypesEditInput"
                      @click.stop
                      @mousedown.stop
                      @pointerdown.stop
                    />
                    <VIcon
                      icon="tabler-x"
                      size="14"
                      class="cursor-pointer"
                      @click.stop.prevent="cancelDocTypesChipEdit"
                    />
                  </template>
                  <template v-else>
                    <span class="me-2">{{ item.raw }}</span>
                    <VIcon
                      icon="tabler-x"
                      size="14"
                      class="cursor-pointer"
                      @mouseenter="docTypesHoveredChip = item.raw"
                      @mouseleave="docTypesHoveredChip = null"
                      @click.stop.prevent="handleDocTypesClose(item.raw)"
                    />
                  </template>
                </VChip>
              </template>
            </VCombobox>
          </div>

          <div class="mb-4">
            <label class="text-caption mb-2 d-block">Document Categories</label>
            <VCombobox
              v-model="docCategoriesModel"
              multiple
              chips
              hide-details
              :placeholder="'Add document categories'"
              :loading="isSavingDocuments"
              :disabled="isSavingDocuments"
              class="mb-4"
              v-model:search="docCategoriesSearchValue"
              @update:model-value="onDocCategoriesChange($event as string[])"
            >
              <template #chip="{ props, item }">
                <VChip
                  v-bind="props"
                  size="small"
                  class="d-inline-flex align-center"
                  :class="{
                    'chip-editing':
                      docCategoriesEditingChip &&
                      normalizeValue(docCategoriesEditingChip.original) ===
                        normalizeValue(item.raw),
                    duplicate:
                      docCategoriesEditingDuplicate &&
                      docCategoriesEditingChip &&
                      normalizeValue(docCategoriesEditingChip.original) ===
                        normalizeValue(item.raw),
                  }"
                  :variant="
                  docCategoriesHoveredChip === item.raw ? 'tonal' : (props.variant as any)
                "
                  :color="
                  docCategoriesHoveredChip === item.raw ? 'error' : (props.color as string)
                "
                  @dblclick.stop.prevent="
                    startDocCategoriesEditingChip(item.raw)
                  "
                  @blur="promptDocCategoriesEditDecisionIfNeeded"
                  tabindex="0"
                  :ref="(el: any) => registerDocCategoriesChipElement(el, item.raw)"
                >
                  <template
                    v-if="
                      docCategoriesEditingChip &&
                      normalizeValue(docCategoriesEditingChip.original) ===
                        normalizeValue(item.raw)
                    "
                  >
                    <input
                      ref="docCategoriesEditingInputRef"
                      v-model="docCategoriesEditingValue"
                      class="chip-edit-input me-2"
                      @keydown.stop="handleDocCategoriesEditKeydown"
                      @input="handleDocCategoriesEditInput"
                      @click.stop
                      @mousedown.stop
                      @pointerdown.stop
                    />
                    <VIcon
                      icon="tabler-x"
                      size="14"
                      class="cursor-pointer"
                      @click.stop.prevent="cancelDocCategoriesChipEdit"
                    />
                  </template>
                  <template v-else>
                    <span class="me-2">{{ item.raw }}</span>
                    <VIcon
                      icon="tabler-x"
                      size="14"
                      class="cursor-pointer"
                      @mouseenter="docCategoriesHoveredChip = item.raw"
                      @mouseleave="docCategoriesHoveredChip = null"
                      @click.stop.prevent="handleDocCategoriesClose(item.raw)"
                    />
                  </template>
                </VChip>
              </template>
            </VCombobox>
          </div>

          <div>
            <label class="text-subtitle-2 mb-2 d-block"
              >Document Renewable?</label
            >
            <VRadioGroup
              v-model="documentRenewable"
              inline
              class="mb-0"
              @change="() => saveDocuments()"
            >
              <VRadio :value="true" label="Yes" />
              <VRadio :value="false" label="No" />
            </VRadioGroup>
          </div>
        </VCardText>
      </VCard>
    </VCardText>
  </VCard>

  <VDialog v-model="isChannelsEditConfirmVisible" max-width="480">
    <VCard class="pa-sm-8 pa-4">
      <VCardTitle>Unsaved changes</VCardTitle>
      <VCardText>
        <p>
          Keep the changes to
          <strong
            >{{ channelsEditingChip?.original }} ->
            {{ channelsPendingEditDecision?.formatted }}</strong
          >?
        </p>
      </VCardText>
      <VCardActions>
        <VSpacer />
        <VBtn
          variant="text"
          color="secondary"
          @click="cancelChannelsEditDecision"
        >
          Revert
        </VBtn>
        <VBtn
          variant="tonal"
          color="primary"
          @click="confirmChannelsEditDecision"
        >
          Keep changes
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>

  <VDialog v-model="isChannelsDeleteDialogVisible" max-width="480">
    <VCard class="pa-sm-8 pa-4">
      <VCardTitle>Remove channel</VCardTitle>
      <VCardText>
        <p v-if="channelsPendingDeletion">
          Are you sure you want to permanently remove
          <strong>{{ channelsPendingDeletion.removed.join(", ") }}</strong
          >?
        </p>
      </VCardText>
      <VCardActions>
        <VSpacer />
        <VBtn
          variant="text"
          color="secondary"
          @click="
            () => {
              isChannelsDeleteDialogVisible = false;
              channelsPendingDeletion = null;
              revertChannels();
            }
          "
        >
          Cancel
        </VBtn>
        <VBtn
          variant="tonal"
          color="error"
          @click="
            async () => {
              if (!channelsPendingDeletion) return;
              const next = channelsPendingDeletion.next;
              channelsPendingDeletion = null;
              isChannelsDeleteDialogVisible = false;
              await saveChannels(next);
              setChannelsModelValues(next, true);
            }
          "
        >
          Remove
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>

  <VDialog v-model="isCallPurposesEditConfirmVisible" max-width="480">
    <VCard class="pa-sm-8 pa-4">
      <VCardTitle>Unsaved changes</VCardTitle>
      <VCardText>
        <p>
          Keep the changes to
          <strong
            >{{ callPurposesEditingChip?.original }} ->
            {{ callPurposesPendingEditDecision?.formatted }}</strong
          >?
        </p>
      </VCardText>
      <VCardActions>
        <VSpacer />
        <VBtn
          variant="text"
          color="secondary"
          @click="cancelCallPurposesEditDecision"
        >
          Revert
        </VBtn>
        <VBtn
          variant="tonal"
          color="primary"
          @click="confirmCallPurposesEditDecision"
        >
          Keep changes
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>

  <VDialog v-model="isCallPurposesDeleteDialogVisible" max-width="480">
    <VCard class="pa-sm-8 pa-4">
      <VCardTitle>Remove call purpose</VCardTitle>
      <VCardText>
        <p v-if="callPurposesPendingDeletion">
          Are you sure you want to permanently remove
          <strong>{{ callPurposesPendingDeletion.removed.join(", ") }}</strong
          >?
        </p>
      </VCardText>
      <VCardActions>
        <VSpacer />
        <VBtn
          variant="text"
          color="secondary"
          @click="cancelCallPurposesDeleteDialog"
        >
          Cancel
        </VBtn>
        <VBtn
          variant="tonal"
          color="error"
          @click="confirmCallPurposesDeleteDialog"
        >
          Remove
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>

  <VDialog v-model="isSentimentsEditConfirmVisible" max-width="480">
    <VCard class="pa-sm-8 pa-4">
      <VCardTitle>Unsaved changes</VCardTitle>
      <VCardText>
        <p>
          Keep the changes to
          <strong
            >{{ sentimentsEditingChip?.original }} ->
            {{ sentimentsPendingEditDecision?.formatted }}</strong
          >?
        </p>
      </VCardText>
      <VCardActions>
        <VSpacer />
        <VBtn
          variant="text"
          color="secondary"
          @click="cancelSentimentsEditDecision"
        >
          Revert
        </VBtn>
        <VBtn
          variant="tonal"
          color="primary"
          @click="confirmSentimentsEditDecision"
        >
          Keep changes
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>

  <VDialog v-model="isSentimentsDeleteDialogVisible" max-width="480">
    <VCard class="pa-sm-8 pa-4">
      <VCardTitle>Remove sentiment</VCardTitle>
      <VCardText>
        <p v-if="sentimentsPendingDeletion">
          Are you sure you want to permanently remove
          <strong>{{ sentimentsPendingDeletion.removed.join(", ") }}</strong
          >?
        </p>
      </VCardText>
      <VCardActions>
        <VSpacer />
        <VBtn
          variant="text"
          color="secondary"
          @click="cancelSentimentsDeleteDialog"
        >
          Cancel
        </VBtn>
        <VBtn
          variant="tonal"
          color="error"
          @click="confirmSentimentsDeleteDialog"
        >
          Remove
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>

  <VDialog v-model="isNotesEditConfirmVisible" max-width="480">
    <VCard class="pa-sm-8 pa-4">
      <VCardTitle>Unsaved changes</VCardTitle>
      <VCardText>
        <p>
          Keep the changes to
          <strong
            >{{ notesEditingChip?.original }} ->
            {{ notesPendingEditDecision?.formatted }}</strong
          >?
        </p>
      </VCardText>
      <VCardActions>
        <VSpacer />
        <VBtn variant="text" color="secondary" @click="cancelNotesEditDecision">
          Revert
        </VBtn>
        <VBtn variant="tonal" color="primary" @click="confirmNotesEditDecision">
          Keep changes
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>

  <VDialog v-model="isNotesDeleteDialogVisible" max-width="480">
    <VCard class="pa-sm-8 pa-4">
      <VCardTitle>Remove note</VCardTitle>
      <VCardText>
        <p v-if="notesPendingDeletion">
          Are you sure you want to permanently remove
          <strong>{{ notesPendingDeletion.removed.join(", ") }}</strong
          >?
        </p>
      </VCardText>
      <VCardActions>
        <VSpacer />
        <VBtn
          variant="text"
          color="secondary"
          @click="
            () => {
              isNotesDeleteDialogVisible = false;
              notesPendingDeletion = null;
              revertNotes();
            }
          "
        >
          Cancel
        </VBtn>
        <VBtn
          variant="tonal"
          color="error"
          @click="
            async () => {
              if (!notesPendingDeletion) return;
              const next = notesPendingDeletion.next;
              notesPendingDeletion = null;
              isNotesDeleteDialogVisible = false;
              await saveNotes(next);
              setNotesModelValues(next, true);
            }
          "
        >
          Remove
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>

  <VDialog v-model="isDocTypesEditConfirmVisible" max-width="480">
    <VCard class="pa-sm-8 pa-4">
      <VCardTitle>Unsaved changes</VCardTitle>
      <VCardText>
        <p>
          Keep the changes to
          <strong
            >{{ docTypesEditingChip?.original }} ->
            {{ docTypesPendingEditDecision?.formatted }}</strong
          >?
        </p>
      </VCardText>
      <VCardActions>
        <VSpacer />
        <VBtn
          variant="text"
          color="secondary"
          @click="cancelDocTypesEditDecision"
        >
          Revert
        </VBtn>
        <VBtn
          variant="tonal"
          color="primary"
          @click="confirmDocTypesEditDecision"
        >
          Keep changes
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>

  <VDialog v-model="isDocTypesDeleteDialogVisible" max-width="480">
    <VCard class="pa-sm-8 pa-4">
      <VCardTitle>Remove document type</VCardTitle>
      <VCardText>
        <p v-if="docTypesPendingDeletion">
          Are you sure you want to permanently remove
          <strong>{{ docTypesPendingDeletion.removed.join(", ") }}</strong
          >?
        </p>
      </VCardText>
      <VCardActions>
        <VSpacer />
        <VBtn
          variant="text"
          color="secondary"
          @click="cancelDocTypesDeleteDialog"
        >
          Cancel
        </VBtn>
        <VBtn
          variant="tonal"
          color="error"
          @click="confirmDocTypesDeleteDialog"
        >
          Remove
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>

  <VDialog v-model="isDocCategoriesEditConfirmVisible" max-width="480">
    <VCard class="pa-sm-8 pa-4">
      <VCardTitle>Unsaved changes</VCardTitle>
      <VCardText>
        <p>
          Keep the changes to
          <strong
            >{{ docCategoriesEditingChip?.original }} ->
            {{ docCategoriesPendingEditDecision?.formatted }}</strong
          >?
        </p>
      </VCardText>
      <VCardActions>
        <VSpacer />
        <VBtn
          variant="text"
          color="secondary"
          @click="cancelDocCategoriesEditDecision"
        >
          Revert
        </VBtn>
        <VBtn
          variant="tonal"
          color="primary"
          @click="confirmDocCategoriesEditDecision"
        >
          Keep changes
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>

  <VDialog v-model="isDocCategoriesDeleteDialogVisible" max-width="480">
    <VCard class="pa-sm-8 pa-4">
      <VCardTitle>Remove document category</VCardTitle>
      <VCardText>
        <p v-if="docCategoriesPendingDeletion">
          Are you sure you want to permanently remove
          <strong>{{ docCategoriesPendingDeletion.removed.join(", ") }}</strong
          >?
        </p>
      </VCardText>
      <VCardActions>
        <VSpacer />
        <VBtn
          variant="text"
          color="secondary"
          @click="cancelDocCategoriesDeleteDialog"
        >
          Cancel
        </VBtn>
        <VBtn
          variant="tonal"
          color="error"
          @click="confirmDocCategoriesDeleteDialog"
        >
          Remove
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>

  <VCard class="mb-6" title="Activities & Jobs">
    <VCardText>
      <div class="mb-4">
        <h6 class="text-subtitle-1 mb-2">Call Purposes</h6>
        <VCombobox
          v-model="callPurposesModel"
          multiple
          chips
          hide-details
          :placeholder="'Add call purposes'"
          :loading="isSavingCallPurposes"
          :disabled="isSavingCallPurposes"
          class="mb-4"
          v-model:search="callPurposesSearchValue"
          @update:model-value="syncCallPurposes($event as string[])"
        >
          <template #chip="{ props, item }">
            <VChip
              v-bind="props"
              size="small"
              class="d-inline-flex align-center"
              :class="{
                'chip-editing':
                  callPurposesEditingChip &&
                  normalizeValue(callPurposesEditingChip.original) ===
                    normalizeValue(item.raw),
                duplicate:
                  callPurposesEditingDuplicate &&
                  callPurposesEditingChip &&
                  normalizeValue(callPurposesEditingChip.original) ===
                    normalizeValue(item.raw),
              }"
              :variant="
                callPurposesHoveredChip === item.raw ? 'tonal' : (props.variant as any)
              "
              :color="
                callPurposesHoveredChip === item.raw ? 'error' : (props.color as string)
              "
              @dblclick.stop.prevent="startCallPurposesEditingChip(item.raw)"
              @blur="promptCallPurposesEditDecisionIfNeeded"
              tabindex="0"
              :ref="(el: any) => registerCallPurposesChipElement(el, item.raw)"
            >
              <template
                v-if="
                  callPurposesEditingChip &&
                  normalizeValue(callPurposesEditingChip.original) ===
                    normalizeValue(item.raw)
                "
              >
                <input
                  ref="callPurposesEditingInputRef"
                  v-model="callPurposesEditingValue"
                  class="chip-edit-input me-2"
                  @keydown.stop="handleCallPurposesEditKeydown"
                  @input="handleCallPurposesEditInput"
                  @click.stop
                  @mousedown.stop
                  @pointerdown.stop
                />
                <VIcon
                  icon="tabler-x"
                  size="14"
                  class="cursor-pointer"
                  @click.stop.prevent="cancelCallPurposesChipEdit"
                />
              </template>
              <template v-else>
                <span class="me-2">{{ item.raw }}</span>
                <VIcon
                  icon="tabler-x"
                  size="14"
                  class="cursor-pointer"
                  @mouseenter="callPurposesHoveredChip = item.raw"
                  @mouseleave="callPurposesHoveredChip = null"
                  @click.stop.prevent="handleCallPurposesClose(item.raw)"
                />
              </template>
            </VChip>
          </template>
        </VCombobox>
      </div>

      <div class="mb-4">
        <h6 class="text-subtitle-1 mb-2">Sentiments</h6>
        <VCombobox
          v-model="sentimentsModel"
          multiple
          chips
          hide-details
          :placeholder="'Add sentiments'"
          :loading="isSavingSentiments"
          :disabled="isSavingSentiments"
          class="mb-4"
          v-model:search="sentimentsSearchValue"
          @update:model-value="syncSentiments($event as string[])"
        >
          <template #chip="{ props, item }">
            <VChip
              v-bind="props"
              size="small"
              class="d-inline-flex align-center"
              :class="{
                'chip-editing':
                  sentimentsEditingChip &&
                  normalizeValue(sentimentsEditingChip.original) ===
                    normalizeValue(item.raw),
                duplicate:
                  sentimentsEditingDuplicate &&
                  sentimentsEditingChip &&
                  normalizeValue(sentimentsEditingChip.original) ===
                    normalizeValue(item.raw),
              }"
              :variant="
                sentimentsHoveredChip === item.raw ? 'tonal' : (props.variant as any)
              "
              :color="
                sentimentsHoveredChip === item.raw ? 'error' : (props.color as string)
              "
              @dblclick.stop.prevent="startSentimentsEditingChip(item.raw)"
              @blur="promptSentimentsEditDecisionIfNeeded"
              tabindex="0"
              :ref="(el: any) => registerSentimentsChipElement(el, item.raw)"
            >
              <template
                v-if="
                  sentimentsEditingChip &&
                  normalizeValue(sentimentsEditingChip.original) ===
                    normalizeValue(item.raw)
                "
              >
                <input
                  ref="sentimentsEditingInputRef"
                  v-model="sentimentsEditingValue"
                  class="chip-edit-input me-2"
                  @keydown.stop="handleSentimentsEditKeydown"
                  @input="handleSentimentsEditInput"
                  @click.stop
                  @mousedown.stop
                  @pointerdown.stop
                />
                <VIcon
                  icon="tabler-x"
                  size="14"
                  class="cursor-pointer"
                  @click.stop.prevent="cancelSentimentsChipEdit"
                />
              </template>
              <template v-else>
                <span class="me-2">{{ item.raw }}</span>
                <VIcon
                  icon="tabler-x"
                  size="14"
                  class="cursor-pointer"
                  @mouseenter="sentimentsHoveredChip = item.raw"
                  @mouseleave="sentimentsHoveredChip = null"
                  @click.stop.prevent="handleSentimentsClose(item.raw)"
                />
              </template>
            </VChip>
          </template>
        </VCombobox>
      </div>

      <div>
        <h6 class="text-subtitle-1 mb-2">Notes</h6>
        <VCombobox
          v-model="notesModel"
          multiple
          chips
          hide-details
          :placeholder="'Add notes'"
          :loading="isSavingNotes"
          :disabled="isSavingNotes"
          class="mb-4"
          v-model:search="notesSearchValue"
          @update:model-value="syncNotes($event as string[])"
        >
          <template #chip="{ props, item }">
            <VChip
              v-bind="props"
              size="small"
              class="d-inline-flex align-center"
              :class="{
                'chip-editing':
                  notesEditingChip &&
                  normalizeValue(notesEditingChip.original) ===
                    normalizeValue(item.raw),
                duplicate:
                  notesEditingDuplicate &&
                  notesEditingChip &&
                  normalizeValue(notesEditingChip.original) ===
                    normalizeValue(item.raw),
              }"
              :variant="
                notesHoveredChip === item.raw ? 'tonal' : (props.variant as any)
              "
              :color="
                notesHoveredChip === item.raw ? 'error' : (props.color as string)
              "
              @dblclick.stop.prevent="startNotesEditingChip(item.raw)"
              @blur="promptNotesEditDecisionIfNeeded"
              tabindex="0"
              :ref="(el: any) => registerNotesChipElement(el, item.raw)"
            >
              <template
                v-if="
                  notesEditingChip &&
                  normalizeValue(notesEditingChip.original) ===
                    normalizeValue(item.raw)
                "
              >
                <input
                  ref="notesEditingInputRef"
                  v-model="notesEditingValue"
                  class="chip-edit-input me-2"
                  @keydown.stop="handleNotesEditKeydown"
                  @input="handleNotesEditInput"
                  @click.stop
                  @mousedown.stop
                  @pointerdown.stop
                />
                <VIcon
                  icon="tabler-x"
                  size="14"
                  class="cursor-pointer"
                  @click.stop.prevent="cancelNotesChipEdit"
                />
              </template>
              <template v-else>
                <span class="me-2">{{ item.raw }}</span>
                <VIcon
                  icon="tabler-x"
                  size="14"
                  class="cursor-pointer"
                  @mouseenter="notesHoveredChip = item.raw"
                  @mouseleave="notesHoveredChip = null"
                  @click.stop.prevent="handleNotesClose(item.raw)"
                />
              </template>
            </VChip>
          </template>
        </VCombobox>
      </div>
    </VCardText>
  </VCard>

  <VDialog v-model="isIndEditConfirmVisible" max-width="480">
    <VCard class="pa-sm-8 pa-4">
      <VCardTitle>Unsaved changes</VCardTitle>
      <VCardText>
        <p>
          Keep the changes to
          <strong
            >{{ indEditingChip?.original }} ->
            {{ indPendingEditDecision?.formatted }}</strong
          >?
        </p>
      </VCardText>
      <VCardActions>
        <VSpacer />
        <VBtn variant="text" color="secondary" @click="cancelIndEditDecision">
          Revert
        </VBtn>
        <VBtn variant="tonal" color="primary" @click="confirmIndEditDecision">
          Keep changes
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>

  <VDialog v-model="isIndDeleteDialogVisible" max-width="480">
    <VCard class="pa-sm-8 pa-4">
      <VCardTitle>Remove category</VCardTitle>
      <VCardText>
        <p v-if="indPendingDeletion">
          Are you sure you want to permanently remove
          <strong>{{ indPendingDeletion.removed.join(", ") }}</strong
          >?
        </p>
      </VCardText>
      <VCardActions>
        <VSpacer />
        <VBtn variant="text" color="secondary" @click="cancelIndDeleteDialog">
          Cancel
        </VBtn>
        <VBtn variant="tonal" color="error" @click="confirmIndDeleteDialog">
          Remove
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>

  <VDialog v-model="isEditConfirmDialogVisible" max-width="480">
    <VCard class="pa-sm-8 pa-4">
      <VCardTitle>Unsaved changes</VCardTitle>
      <VCardText>
        <p>
          Keep the changes to
          <strong
            >{{ editingChip?.original }} ->
            {{ pendingEditDecision?.formatted }}</strong
          >?
        </p>
      </VCardText>
      <VCardActions>
        <VSpacer />
        <VBtn variant="text" color="secondary" @click="cancelEditDecision">
          Revert
        </VBtn>
        <VBtn variant="tonal" color="primary" @click="confirmEditDecision">
          Keep changes
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>

  <VDialog v-model="isDeleteDialogVisible" max-width="480">
    <VCard class="pa-sm-8 pa-4">
      <VCardTitle>Remove category</VCardTitle>
      <VCardText>
        <p v-if="pendingDeletion">
          Are you sure you want to permanently remove
          <strong>{{ pendingDeletion.removed.join(", ") }}</strong
          >?
        </p>
      </VCardText>
      <VCardActions>
        <VSpacer />
        <VBtn variant="text" color="secondary" @click="cancelDeleteDialog">
          Cancel
        </VBtn>
        <VBtn variant="tonal" color="error" @click="confirmDeleteDialog">
          Remove
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>

<style scoped>
.chip-edit-input {
  border: none;
  background: transparent;
  color: inherit;
  font: inherit;
  inline-size: 120px;
  min-inline-size: 80px;
  outline: none;
}

.chip-editing {
  border: 1px dashed rgb(var(--v-theme-primary));
  padding-inline: 6px;
}

.chip-editing.duplicate {
  border-color: rgb(var(--v-theme-error));
}

.testTed {
  /* stylelint-disable-next-line @stylistic/indentation */
  background-color: rgba(var(--v-theme-background), 0.25);
}
</style>
