<script lang="ts" setup>
import {
  defineComponent,
  h,
  type PropType,
} from "vue";
import {
  VList,
  VListItem,
  VMenu,
} from "vuetify/components";

type MenuItem = {
  title?: string;
  value?: string;
  prependIcon?: string;
  appendIcon?: string;
  class?: string;
  disabled?: boolean;
  to?: unknown;
  onClick?: ((event?: Event) => void) | null;
  children?: MenuItem[];
  [key: string]: unknown;
};

interface Props {
  menuList?: MenuItem[];
  itemProps?: boolean;
  iconSize?: string;
  class?: string;
}

const props = withDefaults(defineProps<Props>(), {
  class: "text-disabled",
  menuList: () => [],
});

const stripChildren = (item: MenuItem) => {
  const { children, ...rest } = item;
  return rest;
};

const MoreBtnMenuItems = defineComponent({
  name: "MoreBtnMenuItems",
  props: {
    items: {
      type: Array as PropType<MenuItem[]>,
      default: () => [],
    },
    itemProps: {
      type: Boolean,
      default: false,
    },
  },
  setup(componentProps) {
    return () =>
      componentProps.items.map((item) => {
        const key = String(item.value ?? item.title ?? "menu-item");

        if (item.children?.length) {
          return h(
            VMenu,
            { key, location: "end", submenu: true },
            {
              activator: ({ props: activatorProps }: { props: Record<string, unknown> }) =>
                h(VListItem, {
                  ...(componentProps.itemProps ? stripChildren(item) : {}),
                  ...activatorProps,
                  title: item.title,
                  prependIcon: item.prependIcon,
                  appendIcon: item.appendIcon ?? "tabler-chevron-right",
                  class: item.class,
                  disabled: item.disabled,
                }),
              default: () =>
                h(
                  VList,
                  null,
                  {
                    default: () =>
                      h(MoreBtnMenuItems, {
                        items: item.children,
                        itemProps: componentProps.itemProps,
                      }),
                  },
                ),
            },
          );
        }

        return h(VListItem, {
          key,
          ...(componentProps.itemProps ? stripChildren(item) : {}),
          title: item.title,
          prependIcon: item.prependIcon,
          appendIcon: item.appendIcon,
          class: item.class,
          disabled: item.disabled,
        });
      });
  },
});
</script>

<template>
  <IconBtn :class="props.class">
    <VIcon :size="iconSize" icon="tabler-dots-vertical" />

    <VMenu v-if="props.menuList?.length" activator="parent">
      <VList>
        <MoreBtnMenuItems :items="props.menuList" :item-props="props.itemProps" />
      </VList>
    </VMenu>
  </IconBtn>
</template>
