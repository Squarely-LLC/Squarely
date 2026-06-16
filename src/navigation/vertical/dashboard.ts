export default [
  {
    title: "Dashboard",
    icon: { icon: "tabler-smart-home" },
    to: "dashboards-analytics",
    action: "read",
    subject: "dashboard",

    // children: [
    //   {
    //     title: 'Analytics',
    //     to: 'dashboards-analytics',
    //   },
    //   {
    //     title: 'CRM',
    //     to: 'dashboards-crm',
    //   },
    //   {
    //     title: 'Ecommerce',
    //     to: 'dashboards-ecommerce',
    //   },
    //   {
    //     title: 'Academy',
    //     to: 'dashboards-academy',
    //   },
    //   {
    //     title: 'Logistics',
    //     to: 'dashboards-logistics',
    //   },
    // ],
    // badgeContent: '5',
    // badgeClass: 'bg-error',
  },

  // {
  //   title: 'Front Pages',
  //   icon: { icon: 'tabler-files' },
  //   children: [
  //     {
  //       title: 'Landing',
  //       to: 'front-pages-landing-page',
  //       target: '_blank',
  //     },
  //     {
  //       title: 'Pricing',
  //       to: 'front-pages-pricing',
  //       target: '_blank',
  //     },
  //     {
  //       title: 'Payment',
  //       to: 'front-pages-payment',
  //       target: '_blank',
  //     },
  //     {
  //       title: 'Checkout',
  //       to: 'front-pages-checkout',
  //       target: '_blank',
  //     },
  //     {
  //       title: 'Help Center',
  //       to: 'front-pages-help-center',
  //       target: '_blank',
  //     },
  //   ],
  // },

  {
    title: "Reports",
    icon: { icon: "tabler-report" },
    to: "dashboards-crm",
    action: "read",
    subject: "reports",
  },
  { heading: "Activities" },
  {
    title: "Tasks",
    icon: { icon: "tabler-list-check" },
    to: "apps-todo-list",
    action: "read",
    subject: "tasks",
  },
  {
    title: "Calendar",
    icon: { icon: "tabler-calendar" },
    to: "apps-calendar",
    action: "read",
    subject: "calendar",
  },
  { heading: "Operations" },
  {
    title: "Contacts",
    icon: { icon: "tabler-address-book" },
    to: "apps-contact-list",
    action: "read",
    subject: "contacts",
  },
  {
    title: "Deals",
    icon: { icon: "tabler-contract" },
    to: "operations-deals-list",
    action: "read",
    subject: "deals",
  },
  {
    title: "Jobs",
    icon: { icon: "tabler-briefcase" },
    to: "operations-jobs-list",
    action: "read",
    subject: "jobs",
  },
  { heading: "Admin" },
  {
    title: "HR",
    icon: { icon: "tabler-users-group" },
    to: "apps-hr-list",
    action: "read",
    subject: "hr",
  },
  {
    title: "Finance",
    icon: { icon: "tabler-calculator" },
    to: "finance-finance",
    action: "read",
    subject: "finance",
  },
  { heading: "Settings" },
  {
    title: "Catalogue",
    icon: { icon: "tabler-library" },
    to: "catalogues-list",
    action: "read",
    subject: "catalogue",
  },
  {
    title: "Configurations",
    icon: { icon: "tabler-settings" },
    to: "configuration-configuration",
    action: "read",
    subject: "configuration",
  },
  {
    title: "Users & Roles",
    icon: { icon: "tabler-user-cog" },
    to: "settings-users-roles",
    action: "read",
    subject: "usersRoles",
  },
];
