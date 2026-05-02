<script setup lang="ts">
import { useAuthStore } from "@/stores/auth";
import authV1BottomShape from "@images/svg/auth-v1-bottom-shape.svg?raw";
import authV1TopShape from "@images/svg/auth-v1-top-shape.svg?raw";
import { VNodeRenderer } from "@layouts/components/VNodeRenderer";
import { themeConfig } from "@themeConfig";

definePage({
  meta: {
    layout: "blank",
    public: true,
  },
});

const form = ref({
  newPassword: "",
  confirmPassword: "",
});

const authStore = useAuthStore();
const route = useRoute();
const router = useRouter();
const errors = ref<Record<string, string | undefined>>({
  password: undefined,
  confirmPassword: undefined,
  email: undefined,
  token: undefined,
});

const resetEmail = computed(() =>
  route.query.email ? String(route.query.email) : "",
);
const resetToken = computed(() =>
  route.query.token ? String(route.query.token) : "",
);

const isPasswordVisible = ref(false);
const isConfirmPasswordVisible = ref(false);

const submitResetPassword = async () => {
  try {
    errors.value = {
      password: undefined,
      confirmPassword: undefined,
      email: undefined,
      token: undefined,
    };

    if (!resetEmail.value || !resetToken.value) {
      errors.value.email = "Missing reset email or token";
      return;
    }

    if (form.value.newPassword !== form.value.confirmPassword) {
      errors.value.confirmPassword = "Passwords do not match";
      return;
    }

    const response = await authStore.resetPassword({
      email: resetEmail.value,
      token: resetToken.value,
      password: form.value.newPassword,
    });

    await router.replace({
      name: "login",
      query: { email: response.email },
    });
  } catch (err) {
    errors.value = (err as any)?.data?.errors ||
      (err as any)?.response?._data?.errors || {
        password: "Could not reset password",
      };
  }
};
</script>

<template>
  <div class="auth-wrapper d-flex align-center justify-center pa-4">
    <div class="position-relative my-sm-16">
      <!-- 👉 Top shape -->
      <VNodeRenderer
        :nodes="h('div', { innerHTML: authV1TopShape })"
        class="text-primary auth-v1-top-shape d-none d-sm-block"
      />

      <!-- 👉 Bottom shape -->
      <VNodeRenderer
        :nodes="h('div', { innerHTML: authV1BottomShape })"
        class="text-primary auth-v1-bottom-shape d-none d-sm-block"
      />

      <!-- 👉 Auth Card -->
      <VCard
        class="auth-card"
        max-width="460"
        :class="$vuetify.display.smAndUp ? 'pa-6' : 'pa-2'"
      >
        <VCardItem class="justify-center">
          <VCardTitle>
            <RouterLink to="/">
              <div class="app-logo">
                <VNodeRenderer :nodes="themeConfig.app.logo" />
                <h1 class="app-logo-title">
                  {{ themeConfig.app.title }}
                </h1>
              </div>
            </RouterLink>
          </VCardTitle>
        </VCardItem>

        <VCardText>
          <h4 class="text-h4 mb-1">Reset Password 🔒</h4>
          <p class="mb-0">
            Your new password must be different from previously used passwords
          </p>
          <p v-if="resetEmail" class="mt-2 mb-0 text-body-2">
            Resetting password for <strong>{{ resetEmail }}</strong>
          </p>
        </VCardText>

        <VCardText>
          <VForm @submit.prevent="submitResetPassword">
            <VRow>
              <!-- password -->
              <VCol cols="12">
                <AppTextField
                  v-model="form.newPassword"
                  autofocus
                  label="New Password"
                  placeholder="············"
                  :rules="[requiredValidator]"
                  :error-messages="errors.password"
                  :type="isPasswordVisible ? 'text' : 'password'"
                  autocomplete="password"
                  :append-inner-icon="
                    isPasswordVisible ? 'tabler-eye-off' : 'tabler-eye'
                  "
                  @click:append-inner="isPasswordVisible = !isPasswordVisible"
                />
              </VCol>

              <!-- Confirm Password -->
              <VCol cols="12">
                <AppTextField
                  v-model="form.confirmPassword"
                  label="Confirm Password"
                  autocomplete="confirm-password"
                  placeholder="············"
                  :rules="[requiredValidator]"
                  :error-messages="errors.confirmPassword"
                  :type="isConfirmPasswordVisible ? 'text' : 'password'"
                  :append-inner-icon="
                    isConfirmPasswordVisible ? 'tabler-eye-off' : 'tabler-eye'
                  "
                  @click:append-inner="
                    isConfirmPasswordVisible = !isConfirmPasswordVisible
                  "
                />
              </VCol>

              <!-- reset password -->
              <VCol cols="12">
                <VBtn block type="submit"> Set New Password </VBtn>
              </VCol>

              <!-- back to login -->
              <VCol cols="12">
                <RouterLink
                  class="d-flex align-center justify-center"
                  :to="{ name: 'login' }"
                >
                  <VIcon
                    icon="tabler-chevron-left"
                    size="20"
                    class="me-1 flip-in-rtl"
                  />
                  <span>Back to login</span>
                </RouterLink>
              </VCol>
            </VRow>
          </VForm>
        </VCardText>
      </VCard>
    </div>
  </div>
</template>

<style lang="scss">
@use "@core/scss/template/pages/page-auth";
</style>
