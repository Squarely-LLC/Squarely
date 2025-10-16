declare module "country-telephone-data" {
  export const allCountries: Array<{
    name: string;
    iso2?: string;
    iso3?: string;
    dialCode?: string;
    countryCode?: string;
  }>;
  const c: { allCountries: typeof allCountries };
  export default c;
}
