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
      name: "Atlas Executive Workstation",
      brand: "Axis Furnishing",
      category: "Desks",
      type: "Produced Product",
      activeState: "Active",
      sku: "CAT-DSK-001",
      qty: 12,
      image: product1,
      createdAt: "2026-01-12T09:00:00Z",
    },
    {
      id: 2,
      name: "Reception Lounge Chair",
      brand: "Northline",
      category: "Seating",
      type: "Product",
      activeState: "Active",
      sku: "CAT-SEA-014",
      qty: 18,
      image: product10,
      createdAt: "2026-01-19T11:15:00Z",
    },
    {
      id: 3,
      name: "Decorative Pendant Rental Kit",
      brand: "Luma Studio",
      category: "Decorative",
      type: "Rental",
      activeState: "Active",
      sku: "CAT-LGT-033",
      qty: 6,
      image: product11,
      createdAt: "2026-01-08T08:20:00Z",
    },
    {
      id: 4,
      name: "Architectural Lighting Maintenance Contract",
      brand: "Luma Technical Services",
      category: "Architectural",
      type: "Contractual Service",
      activeState: "Non-Active",
      sku: "CAT-ARC-022",
      qty: 0,
      image: product12,
      createdAt: "2026-02-02T13:40:00Z",
    },
    {
      id: 5,
      name: "Workplace Acoustic Consulting Retainer",
      brand: "QuietForm Consulting",
      category: "Acoustic Panels",
      type: "Retainer Service",
      activeState: "Active",
      sku: "CAT-FIN-052",
      qty: 0,
      image: product14,
      createdAt: "2026-02-05T10:10:00Z",
    },
    {
      id: 6,
      name: "Decorative Wall Finish Installation",
      brand: "Surface Lab Interiors",
      category: "Wall Finishes",
      type: "Onetime Service",
      activeState: "Non-Active",
      sku: "CAT-WAL-031",
      qty: 0,
      image: product17,
      createdAt: "2026-02-18T14:30:00Z",
    },
    {
      id: 7,
      name: "Indoor Planter Set",
      brand: "Urban Surface",
      category: "Planters",
      type: "Product",
      activeState: "Active",
      sku: "CAT-PLN-009",
      qty: 24,
      image: product19,
      createdAt: "2026-03-02T09:45:00Z",
    },
    {
      id: 8,
      name: "Monthly Meeting Pod Cleaning Service",
      brand: "ModuSpace Facility Care",
      category: "Meeting Pods",
      type: "Reccurent Service",
      activeState: "Archived",
      sku: "CAT-POD-017",
      qty: 0,
      image: product2,
      createdAt: "2025-08-22T16:05:00Z",
    },
  ],
};
