<script setup lang="ts">
interface Props {
  userData: {
    id: number;
    fullName: string;
    firstName: string;
    lastName: string;
    company: string;
    username: string;
    role: string;
    country: string;
    contact: string;
    email: string;
    currentPlan: string;
    status: string;
    avatar: string;
    taskDone: number;
    projectDone: number;
    taxId: string;
    language: string;
  };
}

const data = [
  {
    isFriend: false,
    connections: "45",
    name: "Cecilia Payne",
    title: "CEO, Apple Inc.",
    avatar: "/src/assets/images/avatars/avatar-2.png",
  },
  {
    isFriend: true,
    connections: "1.32k",
    name: "Curtis Fletcher",
    title: "CEO, Microsoft Inc.",
    avatar: "/src/assets/images/avatars/avatar-3.png",
  },
  {
    isFriend: true,
    connections: "125",
    name: "Alice Stone",
    title: "CTO, Amazon Inc.",
    avatar: "/src/assets/images/avatars/avatar-4.png",
  },
  {
    isFriend: false,
    connections: "456",
    name: "Darrell Barnes",
    title: "Head of HR, Pinterest Co.",
    avatar: "/src/assets/images/avatars/avatar-5.png",
  },
  {
    isFriend: false,
    connections: "1.2k",
    name: "Eugenia Moore",
    title: "Data Analyst, Sqaurely LTD.",
    avatar: "/src/assets/images/avatars/avatar-8.png",
  },
];

const props = defineProps<Props>();

const standardPlan = {
  plan: "Standard",
  price: 99,
  benefits: ["10 Users", "Up to 10GB storage", "Basic Support"],
};

const moreList = [
  { title: "Add Connection", value: "Add Connection" },
  { title: "Manage", value: "Manage" },
];

const isAddConnectionDialogVisible = ref(false);

const handleMoreAction = (val: string) => {
  switch (val) {
    case "Add Connection":
      isAddConnectionDialogVisible.value = true; // opens your dialog
      break;
    case "Manage":
      // TODO: route to a “manage connections” page or open another dialog
      // router.push({ name: 'connections-manage', params: { id: props.userData.id } })
      console.log("Manage connections for", props.userData.fullName);
      break;
    default:
      console.log("Unhandled action:", val);
  }
};
const isUserInfoEditDialogVisible = ref(false);
const isUpgradePlanDialogVisible = ref(false);

// 👉 Role variant resolver
const resolveUserRoleVariant = (role: string) => {
  if (role === "subscriber") return { color: "warning", icon: "tabler-user" };
  if (role === "author")
    return { color: "success", icon: "tabler-circle-check" };
  if (role === "maintainer")
    return { color: "primary", icon: "tabler-chart-pie-2" };
  if (role === "editor") return { color: "info", icon: "tabler-pencil" };
  if (role === "admin") return { color: "secondary", icon: "tabler-server-2" };

  return { color: "primary", icon: "tabler-user" };
};

/* ---------------- QUICK ACTIONS (only addition) ---------------- */
const emailUser = () => {
  if (props.userData?.email)
    window.location.href = `mailto:${props.userData.email}`;
};
const callUser = () => {
  if (props.userData?.contact)
    window.location.href = `tel:${props.userData.contact}`;
};
const addTask = () => {
  // hook up to your To-Do flow if you want
  console.log("Add task for", props.userData?.fullName);
};
const scheduleMeeting = () => {
  // hook up to your meeting flow if you want
  console.log("Schedule meeting for", props.userData?.fullName);
};
</script>

<template>
  <VRow>
    <!-- SECTION User Details -->
    <VCol cols="12">
      <VCard v-if="props.userData">
        <VCardText class="text-center pt-12">
          <!-- 👉 Avatar -->
          <VAvatar
            rounded
            :size="100"
            :color="!props.userData.avatar ? 'primary' : undefined"
            :variant="!props.userData.avatar ? 'tonal' : undefined"
          >
            <VImg v-if="props.userData.avatar" :src="props.userData.avatar" />
            <span v-else class="text-5xl font-weight-medium">
              {{ avatarText(props.userData.fullName) }}
            </span>
          </VAvatar>

          <!-- 👉 User fullName -->
          <h5 class="text-h5 mt-4">
            {{ props.userData.fullName }}
          </h5>

          <!-- Subline like your mock (optional; adapt/remove if not needed) -->
          <div class="text-medium-emphasis mt-1">
            Contact - Individual - General
          </div>

          <!-- 👉 Quick actions (updated to match your screenshot) -->
          <div class="quick-actions">
            <VAvatar
              rounded="lg"
              :size="44"
              color="primary"
              variant="tonal"
              class="quick-action"
              @click="emailUser"
            >
              <VIcon icon="tabler-mail" size="22" />
            </VAvatar>

            <VAvatar
              rounded="lg"
              :size="44"
              color="primary"
              variant="tonal"
              class="quick-action"
              @click="callUser"
            >
              <VIcon icon="tabler-phone" size="22" />
            </VAvatar>

            <VAvatar
              rounded="lg"
              :size="44"
              color="primary"
              variant="tonal"
              class="quick-action"
              @click="addTask"
            >
              <VIcon icon="tabler-checkbox" size="22" />
            </VAvatar>

            <VAvatar
              rounded="lg"
              :size="44"
              color="primary"
              variant="tonal"
              class="quick-action"
              @click="scheduleMeeting"
            >
              <VIcon icon="tabler-calendar" size="22" />
            </VAvatar>
          </div>
        </VCardText>

        <VCardText>
          <div>
            <!-- (kept empty; your old VRow of icons was here) -->
            <!-- Done task / Done project blocks unchanged -->
          </div>

          <!-- 👉 Details -->
          <h5 class="text-h5">Details</h5>

          <VDivider class="my-4" />

          <!-- 👉 User Details list -->
          <VList class="card-list mt-2">
            <VListItem>
              <VListItemTitle>
                <h6 class="text-h6">
                  Username:
                  <div class="d-inline-block text-body-1">
                    {{ props.userData.fullName }}
                  </div>
                </h6>
              </VListItemTitle>
            </VListItem>

            <VListItem>
              <VListItemTitle>
                <span class="text-h6"> Billing Email: </span>
                <span class="text-body-1">
                  {{ props.userData.email }}
                </span>
              </VListItemTitle>
            </VListItem>

            <VListItem>
              <VListItemTitle>
                <h6 class="text-h6">
                  Status:
                  <div class="d-inline-block text-body-1 text-capitalize">
                    {{ props.userData.status }}
                  </div>
                </h6>
              </VListItemTitle>
            </VListItem>

            <VListItem>
              <VListItemTitle>
                <h6 class="text-h6">
                  Role:
                  <div class="d-inline-block text-capitalize text-body-1">
                    {{ props.userData.role }}
                  </div>
                </h6>
              </VListItemTitle>
            </VListItem>

            <VListItem>
              <VListItemTitle>
                <h6 class="text-h6">
                  Tax ID:
                  <div class="d-inline-block text-body-1">
                    {{ props.userData.taxId }}
                  </div>
                </h6>
              </VListItemTitle>
            </VListItem>

            <VListItem>
              <VListItemTitle>
                <h6 class="text-h6">
                  Contact:
                  <div class="d-inline-block text-body-1">
                    {{ props.userData.contact }}
                  </div>
                </h6>
              </VListItemTitle>
            </VListItem>

            <VListItem>
              <VListItemTitle>
                <h6 class="text-h6">
                  Language:
                  <div class="d-inline-block text-body-1">
                    {{ props.userData.language }}
                  </div>
                </h6>
              </VListItemTitle>
            </VListItem>

            <VListItem>
              <VListItemTitle>
                <h6 class="text-h6">
                  Country:
                  <div class="d-inline-block text-body-1">
                    {{ props.userData.country }}
                  </div>
                </h6>
              </VListItemTitle>
            </VListItem>
          </VList>
        </VCardText>

        <!-- 👉 Edit and Suspend button -->
        <VCardText class="d-flex justify-center gap-x-4">
          <VBtn variant="elevated" @click="isUserInfoEditDialogVisible = true">
            Edit
          </VBtn>

          <VBtn variant="tonal" color="error"> Suspend </VBtn>
        </VCardText>
      </VCard>
    </VCol>
    <!-- !SECTION -->

    <!-- SECTION Current Plan -->
    <VCol cols="12">
      <VCard title="Connections">
        <template #append>
          <div>
            <VBtn icon variant="text">
              <VIcon icon="tabler-settings" color="secondary" />
              <VMenu activator="parent">
                <VList>
                  <VListItem
                    v-for="m in moreList"
                    :key="m.value"
                    @click="handleMoreAction(m.value)"
                  >
                    <VListItemTitle>{{ m.title }}</VListItemTitle>
                  </VListItem>
                </VList>
              </VMenu>
            </VBtn>
          </div>
        </template>

        <VCardText>
          <VList class="card-list">
            <VListItem v-for="data in data" :key="data.name">
              <template #prepend>
                <VAvatar size="38" :image="data.avatar" />
              </template>

              <VListItemTitle class="font-weight-medium">
                {{ data.name }}
              </VListItemTitle>
              <VListItemSubtitle>{{ data.title }} </VListItemSubtitle>

              <template #append>
                <VBtn icon variant="text" color="medium-emphasis">
                  <VIcon icon="tabler-dots-vertical" />
                  <VMenu activator="parent">
                    <VList>
                      <VListItem link>
                        <template #prepend>
                          <VIcon icon="tabler-notes" />
                        </template>
                        <VListItemTitle>To Do</VListItemTitle>
                      </VListItem>

                      <VListItem>
                        <template #prepend>
                          <VIcon icon="tabler-calendar-plus" />
                        </template>
                        <VListItemTitle>Meeting</VListItemTitle>
                      </VListItem>

                      <VListItem>
                        <template #prepend>
                          <VIcon icon="tabler-mail" />
                        </template>
                        <VListItemTitle>Email</VListItemTitle>
                      </VListItem>

                      <VListItem>
                        <template #prepend>
                          <VIcon icon="tabler-phone" />
                        </template>
                        <VListItemTitle>Call</VListItemTitle>
                      </VListItem>
                    </VList>
                  </VMenu>
                </VBtn>
              </template>
            </VListItem>

            <VListItem>
              <VListItemTitle class="pt-2 text-center">
                <!-- Keep as-is / link removed in your snippet -->
              </VListItemTitle>
            </VListItem>
          </VList>
        </VCardText>
      </VCard>
    </VCol>
    <!-- !SECTION -->
  </VRow>

  <!-- 👉 Edit user info dialog -->
  <UserInfoEditDialog
    v-model:is-dialog-visible="isUserInfoEditDialogVisible"
    :user-data="props.userData"
  />

  <!-- 👉 Upgrade plan dialog -->
  <UserUpgradePlanDialog
    v-model:is-dialog-visible="isUpgradePlanDialogVisible"
  />
  <AddConnectionDialog
    v-model:is-dialog-visible="isAddConnectionDialogVisible"
  />
</template>

<style lang="scss" scoped>
.card-list {
  --v-card-list-gap: 0.5rem;
}

.text-capitalize {
  text-transform: capitalize !important;
}

/* --- Quick actions style (matches your screenshot) --- */
.quick-actions {
  display: flex;
  justify-content: center;
  gap: 18px;
  margin-block-start: 14px;
}

.quick-action {
  box-shadow: none;
  opacity: 0.9;
  transition: transform 0.15s ease, opacity 0.15s ease, box-shadow 0.15s ease;
}

.quick-action:hover {
  opacity: 1;
  transform: translateY(-1px);
}
</style>
