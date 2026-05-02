<script setup lang="ts">
import { useAuthStore } from "@/stores/auth";
import { useGenerateImageVariant } from "@core/composable/useGenerateImageVariant";
import authV2VerifyEmailIllustrationDark from "@images/pages/auth-v2-verify-email-illustration-dark.png";
import authV2VerifyEmailIllustrationLight from "@images/pages/auth-v2-verify-email-illustration-light.png";
import authV2MaskDark from "@images/pages/misc-mask-dark.png";
import authV2MaskLight from "@images/pages/misc-mask-light.png";
import { VNodeRenderer } from "@layouts/components/VNodeRenderer";
import { themeConfig } from "@themeConfig";

definePage({
  meta: {
    layout: "blank",
    public: true,
  },
});

const authThemeImg = useGenerateImageVariant(
  authV2VerifyEmailIllustrationLight,
  authV2VerifyEmailIllustrationDark,
);

const authThemeMask = useGenerateImageVariant(authV2MaskLight, authV2MaskDark);
const authStore = useAuthStore();
const route = useRoute();
const router = useRouter();
const ability = useAbility();

const verificationCode = ref("");
const errors = ref<Record<string, string | undefined>>({
  email: undefined,
  code: undefined,
});
const infoMessage = ref<string | null>(null);
const mockCode = ref<string | null>(
  route.query.mockCode ? String(route.query.mockCode) : null,
);

const targetEmail = computed(
  () =>
    (route.query.email ? String(route.query.email) : null) ||
    authStore.pendingVerificationEmail ||
    authStore.user?.email ||
    "hello@example.com",
);

const submitVerification = async () => {
  try {
    errors.value = {
      email: undefined,
      code: undefined,
    };
    infoMessage.value = null;

    const response = await authStore.verifyEmail({
      email: targetEmail.value,
      code: verificationCode.value,
    });
    ability.update(response.userAbilityRules);
    await router.replace("/");
  } catch (err) {
    errors.value = (err as any)?.data?.errors ||
      (err as any)?.response?._data?.errors || {
        code: "Verification failed",
      };
  }
};

const resendVerification = async () => {
  try {
    errors.value = {
      email: undefined,
      code: undefined,
    };
    const response = await authStore.resendVerification(targetEmail.value);
    mockCode.value = response.verificationCode;
    infoMessage.value = `Verification code resent to ${response.email}`;
  } catch (err) {
    errors.value = (err as any)?.data?.errors ||
      (err as any)?.response?._data?.errors || {
        email: "Could not resend verification code",
      };
  }
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
            max-width="431"
            :src="authThemeImg"
            class="auth-illustration mt-16 mb-2"
          />
        </div>

        <img
          class="auth-footer-mask flip-in-rtl"
          :src="authThemeMask"
          alt="auth-footer-mask"
          height="280"
          width="100"
        />
      </div>
    </VCol>

    <VCol
      cols="12"
      md="4"
      class="auth-card-v2 d-flex align-center justify-center"
    >
      <VCard flat :max-width="500" class="mt-12 mt-sm-0 pa-6">
        <VCardText>
          <h4 class="text-h4 mb-1">Verify your email ✉️</h4>
          <p class="text-body-1 mb-0">
            Account activation link sent to your email address:
            <span class="font-weight-medium text-high-emphasis">{{
              targetEmail
            }}</span>
            Please follow the link inside to continue.
          </p>

          <AppTextField
            v-model="verificationCode"
            class="mt-6"
            label="Verification code"
            placeholder="Enter 6-digit code"
            :error-messages="errors.code"
          />

          <VAlert v-if="mockCode" class="mt-4" color="info" variant="tonal">
            Mock code: <strong>{{ mockCode }}</strong>
          </VAlert>

          <VAlert
            v-if="infoMessage"
            class="mt-4"
            color="success"
            variant="tonal"
          >
            {{ infoMessage }}
          </VAlert>

          <VBtn block class="my-5" @click="submitVerification">
            Verify email
          </VBtn>

          <div class="d-flex align-center justify-center">
            <span class="me-1">Didn't get the mail? </span
            ><a href="#" @click.prevent="resendVerification">Resend</a>
          </div>
        </VCardText>
      </VCard>
    </VCol>
  </VRow>
</template>

<style lang="scss">
@use "@core/scss/template/pages/page-auth";
</style>
