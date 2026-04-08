import product1 from "@images/ecommerce-images/product-1.png";
import product10 from "@images/ecommerce-images/product-10.png";
import product11 from "@images/ecommerce-images/product-11.png";
import product12 from "@images/ecommerce-images/product-12.png";
import product14 from "@images/ecommerce-images/product-14.png";
import product17 from "@images/ecommerce-images/product-17.png";
import product19 from "@images/ecommerce-images/product-19.png";
import product2 from "@images/ecommerce-images/product-2.png";

import type { CatalogueProduct } from "./types";

interface DB {
  products: CatalogueProduct[];
}

export const db: DB = {
  products: [
    {
      id: 1,
      name: "Facade Stone Library",
      brand: "Squarely Materials",
      category: "Materials",
      type: "Product",
      activeState: "Active",
      sku: "CAT-MAT-001",
      qty: 42,
      image: product1,
      createdAt: "2025-11-12T09:00:00Z",
    },
    {
      id: 2,
      name: "Executive Desk System",
      brand: "Axis Furnishing",
      category: "Furniture",
      type: "Produced Product",
      activeState: "Non-Active",
      sku: "CAT-FUR-014",
      qty: 8,
      image: product10,
      createdAt: "2025-12-01T11:15:00Z",
    },
    {
      id: 3,
      name: "Linear Pendant Series",
      brand: "Luma Studio",
      category: "Lighting",
      type: "Rental",
      activeState: "Active",
      sku: "CAT-LGT-033",
      qty: 26,
      image: product11,
      createdAt: "2026-01-08T08:20:00Z",
    },
    {
      id: 4,
      name: "Outdoor Paving Set",
      brand: "Urban Surface",
      category: "Landscape",
      type: "Contractual Service",
      activeState: "Archived",
      sku: "CAT-LND-022",
      qty: 0,
      image: product12,
      createdAt: "2025-09-14T13:40:00Z",
    },
    {
      id: 5,
      name: "Acoustic Wall Panel",
      brand: "QuietForm",
      category: "Finishes",
      type: "Onetime Service",
      activeState: "Active",
      sku: "CAT-FIN-052",
      qty: 64,
      image: product14,
      createdAt: "2026-02-05T10:10:00Z",
    },
    {
      id: 6,
      name: "Reception Seating Kit",
      brand: "Northline",
      category: "Furniture",
      type: "Retainer Service",
      activeState: "Non-Active",
      sku: "CAT-FUR-031",
      qty: 11,
      image: product17,
      createdAt: "2026-02-18T14:30:00Z",
    },
    {
      id: 7,
      name: "Decorative Mirror Collection",
      brand: "Frame & Form",
      category: "Accessories",
      type: "Reccurent Service",
      activeState: "Active",
      sku: "CAT-ACC-009",
      qty: 19,
      image: product19,
      createdAt: "2026-03-02T09:45:00Z",
    },
    {
      id: 8,
      name: "Meeting Pod Package",
      brand: "ModuSpace",
      category: "Office",
      type: "Product",
      activeState: "Archived",
      sku: "CAT-OFC-017",
      qty: 0,
      image: product2,
      createdAt: "2025-08-22T16:05:00Z",
    },
  ],
};
