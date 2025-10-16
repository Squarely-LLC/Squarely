<script setup lang="ts">
import check from '@images/svg/Check.svg'
import keyboard from '@images/svg/keyboard.svg'
import user from '@images/svg/user.svg'
import tracker from '@images/svg/wizard-submit.svg'


const featuresData = [
  { title: 'Contacts', desc: 'Log calls, send emails, update lead stages, schedule meetings, set follow-up tasks, capture notes, manage documents, track contact history, and view statements of account with real-time reporting and automation. Squarely helps you manage every contact interaction in one place.', icon: user },
  { title: 'Deals', desc: 'Create quotes, convert them to orders, issue invoices and receipts, track payments, log deal expenses, attach contracts, set deal collaborators, assign sales reps, monitor deal types and sales locations. All in one place, with Squarely.', icon: keyboard },
  { title: 'Tracking', desc: 'Track order status and progress in real time, assign team members, leave notes, create or auto-generate tasks, and manage schedules with ease. Squarely helps you stay on top of every order so nothing falls through the cracks.', icon: tracker },
  { title: 'API Ready', desc: 'Just change the endpoint and see your own data loaded within seconds.', icon: check },
  { title: 'Excellent Support', desc: 'An easy-to-follow doc with lots of references and code examples.', icon: user },
  { title: 'Well Documented', desc: 'An easy-to-follow doc with lots of references and code examples.', icon: keyboard },
]
</script>

<template>
  <VContainer id="features">
    <div class="feature-cards">
      <div class="headers d-flex justify-center flex-column align-center mb-12">
        <VChip
          label
          color="primary"
          class="mb-4"
          size="small"
        >
          Useful Features
        </VChip>
        <div class="d-flex text-h4 mb-1 align-center flex-wrap justify-center">
          <div class="position-relative me-2">
            <div class="section-title">
              ALL THE TOOLS YOU NEED IN ONE PLACE
            </div>
          </div>
          
        </div>
        <p class="text-body-1 mb-0">
          CRM, Sales, Orders, Projects, Inventory, Production, HR, Payroll, Finance, and more.
          One login, One system, One subscription, fully configured and ready out of the box. 
        </p>
      </div>
      <VRow>
        <VCol
          v-for="(data, index) in featuresData"
          :key="index"
          cols="12"
          md="4"
          sm="6"
        >
          <div class="d-flex flex-column align-center justify-center gap-4 mx-auto">
            <VIcon
              :icon="data.icon"
              size="64"
              color="primary"
            />
            <div class="text-center">
              <h5 class="text-h5 mb-2">
                {{ data.title }}
              </h5>
              <p
                class="text-body-1 mb-6"
                style="max-inline-size: 310px;"
              >
                {{ data.desc }}
              </p>
            </div>
          </div>
        </VCol>
      </VRow>
    </div>
  </VContainer>
</template>

<style lang="scss" scoped>
.feature-cards {
  margin-block: 3.75rem;
}

.section-title::after {
  position: absolute;
  background: url("../../../assets/images/front-pages/icons/section-title-icon.png") no-repeat left bottom;
  background-size: contain;
  block-size: 100%;
  content: "";
  inline-size: 120%;
  inset-block-end: 0;
  inset-inline-start: -12%;
}

.section-title {
  font-size: 24px;
  font-weight: 800;
  line-height: 36px;
}

.feature {
  .v-avatar {
    &.v-avatar--variant-outlined {
      border: 2px solid rgba(var(--v-theme-primary), 0.32);

      &:hover {
        background: rgba(var(--v-theme-primary), 0.16);
        cursor: pointer;
      }
    }
  }
}
</style>
