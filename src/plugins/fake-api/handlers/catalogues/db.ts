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
        category: "Seating",
        type: "Product",
        activeState: "Active",
        sku: "CAT-SEA-014",
        qty: 18,
        image: product10,
        bestPrice: 420,
        chargeTax: true,
        description: "Compact upholstered lounge chair for reception and waiting areas.",
        createdAt: "2026-01-19T11:15:00Z",
      },
      {
        id: "product-2",
        name: "Indoor Planter Set",
        category: "Planters",
        type: "Product",
        activeState: "Active",
        sku: "CAT-PLN-009",
        qty: 24,
        image: product19,
        bestPrice: 135,
        chargeTax: true,
        description: "Indoor planter set with liners for lobbies, corridors, and breakout spaces.",
        createdAt: "2026-03-02T09:45:00Z",
      },
    ],
    producedProducts: [
      {
        id: "produced-product-1",
        name: "Atlas Executive Workstation",
        category: "Desks",
        type: "Produced Product",
        activeState: "Active",
        sku: "CAT-DSK-001",
        qty: 12,
        image: product1,
        bestPrice: 2450,
        chargeTax: true,
        description: "Custom-built executive workstation manufactured in-house for client fit-outs.",
        createdAt: "2026-01-12T09:00:00Z",
      },
    ],
    rentals: [
      {
        id: "rental-1",
        name: "Decorative Pendant Rental Kit",
        category: "Decorative",
        type: "Rental",
        activeState: "Active",
        sku: "CAT-LGT-033",
        qty: 6,
        image: product11,
        bestPrice: 180,
        chargeTax: true,
        description: "Short-term pendant lighting kit available for staged events and temporary installs.",
        createdAt: "2026-01-08T08:20:00Z",
      },
    ],
    onetimeServices: [
      {
        id: "onetime-service-1",
        name: "Decorative Wall Finish Installation",
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
        category: "Architectural",
        type: "Contractual Service",
        activeState: "Non-Active",
        sku: "CAT-ARC-022",
        image: product12,
        bestPrice: 3200,
        chargeTax: true,
        description: "Annual maintenance contract covering inspection, cleaning, and minor lighting repairs.",
        createdAt: "2026-02-02T13:40:00Z",
        phases: [
          {
            id: 1,
            name: "Mobilization",
            price: 900,
            chargeTax: false,
            description: "Kickoff, asset verification, and site-access coordination before recurring service begins.",
          },
          {
            id: 2,
            name: "Preventive Maintenance",
            price: 2300,
            chargeTax: true,
            description: "Scheduled inspections, cleaning, testing, and minor corrective works during the contract term.",
          },
        ],
        salesTasks: [
          {
            id: 1,
            title: "Review contract scope",
          },
          {
            id: 2,
            title: "Confirm maintenance calendar",
          },
        ],
        jobConfiguration: {
          milestones: [
            {
              id: 1,
              name: "Architectural Lighting Maintenance Contract",
              dueDate: null,
              priority: "Normal",
              note: "",
              tasks: [],
              goals: [
                {
                  id: 1,
                  milestoneId: 1,
                  phaseId: 1,
                  name: "Mobilization",
                  dueDate: null,
                  priority: "Normal",
                  note: "Kickoff, asset verification, and site-access coordination before recurring service begins.",
                  tasks: [
                    {
                      id: 1,
                      title: "Confirm site access and asset register",
                      dueAt: null,
                      manhours: 3,
                      notes: "",
                      status: "pending",
                      important: false,
                    },
                  ],
                },
                {
                  id: 2,
                  milestoneId: 1,
                  phaseId: 2,
                  name: "Preventive Maintenance",
                  dueDate: null,
                  priority: "Normal",
                  note: "Scheduled inspections, cleaning, testing, and minor corrective works during the contract term.",
                  tasks: [],
                },
              ],
            },
          ],
        },
      },
    ],
    retainerServices: [
      {
        id: "retainer-service-1",
        name: "Workplace Acoustic Consulting Retainer",
        category: "Acoustic Panels",
        type: "Retainer Service",
        activeState: "Active",
        sku: "CAT-FIN-052",
        image: product14,
        bestPrice: 1500,
        chargeTax: true,
        description: "Monthly acoustic consulting retainer for ongoing workplace planning and review.",
        createdAt: "2026-02-05T10:10:00Z",
        startDate: "2026-02-05",
        endDate: "2026-03-06",
        qty: 30,
        retainerServices: [
          {
            id: 1,
            name: "Monthly Acoustic Review",
            category: "Acoustic Panels",
            price: 1500,
            description: "Scheduled workplace acoustic review and recommendations for active projects.",
          },
        ],
        salesTasks: [
          {
            id: 1,
            title: "Confirm retainer scope",
          },
        ],
        jobConfiguration: {
          milestones: [
            {
              id: 1,
              name: "Workplace Acoustic Consulting Retainer",
              dueDate: null,
              priority: "Normal",
              note: "",
              tasks: [],
              goals: [
                {
                  id: 1,
                  milestoneId: 1,
                  retainerServiceId: 1,
                  name: "Monthly Acoustic Review",
                  dueDate: null,
                  priority: "Normal",
                  note: "Scheduled workplace acoustic review and recommendations for active projects.",
                  tasks: [],
                },
              ],
            },
          ],
        },
      },
    ],
    reccurentServices: [
      {
        id: "reccurent-service-1",
        name: "Monthly Meeting Pod Cleaning Service",
        category: "Meeting Pods",
        type: "Reccurent Service",
        activeState: "Archived",
        sku: "CAT-POD-017",
        image: product2,
        bestPrice: 260,
        chargeTax: true,
        description: "Recurring monthly cleaning and upkeep service for enclosed meeting pods.",
        createdAt: "2025-08-22T16:05:00Z",
      },
    ],
  },
};
