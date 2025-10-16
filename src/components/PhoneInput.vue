<script setup lang="ts">
import { AsYouType, parsePhoneNumberFromString } from "libphonenumber-js";
import { computed, defineExpose, ref, watch } from "vue";

interface Country {
  code: string;
  label: string;
  dial: string;
  flag: string;
}

const COUNTRIES: Country[] = [
  { code: "LB", label: "Lebanon", dial: "+961", flag: "🇱🇧" },
  { code: "US", label: "United States", dial: "+1", flag: "🇺🇸" },
  { code: "GB", label: "United Kingdom", dial: "+44", flag: "🇬🇧" },
  { code: "FR", label: "France", dial: "+33", flag: "🇫🇷" },
  { code: "IN", label: "India", dial: "+91", flag: "🇮🇳" },
];

const props = defineProps<{
  modelValue?: string;
  defaultCountry?: string;
  placeholder?: string;
  rules?: Array<(v: any) => boolean | string>;
}>();
const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
  (e: "country-change", iso: string): void;
}>();

const input = ref(props.modelValue ?? "");
const selected = ref<Country | null>(
  COUNTRIES.find((c) => c.code === (props.defaultCountry || "LB")) ||
    COUNTRIES[0]
);
const open = ref(false);
const search = ref("");
const errorMessage = ref<string | null>(null);

watch(
  () => props.modelValue,
  (v) => {
    input.value = v ?? "";
  }
);

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return COUNTRIES;
  return COUNTRIES.filter(
    (c) => c.label.toLowerCase().includes(q) || c.dial.includes(q)
  );
});

function pick(c: Country) {
  selected.value = c;
  open.value = false;
  emit("country-change", c.code);
  normalizeAndEmit();
}

function normalizeAndEmit() {
  try {
    const parsed = parsePhoneNumberFromString(
      input.value || "",
      selected.value?.code as any
    );
    if (parsed && parsed.isValid()) {
      emit("update:modelValue", parsed.number);
      return;
    }
  } catch (e) {
    // ignore
  }
  const digits = (input.value || "").replace(/\D/g, "");
  const dial = selected.value?.dial?.replace("+", "") || "";
  if (digits) emit("update:modelValue", `+${dial}${digits}`);
  else emit("update:modelValue", "");
}

function onInput(e: Event) {
  const raw = (e.target as HTMLInputElement).value;
  try {
    const at = new AsYouType((selected.value?.code || undefined) as any);
    input.value = at.input(raw);
  } catch (e) {
    input.value = raw;
  }
  normalizeAndEmit();
}

function validate() {
  errorMessage.value = null;
  const v = input.value || props.modelValue || "";
  if (props.rules && props.rules.length) {
    for (const r of props.rules) {
      const res = r(v);
      if (res !== true) {
        errorMessage.value = typeof res === "string" ? res : "Invalid";
        return { valid: false };
      }
    }
  }
  try {
    const parsed = parsePhoneNumberFromString(
      v || "",
      selected.value?.code as any
    );
    if (v && (!parsed || !parsed.isValid())) {
      errorMessage.value = "Enter a valid phone number";
      return { valid: false };
    }
  } catch (e) {
    if (v) {
      errorMessage.value = "Enter a valid phone number";
      return { valid: false };
    }
  }
  return { valid: true };
}

function resetValidation() {
  errorMessage.value = null;
}

defineExpose({ validate, resetValidation });
</script>

<template>
  <div class="phone-input">
    <div class="row">
      <button type="button" class="country-btn" @click="open = !open">
        <span class="flag">{{ selected?.flag }}</span>
        <span class="dial">{{ selected?.dial }}</span>
      </button>
      <input
        :placeholder="props.placeholder || 'Enter phone'"
        :value="input"
        @input="onInput"
      />
    </div>

    <div v-if="open" class="dropdown">
      <input v-model="search" placeholder="Search countries" />
      <ul>
        <li v-for="c in filtered" :key="c.code" @click="pick(c)">
          <span>{{ c.flag }}</span>
          <span>{{ c.label }}</span>
          <span>{{ c.dial }}</span>
        </li>
      </ul>
    </div>

    <div v-if="errorMessage" class="error">{{ errorMessage }}</div>
  </div>
</template>

<style scoped>
.phone-input {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.country-btn {
  padding: 6px;
  border: 1px solid var(--v-theme-surface-variant);
  border-radius: 6px;
}

.flag {
  inline-size: 20px;
}

.dropdown {
  padding: 8px;
  border: 1px solid var(--v-theme-surface-variant);
  border-radius: 6px;
}

.error {
  color: var(--v-theme-error, #ff4c51);
  font-size: 12px;
}
</style>
