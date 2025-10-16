<script setup lang="ts">
import Footer from "@/views/front-pages/front-page-footer.vue";
import Navbar from "@/views/front-pages/front-page-navbar.vue";
import type { CheckoutData } from "@/views/wizard-examples/checkout/types";
import googleHome from "@images/pages/google-home.png";
import iphone11 from "@images/pages/iphone-11.png";
import customAddress from "@images/svg/address.svg";
import customCart from "@images/svg/cart.svg";
import customPayment from "@images/svg/payment.svg";
import customTrending from "@images/svg/trending.svg";

import { useConfigStore } from "@core/stores/config";

definePage({
  meta: {
    layout: "blank",
    public: true,
  },
});

const store = useConfigStore();

store.skin = "default";

const checkoutSteps = [
  {
    title: "Cart",
    icon: customCart,
  },
  {
    title: "Address",
    icon: customAddress,
  },
  {
    title: "Payment",
    icon: customPayment,
  },
  {
    title: "Confirmation",
    icon: customTrending,
  },
];

const checkoutData = ref<CheckoutData>({
  cartItems: [
    {
      id: 1,
      name: "Google - Google Home - White",
      seller: "Google",
      inStock: true,
      rating: 4,
      price: 299,
      discountPrice: 359,
      image: googleHome,
      quantity: 1,
      estimatedDelivery: "18th Nov 2021",
    },
    {
      id: 2,
      name: "Apple iPhone 11 (64GB, Black)",
      seller: "Apple",
      inStock: true,
      rating: 4,
      price: 899,
      discountPrice: 999,
      image: iphone11,
      quantity: 1,
      estimatedDelivery: "20th Nov 2021",
    },
  ],
  promoCode: "",
  orderAmount: 1198,
  deliveryAddress: "home",
  deliverySpeed: "free",
  deliveryCharges: 0,
  addresses: [
    {
      title: "John Doe (Default)",
      desc: "4135 Parkway Street, Los Angeles, CA, 90017",
      subtitle: "1234567890",
      value: "home",
    },
    {
      title: "ACME Inc.",
      desc: "87 Hoffman Avenue, New York, NY, 10016",
      subtitle: "1234567890",
      value: "office",
    },
  ],
});

const currentStep = ref(0);
</script>

<template>
  <div class="checkout-page">
    <Navbar />
    <VContainer>
      <div class="checkout-card">
        <div class="text-center mb-9">
          <h3 class="text-h3 pricing-title mb-2">Book Your Session</h3>
          <p class="mb-0">
            Get in touch with us to start growing your business!
          </p>
        </div>

        <!-- 👉 stepper content -->

        <div
          data-w-id="e5be6668-4e3d-ae9d-976b-8160fbdf91b6"
          class="cta-card cta-v1"
          style="opacity: 1"
        >
          <div
            id="w-node-e5be6668-4e3d-ae9d-976b-8160fbdf91b9-fbdf91b6"
            class="inner-container"
          ></div>
          <div
            id="w-node-e5be6668-4e3d-ae9d-976b-8160fbdf91bd-fbdf91b6"
            class="inner-container"
          >
            <div class="html-embed w-embed w-script">
              <!-- Calendly inline widget begin -->
              <div
                class="calendly-inline-widget"
                data-url="https://calendly.com/embed-demo-sales/discovery-call"
                style="
                  position: relative;
                  block-size: 700px;
                  min-inline-size: 320px;
                "
                data-processed="true"
              >
                <div class="calendly-spinner">
                  <div class="calendly-bounce1"></div>
                  <div class="calendly-bounce2"></div>
                  <div class="calendly-bounce3"></div>
                </div>
                <iframe
                  src="https://calendly.com/embed-demo-sales/discovery-call?embed_domain=www.calendly-embed.com&amp;embed_type=Inline"
                  width="100%"
                  height="100%"
                  frameborder="0"
                  title="Select a Date &amp; Time - Calendly"
                ></iframe>
              </div>

              <!-- Calendly inline widget end -->
            </div>
            <div class="text-center">
              <VBtn
                color="primary"
                :to="{ name: 'register' }"
                :size="$vuetify.display.smAndUp ? 'large' : 'default'"
              >
                Get Started
              </VBtn>
            </div>
          </div>
        </div>
      </div>
    </VContainer>
    <Footer />
  </div>
</template>

<style lang="scss">
.checkout-card {
  margin-block: 10.5rem 5.25rem;
}

@media (max-width: 960px) and (min-width: 600px) {
  .checkout-page {
    .v-container {
      padding-inline: 2rem !important;
    }
  }
}

@media (max-width: 600px) {
  .checkout-card {
    margin-block-start: 6rem;
  }
}
</style>
