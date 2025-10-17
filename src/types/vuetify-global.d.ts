declare module "@vue/runtime-core" {
  interface VuetifyDisplay {
    // common breakpoint booleans
    xs?: boolean;
    sm?: boolean;
    md?: boolean;
    lg?: boolean;
    xl?: boolean;

    // width in pixels
    width?: number;

    // helper aliases frequently used in Vuetify templates
    xsOnly?: boolean;
    smOnly?: boolean;
    mdOnly?: boolean;
    lgOnly?: boolean;
    xlOnly?: boolean;

    smAndDown?: boolean;
    smAndUp?: boolean;
    mdAndDown?: boolean;
    mdAndUp?: boolean;
    lgAndDown?: boolean;
    lgAndUp?: boolean;

    name?: string;

    // fallback for other properties that may be referenced
    [key: string]: any;
  }

  interface ComponentCustomProperties {
    // permissive $vuetify so template and script-setup usages don't error
    $vuetify: any;
  }
}

export {};
