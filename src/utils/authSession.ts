import { ref } from "vue";

export const authVersion = ref(0);
export const currentAuthAccountId = ref<number | string | null>(null);
export const currentAuthEmail = ref<string | null>(null);
export const authChangedAt = ref<string | null>(null);

const readUser = () => useCookie<any>("userData").value ?? null;

export const invalidateAuthSession = () => {
  const user = readUser();

  currentAuthAccountId.value = user?.id ?? user?.accountId ?? null;
  currentAuthEmail.value = user?.email ?? null;
  authChangedAt.value = new Date().toISOString();
  authVersion.value += 1;
};

export const resetAuthSessionState = () => {
  currentAuthAccountId.value = null;
  currentAuthEmail.value = null;
  authChangedAt.value = new Date().toISOString();
  authVersion.value += 1;
};
