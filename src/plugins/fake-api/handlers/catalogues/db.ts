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
        sku: "PRD005",
        qty: 18,
        image: product10,
        bestPrice: 420,
        chargeTax: true,
        description:
          "Compact upholstered lounge chair for reception and waiting areas.",
        createdAt: "2026-01-19T11:15:00Z",
      },
      {
        id: "product-2",
        name: "Indoor Planter Set",
        category: "Planters",
        type: "Product",
        activeState: "Active",
        sku: "PRD008",
        qty: 24,
        image: product19,
        bestPrice: 135,
        chargeTax: true,
        description:
          "Indoor planter set with liners for lobbies, corridors, and breakout spaces.",
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
        sku: "PRP006",
        image: product1,
        bestPrice: 2450,
        chargeTax: true,
        description:
          "Custom-built executive workstation manufactured in-house for client fit-outs.",
        createdAt: "2026-01-12T09:00:00Z",
        options: [
          {
            id: 1,
            name: "Finish",
            type: "Dropdown",
            description:
              "Single-select dropdown for a predefined list of values.",
            values: ["Walnut Veneer", "Oak Veneer", "Matte Black"],
          },
          {
            id: 2,
            name: "Cable Access",
            type: "Select Buttons",
            description:
              "Quick-pick button choices for a fixed set of production options.",
            values: [],
          },
        ],
        rawMaterials: [
          {
            id: 1,
            name: "MDF Core Board",
            qty: 3,
          },
          {
            id: 2,
            name: "Walnut Veneer Sheet",
            qty: 2,
          },
          {
            id: 3,
            name: "Powder-Coated Steel Leg Frame",
            qty: 1,
          },
        ],
        measurements: [
          {
            id: 1,
            name: "Width",
            type: "Number",
            description:
              "Numeric input for values like count, depth, or weight.",
            values: [],
          },
          {
            id: 2,
            name: "Cable Grommet Position",
            type: "Dropdown",
            description:
              "Single-select dropdown for a predefined list of values.",
            values: ["Centered", "Offset Left", "Offset Right"],
          },
        ],
        salesTasks: [
          {
            id: 1,
            title: "Review production drawing",
            collaborators: [],
            afterWhen: "+1 day",
            manhours: null,
            notes:
              "Validate finish and cable-access selections before fabrication.",
            status: "pending",
            important: false,
            attachment: null,
            relatedTo: null,
            steps: [],
          },
        ],
        jobConfiguration: {
          milestones: [
            {
              id: 1,
              name: "Atlas Executive Workstation",
              dueDate: null,
              priority: "Normal",
              note: "",
              tasks: [],
              goals: [
                {
                  id: 1,
                  milestoneId: 1,
                  name: "Approve production details",
                  dueDate: null,
                  priority: "Normal",
                  note: "Confirm dropdown selections, dimensions, and raw material availability.",
                  tasks: [
                    {
                      id: 1,
                      title: "Confirm hardware and veneer availability",
                      collaborators: [],
                      afterWhen: "+2 days",
                      manhours: 2,
                      notes: "",
                      status: "pending",
                      important: false,
                      attachment: null,
                      relatedTo: null,
                      steps: [],
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
    ],
    rentals: [
      {
        id: "rental-1",
        name: "Decorative Pendant Rental Kit",
        category: "Decorative",
        type: "Rental",
        activeState: "Active",
        sku: "RTL001",
        qty: 6,
        image: product11,
        bestPrice: 180,
        chargeTax: true,
        description:
          "Short-term pendant lighting kit available for staged events and temporary installs.",
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
        sku: "OTS007",
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
            price: 240,
            chargeTax: true,
            description: "Preparation layer required before the final finish.",
          },
        ],
        salesTasks: [
          {
            id: 1,
            title: "Site inspection",
            collaborators: [],
            afterWhen: "+1 day",
            manhours: null,
            notes: "",
            status: "pending",
            important: false,
            attachment: null,
            relatedTo: null,
            steps: [],
          },
          {
            id: 2,
            title: "Client finish approval",
            collaborators: [],
            afterWhen: "+1 week",
            manhours: null,
            notes: "",
            status: "pending",
            important: false,
            attachment: null,
            relatedTo: null,
            steps: [],
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
                      collaborators: [],
                      afterWhen: "+1 day",
                      manhours: 2,
                      notes: "",
                      status: "pending",
                      important: false,
                      attachment: null,
                      relatedTo: null,
                      steps: [],
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
        sku: "CTS002",
        image: product12,
        bestPrice: 3200,
        chargeTax: true,
        description:
          "Annual maintenance contract covering inspection, cleaning, and minor lighting repairs.",
        createdAt: "2026-02-02T13:40:00Z",
        phases: [
          {
            id: 1,
            name: "Mobilization",
            price: 900,
          },
          {
            id: 2,
            name: "Preventive Maintenance",
            price: 2300,
          },
        ],
        salesTasks: [
          {
            id: 1,
            title: "Review contract scope",
            collaborators: [],
            afterWhen: "+1 day",
            manhours: null,
            notes: "",
            status: "pending",
            important: false,
            attachment: null,
            relatedTo: null,
            steps: [],
          },
          {
            id: 2,
            title: "Confirm maintenance calendar",
            collaborators: [],
            afterWhen: "+1 month",
            manhours: null,
            notes: "",
            status: "pending",
            important: false,
            attachment: null,
            relatedTo: null,
            steps: [],
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
                      collaborators: [],
                      afterWhen: "+1 week",
                      manhours: 3,
                      notes: "",
                      status: "pending",
                      important: false,
                      attachment: null,
                      relatedTo: null,
                      steps: [],
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
        sku: "RTS003",
        image: product14,
        bestPrice: 1500,
        chargeTax: true,
        description:
          "Monthly acoustic consulting retainer for ongoing workplace planning and review.",
        createdAt: "2026-02-05T10:10:00Z",
        qty: 30,
        retainerServices: [
          {
            id: 1,
            name: "Monthly Acoustic Review",
            category: "Acoustic Panels",
            qty: 1,
            description:
              "Scheduled workplace acoustic review and recommendations for active projects.",
          },
        ],
        salesTasks: [
          {
            id: 1,
            title: "Confirm retainer scope",
            collaborators: [],
            afterWhen: "+1 week",
            manhours: null,
            notes: "",
            status: "pending",
            important: false,
            attachment: null,
            relatedTo: null,
            steps: [],
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
        sku: "RCS004",
        image: product2,
        bestPrice: 260,
        chargeTax: true,
        description:
          "Recurring monthly cleaning and upkeep service for enclosed meeting pods.",
        createdAt: "2025-08-22T16:05:00Z",
        qty: 12,
        reccurentServices: [
          {
            id: 1,
            name: "Monthly Pod Cleaning Visit",
            category: "",
            description: "Recurring scheduled cleaning visit for meeting pods.",
          },
        ],
        salesTasks: [],
        jobConfiguration: {
          milestones: [
            {
              id: 1,
              name: "Monthly Meeting Pod Cleaning Service",
              dueDate: null,
              priority: "Normal",
              note: "",
              tasks: [],
              goals: [
                {
                  id: 1,
                  milestoneId: 1,
                  reccurentServiceId: 1,
                  name: "Monthly Pod Cleaning Visit",
                  dueDate: null,
                  priority: "Normal",
                  note: "Recurring scheduled cleaning visit for meeting pods.",
                  tasks: [],
                },
              ],
            },
          ],
        },
      },
    ],
  },
};
