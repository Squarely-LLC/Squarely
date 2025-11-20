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
const channelsEditingChip = ref<{ original: string; index: number } | null>(null);
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

const cancelChannelsChipEdit = () => {
  channelsEditingChip.value = null;
  channelsEditingValue.value = "";
  channelsEditingDuplicate.value = false;
  channelsEditingChipElement.value = null;
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
  if (channelsEditingInputRef.value && channelsEditingInputRef.value.contains(node))
    return true;
  if (
    channelsEditingChipElement.value &&
    channelsEditingChipElement.value.contains(node)
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

onMounted(() => {
  document.addEventListener("pointerdown", handleGlobalPointerDown, true);
  document.addEventListener("pointerdown", handleIndPointerDown, true);
  document.addEventListener("pointerdown", handleChannelsPointerDown, true);
});

onUnmounted(() => {
  document.removeEventListener("pointerdown", handleGlobalPointerDown, true);
  document.removeEventListener("pointerdown", handleIndPointerDown, true);
  document.removeEventListener("pointerdown", handleChannelsPointerDown, true);
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
  <VCard class="mb-6" title="Organization">
    <VCardText>
      <div class="mb-4">
        <h6 class="text-subtitle-1 mb-2">Categories</h6>
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
                <input
                  ref="editingInputRef"
                  v-model="editingValue"
                  class="chip-edit-input me-2"
                  @keydown.stop="handleEditKeydown"
                  @input="handleEditInput"
                  @click.stop
                  @mousedown.stop
                  @pointerdown.stop
                />
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

  <VCard class="mb-6" title="Individual">
    <VCardText>
      <div class="mb-4">
        <h6 class="text-subtitle-1 mb-2">Categories</h6>
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

  <VCard class="mb-6" title="Default Contact type">
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

  <VCard class="mb-6" title="Channels">
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
</style>
