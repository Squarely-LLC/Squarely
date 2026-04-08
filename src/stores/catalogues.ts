import { defineStore } from "pinia";
import { toRaw } from "vue";

import { db } from "@/plugins/fake-api/handlers/catalogues/db";
import type {
  CatalogueItemType,
  CatalogueProduct,
} from "@/plugins/fake-api/handlers/catalogues/types";

const STORAGE_KEY = "app.catalogue-products.v1";
const DEFAULT_TYPE: CatalogueItemType = "Product";

function cloneProduct(product: CatalogueProduct): CatalogueProduct {
  const raw = toRaw(product) as CatalogueProduct;
  return {
    ...raw,
    brand: raw.brand ?? null,
    image: raw.image ?? null,
  };
}

function cloneProductsArray(products: CatalogueProduct[]) {
  return products.map(product => cloneProduct(product));
}

function loadFromStorage(): CatalogueProduct[] | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;

    return parsed as CatalogueProduct[];
  } catch (error) {
    console.warn("Failed to load catalogue products from storage:", error);
    return null;
  }
}

function saveToStorage(products: CatalogueProduct[]) {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
  } catch (error) {
    console.warn("Failed to save catalogue products to storage:", error);
  }
}

function nextProductId(items: CatalogueProduct[]) {
  const numericIds = items
    .map(product => Number(product.id))
    .filter(value => Number.isFinite(value) && value > 0);

  if (!numericIds.length) return 1;

  return Math.max(...numericIds) + 1;
}

function duplicateNameRoot(name: string) {
  return name.replace(/ - Copy(?: \d+)?$/i, "").trim();
}

function duplicateSkuRoot(sku: string) {
  return sku.replace(/-COPY(?:-\d+)?$/i, "").trim();
}

function nextDuplicateName(items: CatalogueProduct[], originalName: string) {
  const root = duplicateNameRoot(originalName);
  const taken = new Set(items.map(item => item.name.trim().toLowerCase()));
  const firstCopy = `${root} - Copy`;

  if (!taken.has(firstCopy.toLowerCase())) return firstCopy;

  let counter = 2;
  while (taken.has(`${root} - Copy ${counter}`.toLowerCase())) {
    counter += 1;
  }

  return `${root} - Copy ${counter}`;
}

function nextDuplicateSku(items: CatalogueProduct[], originalSku: string) {
  const root = duplicateSkuRoot(originalSku);
  const baseSku = `${root}-COPY`;
  const taken = new Set(items.map(item => item.sku.trim().toLowerCase()));

  if (!taken.has(baseSku.toLowerCase())) return baseSku;

  let counter = 2;
  while (taken.has(`${baseSku}-${counter}`.toLowerCase())) {
    counter += 1;
  }

  return `${baseSku}-${counter}`;
}

function normalizeProduct(
  payload: Partial<CatalogueProduct>,
  assignedId: number,
): CatalogueProduct {
  const now = new Date().toISOString();
  const legacyStatus = (payload as CatalogueProduct & { status?: string }).status;
  const mappedType: CatalogueItemType =
    payload.type ??
    (legacyStatus === "Inactive"
      ? "Contractual Service"
      : legacyStatus === "Scheduled"
        ? "Retainer Service"
        : DEFAULT_TYPE);

  return {
    id: assignedId,
    name: payload.name?.trim() || "Untitled Catalogue Item",
    brand: payload.brand?.trim() || null,
    category: payload.category?.trim() || "Uncategorized",
    type: mappedType,
    activeState: payload.activeState ?? "Active",
    sku: payload.sku?.trim() || `CAT-${assignedId.toString().padStart(4, "0")}`,
    qty: Number.isFinite(Number(payload.qty)) ? Number(payload.qty) : 0,
    image: payload.image?.trim() || null,
    createdAt: payload.createdAt || now,
  };
}

const seedProducts = () => cloneProductsArray(db.products);

export const useCataloguesStore = defineStore("catalogues", {
  state: () => ({
    items: [] as CatalogueProduct[],
    initialized: false,
  }),
  getters: {
    all: state => state.items,
    byId: state => (id: number | string) =>
      state.items.find(product => String(product.id) === String(id)) ?? null,
  },
  actions: {
    init(force = false) {
      if (this.initialized && !force) return;

      const stored = loadFromStorage();

      if (stored && stored.length) {
        this.items = cloneProductsArray(stored);
      } else {
        this.items = seedProducts();
        saveToStorage(this.items);
      }

      this.initialized = true;

      if (typeof window !== "undefined") {
        this.$subscribe(
          (_mutation, state) => {
            saveToStorage(cloneProductsArray(state.items));
          },
          { detached: true },
        );
      }
    },
    addProduct(payload: Partial<CatalogueProduct>) {
      const incomingId =
        payload.id && Number(payload.id) > 0 ? Number(payload.id) : undefined;
      const id = incomingId ?? nextProductId(this.items);
      const normalized = normalizeProduct(payload, id);
      this.items.unshift(normalized);
      return normalized;
    },
    updateProduct(id: number | string, patch: Partial<CatalogueProduct>) {
      const index = this.items.findIndex(
        product => String(product.id) === String(id),
      );
      if (index === -1) return null;

      const updated = normalizeProduct(
        { ...this.items[index], ...patch, id: this.items[index].id },
        this.items[index].id,
      );
      this.items.splice(index, 1, updated);
      return updated;
    },
    removeProduct(id: number | string) {
      const index = this.items.findIndex(
        product => String(product.id) === String(id),
      );
      if (index === -1) return;
      this.items.splice(index, 1);
    },
    duplicateProduct(id: number | string) {
      const original = this.items.find(
        product => String(product.id) === String(id),
      );
      if (!original) return null;

      return this.addProduct({
        ...cloneProduct(original),
        id: undefined,
        name: nextDuplicateName(this.items, original.name),
        sku: nextDuplicateSku(this.items, original.sku),
        createdAt: new Date().toISOString(),
      });
    },
    nextId() {
      return nextProductId(this.items);
    },
    replaceAll(products: CatalogueProduct[]) {
      this.items = cloneProductsArray(products);
    },
  },
});
