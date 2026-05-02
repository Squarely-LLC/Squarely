<script setup lang="ts">
import { useAuthStore } from "@/stores/auth";
import { useGenerateImageVariant } from "@core/composable/useGenerateImageVariant";
import { VNodeRenderer } from "@layouts/components/VNodeRenderer";
import { themeConfig } from "@themeConfig";

import authV2ForgotPasswordIllustrationDark from "@images/pages/auth-v2-forgot-password-illustration-dark.png";
import authV2ForgotPasswordIllustrationLight from "@images/pages/auth-v2-forgot-password-illustration-light.png";
import authV2MaskDark from "@images/pages/misc-mask-dark.png";
import authV2MaskLight from "@images/pages/misc-mask-light.png";

const email = ref("");
const authStore = useAuthStore();
const router = useRouter();
const errors = ref<Record<string, string | undefined>>({
  email: undefined,
});
const resetToken = ref<string | null>(null);
const infoMessage = ref<string | null>(null);

const authThemeImg = useGenerateImageVariant(
  authV2ForgotPasswordIllustrationLight,
  authV2ForgotPasswordIllustrationDark,
);

const authThemeMask = useGenerateImageVariant(authV2MaskLight, authV2MaskDark);

definePage({
  meta: {
    layout: "blank",
    unauthenticatedOnly: true,
  },
});

const submitForgotPassword = async () => {
  try {
    errors.value = { email: undefined };
    infoMessage.value = null;
    const response = await authStore.forgotPassword({ email: email.value });
    resetToken.value = response.resetToken;
    infoMessage.value = `Reset token generated for ${response.email}`;
  } catch (err) {
    errors.value = (err as any)?.data?.errors ||
      (err as any)?.response?._data?.errors || {
        email: "Could not create reset request",
      };
  }
};

const goToReset = async () => {
  if (!resetToken.value) return;

  await router.push({
    name: "pages-authentication-reset-password-v1",
    query: {
      email: email.value,
      token: resetToken.value,
    },
  });
};
</script>

<template>
  <RouterLink to="/">
    <div class="auth-logo d-flex align-center gap-x-3">
      <VNodeRenderer :nodes="themeConfig.app.logo" />
      <h1 class="auth-title">
        {{ themeConfig.app.title }}
      </h1>
    </div>
  </RouterLink>

  <VRow class="auth-wrapper bg-surface" no-gutters>
    <VCol md="8" class="d-none d-md-flex">
      <div class="position-relative bg-background w-100 me-0">
        <div
          class="d-flex align-center justify-center w-100 h-100"
          style="padding-inline: 150px"
        >
          <VImg
            max-width="468"
            :src="authThemeImg"
            class="auth-illustration mt-16 mb-2"
          />
        </div>

        <img
          class="auth-footer-mask"
          :src="authThemeMask"
          alt="auth-footer-mask"
          height="280"
          width="100"
        />
      </div>
    </VCol>

    <VCol cols="12" md="4" class="d-flex align-center justify-center">
      <VCard flat :max-width="500" class="mt-12 mt-sm-0 pa-4">
        <VCardText>
          <h4 class="text-h4 mb-1">Forgot Password? 🔒</h4>
          <p class="mb-0">
            Enter your email and we'll send you instructions to reset your
            password
          </p>
        </VCardText>

        <VCardText>
          <VForm @submit.prevent="submitForgotPassword">
            <VRow>
              <!-- email -->
              <VCol cols="12">
                <AppTextField
                  v-model="email"
                  autofocus
                  label="Email"
                  type="email"
                  placeholder="johndoe@email.com"
                  :rules="[requiredValidator, emailValidator]"
                  :error-messages="errors.email"
                />
              </VCol>

              <VCol v-if="resetToken" cols="12">
                <VAlert color="info" variant="tonal">
                  Mock reset token: <strong>{{ resetToken }}</strong>
                </VAlert>
              </VCol>

              <VCol v-if="infoMessage" cols="12">
                <VAlert color="success" variant="tonal">
                  {{ infoMessage }}
                </VAlert>
              </VCol>

              <!-- Reset link -->
              <VCol cols="12">
                <VBtn block type="submit"> Send Reset Link </VBtn>
              </VCol>

              <VCol v-if="resetToken" cols="12">
                <VBtn
                  block
                  color="secondary"
                  variant="tonal"
                  @click="goToReset"
                >
                  Continue To Reset Password
                </VBtn>
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
    </VCol>
  </VRow>
</template>

<style lang="scss">
@use "@core/scss/template/pages/page-auth";
</style>
