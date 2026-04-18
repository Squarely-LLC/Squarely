<script setup lang="ts">
import { useUiStore } from "@core/stores/ui";
const router = useRouter();
const ability = useAbility();
const ui = useUiStore();

// TODO: Get type from backend
const userData = useCookie<any>("userData");

const logout = async () => {
  // Remove "accessToken" from cookie
  useCookie("accessToken").value = null;

  // Remove "userData" from cookie
  userData.value = null;

  // Redirect to login page
  await router.push("/login");

  // ℹ️ We had to remove abilities in then block because if we don't nav menu items mutation is visible while redirecting user to login page
  // Remove "userAbilities" from cookie
  useCookie("userAbilityRules").value = null;

  // Reset ability to initial ability
  ability.update([]);
};

const userProfileList = [
  { type: "divider" },
  {
    type: "navItem",
    icon: "tabler-user",
    title: "Profile",
    to: { name: "pages-user-profile", params: { id: 21 } },
  },
  {
    type: "navItem",
    icon: "tabler-edit",
    title: "View Mode",
    action: "openCustomizer",
  },

  {
    type: "navItem",
    icon: "tabler-file-dollar",
    title: "Billing Plan",
    to: {
      name: "apps-user-view-id",
      params: { id: 21, tab: "Billing & Plan" },
    },
    badgeProps: { color: "error", content: "4" },
  },
];

const handleNavItemClick = (item: any) => {
  if (item.action === "openCustomizer") {
    ui.openCustomizer(); // 👈 opens the drawer globally
  }
};
</script>

<template>
  <VBadge
    v-if="userData"
    dot
    bordered
    location="bottom right"
    offset-x="1"
    offset-y="2"
    color="success"
  >
    <VAvatar
      size="38"
      class="cursor-pointer"
      :color="!(userData && userData.avatar) ? 'primary' : undefined"
      :variant="!(userData && userData.avatar) ? 'tonal' : undefined"
    >
      <VImg v-if="userData && userData.avatar" :src="userData.avatar" />
      <VIcon v-else icon="tabler-user" />

      <!-- SECTION Menu -->
      <VMenu activator="parent" width="240" location="bottom end" offset="12px">
        <VList>
          <VListItem>
            <div class="d-flex gap-2 align-center">
              <VListItemAction>
                <VBadge
                  dot
                  location="bottom right"
                  offset-x="3"
                  offset-y="3"
                  color="success"
                  bordered
                >
                  <VAvatar
                    :color="
                      !(userData && userData.avatar) ? 'primary' : undefined
                    "
                    :variant="
                      !(userData && userData.avatar) ? 'tonal' : undefined
                    "
                  >
                    <VImg
                      v-if="userData && userData.avatar"
                      :src="userData.avatar"
                    />
                    <VIcon v-else icon="tabler-user" />
                  </VAvatar>
                </VBadge>
              </VListItemAction>

              <div>
                <h6 class="text-h6 font-weight-medium">
                  {{ userData.fullName || userData.username }}
                </h6>
                <VListItemSubtitle class="text-capitalize text-disabled">
                  {{ userData.role }}
                </VListItemSubtitle>
              </div>
            </div>
          </VListItem>

          <div class="user-profile-scroll">
            <template v-for="item in userProfileList" :key="item.title">
              <VListItem
                v-if="item.type === 'navItem'"
                :to="item.to"
                @click="handleNavItemClick(item)"
              >
                <template #prepend>
                  <VIcon :icon="item.icon" size="22" />
                </template>

                <VListItemTitle>{{ item.title }}</VListItemTitle>

                <template v-if="item.badgeProps" #append>
                  <VBadge rounded="sm" class="me-3" v-bind="item.badgeProps" />
                </template>
              </VListItem>

              <VDivider v-else class="my-2" />
            </template>

            <div class="px-4 py-2">
              <VBtn
                block
                size="small"
                color="error"
                append-icon="tabler-logout"
                @click="logout"
              >
                Logout
              </VBtn>
            </div>
          </div>
        </VList>
      </VMenu>
      <!-- !SECTION -->
    </VAvatar>
  </VBadge>
</template>

<style lang="scss">
.user-profile-scroll {
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgb(var(--v-theme-perfect-scrollbar-thumb)) transparent;
}

.user-profile-scroll::-webkit-scrollbar {
  width: 0.5rem;
}

.user-profile-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.user-profile-scroll::-webkit-scrollbar-thumb {
  border: 2px solid transparent;
  border-radius: 999px;
  background-clip: padding-box;
  background-color: rgb(var(--v-theme-perfect-scrollbar-thumb));
}
</style>
