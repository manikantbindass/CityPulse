export interface City {
  id: string;
  name: string;
  countryCode: string;
  timezone: string;
}

export interface CityPage {
  items: City[];
  page: number;
  size: number;
}
