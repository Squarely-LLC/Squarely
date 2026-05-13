<script setup lang="ts">
import { VForm } from "vuetify/components/VForm";

import { VNodeRenderer } from "@layouts/components/VNodeRenderer";
import { themeConfig } from "@themeConfig";

import authV2RegisterIllustrationBorderedDark from "@images/pages/auth-v2-register-illustration-bordered-dark.png";
import authV2RegisterIllustrationBorderedLight from "@images/pages/auth-v2-register-illustration-bordered-light.png";
import authV2RegisterIllustrationDark from "@images/pages/auth-v2-register-illustration-dark.png";
import authV2RegisterIllustrationLight from "@images/pages/auth-v2-register-illustration-light.png";
import authV2MaskDark from "@images/pages/misc-mask-dark.png";
import authV2MaskLight from "@images/pages/misc-mask-light.png";

const isDialogVisible = ref(false);

const imageVariant = useGenerateImageVariant(
  authV2RegisterIllustrationLight,
  authV2RegisterIllustrationDark,
  authV2RegisterIllustrationBorderedLight,
  authV2RegisterIllustrationBorderedDark,
  true
);

const authThemeMask = useGenerateImageVariant(authV2MaskLight, authV2MaskDark);
const route = useRoute();
const router = useRouter();
definePage({
  meta: {
    layout: "blank",
  },
});

const refVForm = ref<VForm>();

const form = ref({
  name: "",
  email: "",
  industry: "",
  privacyPolicies: false,
});

const isPasswordVisible = ref(false);

const onSubmit = () => {
  refVForm.value?.validate().then(({ valid: isValid }) => {
    if (isValid) window.location.href = 'https://calendar.google.com/calendar/u/0/appointments/schedules/AcZssZ06UxkFs_beMbPJaAdDalA5OHbqXO5m-geJp8SIvl5RYDhQgbQT92HxCcmSDuZ-iR1olRKtH3co';
  });
};
</script>

<template>
  <div class="book-demo-wrapper">
  <RouterLink to="/">
    <div class="auth-logo d-flex align-center gap-x-3">
      <VNodeRenderer :nodes="themeConfig.app.logo" />
      <h1 class="auth-title">
        {{ themeConfig.app.title }}
      </h1>
    </div>
  </RouterLink>

  <VRow no-gutters class="auth-wrapper bg-surface">
    <VCol md="8" class="d-none d-md-flex">
      <div class="position-relative bg-background w-100 me-0">
        <div
          class="d-flex align-center justify-center w-100 h-100"
          style="padding-inline: 100px"
        >
          <VImg
            max-width="500"
            :src="imageVariant"
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

    <VCol
      cols="12"
      md="4"
      class="auth-card-v2 d-flex align-center justify-center"
      style="background-color: rgb(var(--v-theme-surface))"
    >
      <VCard flat :max-width="500" class="mt-12 mt-sm-0 pa-4">
        <VCardText>
          <h4 class="text-h4 mb-1">Adventure starts here 🚀</h4>
          <p class="mb-0">Make your app management easy and fun!</p>
        </VCardText>

        <VCardText>
          <VForm ref="refVForm" @submit.prevent="onSubmit">
            <VRow>
              <!-- Name -->
              <VCol cols="12">
                <AppTextField
                  v-model="form.name"
                  :rules="[requiredValidator]"
                  autofocus
                  label="Name"
                  placeholder="John Doe"
                />
              </VCol>

              <!-- email -->
              <VCol cols="12">
                <AppTextField
                  v-model="form.email"
                  :rules="[requiredValidator, emailValidator]"
                  label="Email"
                  type="email"
                  placeholder="johndoe@email.com"
                />
              </VCol>

              <!-- industry -->
              <VCol cols="12">
                <AppTextField
                  v-model="form.industry"
                  :rules="[requiredValidator]"
                  label="Industry"
                  placeholder="e.g., Technology, Finance"
                />

                <div class="d-flex align-center my-6">
                  <VCheckbox
                    id="privacy-policy"
                    v-model="form.privacyPolicies"
                    :rules="[requiredValidator]"
                    inline
                  />
                  <VLabel for="privacy-policy" style="opacity: 1">
                    <span class="me-1 text-high-emphasis">I agree to</span>
                    <a href="javascript:void(0)" class="text-primary"
                      >privacy policy & terms</a
                    >
                  </VLabel>
                </div>

                <VBtn block type="submit"> Sign up </VBtn>
              </VCol>

              <!-- create account -->
              <VCol cols="12" class="text-center text-base">
                <span class="d-inline-block">Already have an account?</span>
                <RouterLink
                  class="text-primary ms-1 d-inline-block"
                  :to="{ name: 'login' }"
                >
                  Sign in instead
                </RouterLink>
              </VCol>

              <VCol cols="12" class="d-flex align-center">
                <VDivider />
                <span class="mx-4">or</span>
                <VDivider />
              </VCol>

              <!-- auth providers -->
            </VRow>
          </VForm>
        </VCardText>
        <VCol cols="12" class="text-center">
          <VDialog v-model="isDialogVisible" width="500">
            <!-- Activator -->
            <template #activator="{ props }">
              <button v-bind="props" type="none" class="gsi-material-button">
                <div class="gsi-material-button-state"></div>
                <div class="gsi-material-button-content-wrapper">
                  <div class="gsi-material-button-icon">
                    <svg
                      version="1.1"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 48 48"
                      xmlns:xlink="http://www.w3.org/1999/xlink"
                      style="display: block"
                    >
                      <path
                        fill="#EA4335"
                        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                      ></path>
                      <path
                        fill="#4285F4"
                        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                      ></path>
                      <path
                        fill="#FBBC05"
                        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                      ></path>
                      <path
                        fill="#34A853"
                        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                      ></path>
                      <path fill="none" d="M0 0h48v48H0z"></path>
                    </svg>
                  </div>
                  <span class="gsi-material-button-contents"
                    >Sign up with Google</span
                  >
                  <span style="display: none">Sign up with Google</span>
                </div>
              </button>
            </template>

            <!-- Dialog close btn -->
            <DialogCloseBtn @click="isDialogVisible = !isDialogVisible" />

            <!-- Dialog Content -->
            <VCard title="GOOGLE SIGN UP">
              <VCardText> To be added </VCardText>

              <VCardText class="d-flex justify-end">
                <VBtn @click="isDialogVisible = false"> I accept </VBtn>
              </VCardText>
            </VCard>
          </VDialog>
          <!-- <AuthProvider /> -->
        </VCol>
      </VCard>
    </VCol>
  </VRow>
  </div>
</template>

<style lang="scss">
@use "@core/scss/template/pages/page-auth";

.book-demo-wrapper {
  margin-inline: auto;
  max-inline-size: 1536px;
}

.gsi-material-button {
  position: relative;
  overflow: hidden;
  box-sizing: border-box;
  border: 1px solid #747775;
  border-radius: 4px;
  appearance: none;
  background-color: white;
  background-image: none;
  block-size: 40px;
  color: #1f1f1f;
  cursor: pointer;
  font-family: Roboto, arial, sans-serif;
  font-size: 14px;
  inline-size: auto;
  letter-spacing: 0.25px;
  max-inline-size: 400px;
  min-inline-size: min-content;
  outline: none;
  padding-block: 0;
  padding-inline: 12px;
  text-align: center;
  transition: background-color 0.218s, border-color 0.218s, box-shadow 0.218s;
  user-select: none;
  vertical-align: middle;
  white-space: nowrap;
}

.gsi-material-button .gsi-material-button-icon {
  block-size: 20px;
  inline-size: 20px;
  margin-inline-end: 12px;
  min-inline-size: 20px;
}

.gsi-material-button .gsi-material-button-content-wrapper {
  position: relative;
  display: flex;
  flex-flow: row nowrap;
  align-items: center;
  justify-content: space-between;
  block-size: 100%;
  inline-size: 100%;
}

.gsi-material-button .gsi-material-button-contents {
  overflow: hidden;
  flex-grow: 1;
  font-family: Roboto, arial, sans-serif;
  font-weight: 500;
  text-overflow: ellipsis;
  vertical-align: top;
}

.gsi-material-button .gsi-material-button-state {
  position: absolute;
  inset: 0;
  opacity: 0;
  transition: opacity 0.218s;
}

.gsi-material-button:disabled {
  border-color: #1f1f1f1f;
  background-color: #ffffff61;
  cursor: default;
}

.gsi-material-button:disabled .gsi-material-button-contents {
  opacity: 0.38;
}

.gsi-material-button:disabled .gsi-material-button-icon {
  opacity: 0.38;
}

.gsi-material-button:not(:disabled):active .gsi-material-button-state,
.gsi-material-button:not(:disabled):focus .gsi-material-button-state {
  background-color: #303030;
  opacity: 0.12;
}

.gsi-material-button:not(:disabled):hover {
  box-shadow:
    0 1px 2px 0 rgba(60, 64, 67, 30%),
    0 1px 3px 1px rgba(60, 64, 67, 15%);
}

.gsi-material-button:not(:disabled):hover .gsi-material-button-state {
  background-color: #303030;
  opacity: 0.08;
}
</style>
