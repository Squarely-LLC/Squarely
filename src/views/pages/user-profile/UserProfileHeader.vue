<script lang="ts" setup>
import coverImg from "@images/pages/user-profile-header-bg.png";

const userData = useCookie<any>("userData");

const profileHeaderData = computed(() => ({
  coverImg,
  profileImg: userData.value?.avatar || userData.value?.picture || "",
  fullName: userData.value?.fullName || userData.value?.username || "User",
  designation: userData.value?.role || "User",
  location: userData.value?.centerId || "Current center",
  joiningDate: userData.value?.temporaryPassword
    ? "Temporary password"
    : "Active account",
}));

const avatarText = (name?: string | null) =>
  String(name || "?")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
</script>

<template>
  <VCard>
    <VImg
      :src="profileHeaderData.coverImg"
      min-height="125"
      max-height="250"
      cover
    />

    <VCardText
      class="d-flex align-bottom flex-sm-row flex-column justify-center gap-x-6"
    >
      <div class="d-flex h-0">
        <VAvatar
          rounded
          size="130"
          :image="profileHeaderData.profileImg"
          class="user-profile-avatar mx-auto"
          color="primary"
          variant="tonal"
        >
          <span v-if="!profileHeaderData.profileImg">
            {{ avatarText(profileHeaderData.fullName) }}
          </span>
        </VAvatar>
      </div>

      <div class="user-profile-info w-100 mt-16 pt-6 pt-sm-0 mt-sm-0">
        <h4 class="text-h4 text-center text-sm-start font-weight-medium mb-2">
          {{ profileHeaderData.fullName }}
        </h4>

        <div
          class="d-flex align-center justify-center justify-sm-space-between flex-wrap gap-5"
        >
          <div
            class="d-flex flex-wrap justify-center justify-sm-start flex-grow-1 gap-6"
          >
            <span class="d-flex gap-x-2 align-center">
              <VIcon size="24" icon="tabler-shield" />
              <div class="text-body-1 font-weight-medium">
                {{ profileHeaderData.designation }}
              </div>
            </span>

            <span class="d-flex gap-x-2 align-center">
              <VIcon size="24" icon="tabler-building" />
              <div class="text-body-1 font-weight-medium">
                {{ profileHeaderData.location }}
              </div>
            </span>

            <span class="d-flex gap-x-2 align-center">
              <VIcon size="24" icon="tabler-key" />
              <div class="text-body-1 font-weight-medium">
                {{ profileHeaderData.joiningDate }}
              </div>
            </span>
          </div>
        </div>
      </div>
    </VCardText>
  </VCard>
</template>

<style lang="scss">
.user-profile-avatar {
  border: 5px solid rgb(var(--v-theme-surface));
  background-color: rgb(var(--v-theme-surface)) !important;
  inset-block-start: -3rem;

  .v-img__img {
    border-radius: 0.125rem;
  }
}
</style>
