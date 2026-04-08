import product1 from "@images/ecommerce-images/product-1.png";
import product10 from "@images/ecommerce-images/product-10.png";
import product11 from "@images/ecommerce-images/product-11.png";
import product12 from "@images/ecommerce-images/product-12.png";
import product14 from "@images/ecommerce-images/product-14.png";
import product17 from "@images/ecommerce-images/product-17.png";
import product19 from "@images/ecommerce-images/product-19.png";
import product2 from "@images/ecommerce-images/product-2.png";

import type { CatalogueTables } from "./types";

interface DB {
  tables: CatalogueTables;
}

export const db: DB = {
  tables: {
    products: [
      {
        id: "product-1",
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
        id: "product-2",
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
    ],
    producedProducts: [
      {
        id: "produced-product-1",
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
    ],
    rentals: [
      {
        id: "rental-1",
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
    ],
    onetimeServices: [
      {
        id: "onetime-service-1",
        name: "Decorative Wall Finish Installation",
        brand: "Surface Lab Interiors",
        category: "Wall Finishes",
        type: "Onetime Service",
        activeState: "Non-Active",
        sku: "CAT-WAL-031",
        image: product17,
        createdAt: "2026-02-18T14:30:00Z",
        bestPrice: 1850,
        chargeTax: true,
        description:
          "One-off decorative wall finish scope for a specified area and agreed handover date.",
        relatedItems: [
          {
            id: 1,
            name: "Decorative Primer Coat",
            category: "Wall Finishes",
            description: "Preparation layer required before the final finish.",
          },
        ],
        salesTasks: [
          {
            id: 1,
            title: "Site inspection",
          },
          {
            id: 2,
            title: "Client finish approval",
          },
        ],
        jobConfiguration: {
          milestones: [
            {
              id: 1,
              name: "Decorative Wall Finish Installation",
              dueDate: null,
              priority: "Normal",
              note: "",
              tasks: [],
              goals: [
                {
                  id: 1,
                  milestoneId: 1,
                  name: "Site readiness",
                  dueDate: null,
                  priority: "Normal",
                  note: "Confirm wall preparation, access, and protections.",
                  tasks: [
                    {
                      id: 1,
                      title: "Confirm substrate condition",
                      dueAt: null,
                      manhours: 2,
                      notes: "",
                      status: "pending",
                      important: false,
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
    ],
    contractualServices: [
      {
        id: "contractual-service-1",
        name: "Architectural Lighting Maintenance Contract",
        brand: "Luma Technical Services",
        category: "Architectural",
        type: "Contractual Service",
        activeState: "Non-Active",
        sku: "CAT-ARC-022",
        image: product12,
        createdAt: "2026-02-02T13:40:00Z",
      },
    ],
    retainerServices: [
      {
        id: "retainer-service-1",
        name: "Workplace Acoustic Consulting Retainer",
        brand: "QuietForm Consulting",
        category: "Acoustic Panels",
        type: "Retainer Service",
        activeState: "Active",
        sku: "CAT-FIN-052",
        image: product14,
        createdAt: "2026-02-05T10:10:00Z",
      },
    ],
    reccurentServices: [
      {
        id: "reccurent-service-1",
        name: "Monthly Meeting Pod Cleaning Service",
        brand: "ModuSpace Facility Care",
        category: "Meeting Pods",
        type: "Reccurent Service",
        activeState: "Archived",
        sku: "CAT-POD-017",
        image: product2,
        createdAt: "2025-08-22T16:05:00Z",
      },
    ],
  },
};
