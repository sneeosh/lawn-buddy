// Climate-zone catalog for the region picker.
// state/province → region → zone + grass-season + centroid lat/lon (for weather API).
// US (50 states) + Canadian provinces. Big-spread states are split into sub-regions.

export type GrassSeason = 'warm' | 'cool' | 'transition';

export type ClimateZone = {
  id: string;
  state: string;     // state or province name
  region: string;
  usdaZone: string;
  grassSeason: GrassSeason;
  lat: number;
  lon: number;
};

export const CLIMATE_ZONES: ClimateZone[] = [
  // ===== US =====

  // Alabama
  { id: 'AL-north', state: 'Alabama', region: 'North (Huntsville, Birmingham)', usdaZone: '7b-8a', grassSeason: 'transition', lat: 33.52, lon: -86.81 },
  { id: 'AL-south', state: 'Alabama', region: 'South / Gulf (Mobile)', usdaZone: '8b-9a', grassSeason: 'warm', lat: 30.69, lon: -88.04 },

  // Alaska
  { id: 'AK-southcentral', state: 'Alaska', region: 'Southcentral (Anchorage)', usdaZone: '4b-5b', grassSeason: 'cool', lat: 61.22, lon: -149.90 },

  // Arizona
  { id: 'AZ-low-desert', state: 'Arizona', region: 'Low Desert (Phoenix, Tucson)', usdaZone: '9b-10a', grassSeason: 'warm', lat: 33.45, lon: -112.07 },
  { id: 'AZ-high-desert', state: 'Arizona', region: 'High Desert (Flagstaff, Prescott)', usdaZone: '6b-7b', grassSeason: 'cool', lat: 35.20, lon: -111.65 },

  // Arkansas
  { id: 'AR-all', state: 'Arkansas', region: 'Statewide', usdaZone: '7a-8a', grassSeason: 'transition', lat: 34.75, lon: -92.29 },

  // California
  { id: 'CA-coastal-north', state: 'California', region: 'Coastal North (SF Bay)', usdaZone: '9b-10a', grassSeason: 'cool', lat: 37.77, lon: -122.42 },
  { id: 'CA-coastal-south', state: 'California', region: 'Coastal South (LA, San Diego)', usdaZone: '10a-10b', grassSeason: 'warm', lat: 34.05, lon: -118.24 },
  { id: 'CA-central-valley', state: 'California', region: 'Central Valley (Sacramento, Fresno)', usdaZone: '9a-9b', grassSeason: 'warm', lat: 38.58, lon: -121.49 },
  { id: 'CA-inland', state: 'California', region: 'Inland / Desert', usdaZone: '9a-10a', grassSeason: 'warm', lat: 33.72, lon: -116.37 },

  // Colorado
  { id: 'CO-front-range', state: 'Colorado', region: 'Front Range (Denver, Colorado Springs)', usdaZone: '5b-6a', grassSeason: 'cool', lat: 39.74, lon: -104.99 },
  { id: 'CO-western-slope', state: 'Colorado', region: 'Western Slope (Grand Junction)', usdaZone: '6b-7a', grassSeason: 'cool', lat: 39.06, lon: -108.55 },
  { id: 'CO-mountains', state: 'Colorado', region: 'Mountains', usdaZone: '3a-5a', grassSeason: 'cool', lat: 39.49, lon: -106.04 },

  // Connecticut
  { id: 'CT-all', state: 'Connecticut', region: 'Statewide', usdaZone: '6a-7a', grassSeason: 'cool', lat: 41.76, lon: -72.67 },

  // Delaware
  { id: 'DE-all', state: 'Delaware', region: 'Statewide', usdaZone: '7a-7b', grassSeason: 'transition', lat: 39.16, lon: -75.52 },

  // Florida
  { id: 'FL-north', state: 'Florida', region: 'North (Jacksonville, Tallahassee)', usdaZone: '8b-9a', grassSeason: 'warm', lat: 30.33, lon: -81.66 },
  { id: 'FL-central', state: 'Florida', region: 'Central (Orlando, Tampa)', usdaZone: '9b', grassSeason: 'warm', lat: 28.54, lon: -81.38 },
  { id: 'FL-south', state: 'Florida', region: 'South (Miami, Naples)', usdaZone: '10b-11a', grassSeason: 'warm', lat: 25.76, lon: -80.19 },

  // Georgia
  { id: 'GA-north-atlanta', state: 'Georgia', region: 'North / Atlanta Metro', usdaZone: '7b-8a', grassSeason: 'transition', lat: 33.75, lon: -84.39 },
  { id: 'GA-central', state: 'Georgia', region: 'Central (Macon, Columbus)', usdaZone: '8a', grassSeason: 'warm', lat: 32.84, lon: -83.63 },
  { id: 'GA-coastal', state: 'Georgia', region: 'South / Coastal (Savannah)', usdaZone: '8b-9a', grassSeason: 'warm', lat: 32.08, lon: -81.10 },

  // Hawaii
  { id: 'HI-all', state: 'Hawaii', region: 'Statewide', usdaZone: '11-13', grassSeason: 'warm', lat: 21.31, lon: -157.86 },

  // Idaho
  { id: 'ID-north', state: 'Idaho', region: 'North (Coeur d\'Alene)', usdaZone: '5b-6a', grassSeason: 'cool', lat: 47.68, lon: -116.78 },
  { id: 'ID-south', state: 'Idaho', region: 'South (Boise, Twin Falls)', usdaZone: '6b-7a', grassSeason: 'cool', lat: 43.62, lon: -116.20 },

  // Illinois
  { id: 'IL-all', state: 'Illinois', region: 'Statewide', usdaZone: '5b-6b', grassSeason: 'cool', lat: 39.78, lon: -89.65 },

  // Indiana
  { id: 'IN-all', state: 'Indiana', region: 'Statewide', usdaZone: '5b-6b', grassSeason: 'cool', lat: 39.77, lon: -86.16 },

  // Iowa
  { id: 'IA-all', state: 'Iowa', region: 'Statewide', usdaZone: '4b-5b', grassSeason: 'cool', lat: 41.59, lon: -93.62 },

  // Kansas
  { id: 'KS-east', state: 'Kansas', region: 'East (Kansas City, Wichita)', usdaZone: '6a-7a', grassSeason: 'transition', lat: 37.69, lon: -97.34 },
  { id: 'KS-west', state: 'Kansas', region: 'West', usdaZone: '5b-6b', grassSeason: 'cool', lat: 38.87, lon: -99.32 },

  // Kentucky
  { id: 'KY-west', state: 'Kentucky', region: 'West (Louisville, Lexington)', usdaZone: '6b-7a', grassSeason: 'transition', lat: 38.25, lon: -85.76 },
  { id: 'KY-east', state: 'Kentucky', region: 'East / Appalachian', usdaZone: '6a-6b', grassSeason: 'cool', lat: 37.74, lon: -83.45 },

  // Louisiana
  { id: 'LA-all', state: 'Louisiana', region: 'Statewide', usdaZone: '8b-9b', grassSeason: 'warm', lat: 30.45, lon: -91.15 },

  // Maine
  { id: 'ME-all', state: 'Maine', region: 'Statewide', usdaZone: '3b-6a', grassSeason: 'cool', lat: 44.31, lon: -69.78 },

  // Maryland
  { id: 'MD-all', state: 'Maryland', region: 'Statewide', usdaZone: '6b-7b', grassSeason: 'transition', lat: 39.29, lon: -76.61 },

  // Massachusetts
  { id: 'MA-all', state: 'Massachusetts', region: 'Statewide', usdaZone: '5b-7a', grassSeason: 'cool', lat: 42.36, lon: -71.06 },

  // Michigan
  { id: 'MI-all', state: 'Michigan', region: 'Statewide', usdaZone: '4b-6a', grassSeason: 'cool', lat: 42.73, lon: -84.55 },

  // Minnesota
  { id: 'MN-all', state: 'Minnesota', region: 'Statewide', usdaZone: '3a-5a', grassSeason: 'cool', lat: 44.95, lon: -93.09 },

  // Mississippi
  { id: 'MS-all', state: 'Mississippi', region: 'Statewide', usdaZone: '8a-9a', grassSeason: 'warm', lat: 32.30, lon: -90.18 },

  // Missouri
  { id: 'MO-all', state: 'Missouri', region: 'Statewide', usdaZone: '6a-7a', grassSeason: 'transition', lat: 38.63, lon: -90.20 },

  // Montana
  { id: 'MT-all', state: 'Montana', region: 'Statewide', usdaZone: '3a-5b', grassSeason: 'cool', lat: 46.60, lon: -112.04 },

  // Nebraska
  { id: 'NE-east', state: 'Nebraska', region: 'East (Omaha, Lincoln)', usdaZone: '5a-5b', grassSeason: 'transition', lat: 41.26, lon: -95.93 },
  { id: 'NE-west', state: 'Nebraska', region: 'West', usdaZone: '4b-5a', grassSeason: 'cool', lat: 41.13, lon: -100.77 },

  // Nevada
  { id: 'NV-south', state: 'Nevada', region: 'South (Las Vegas)', usdaZone: '9a', grassSeason: 'warm', lat: 36.17, lon: -115.14 },
  { id: 'NV-north', state: 'Nevada', region: 'North (Reno)', usdaZone: '6b-7a', grassSeason: 'cool', lat: 39.53, lon: -119.81 },

  // New Hampshire
  { id: 'NH-all', state: 'New Hampshire', region: 'Statewide', usdaZone: '4a-6a', grassSeason: 'cool', lat: 43.21, lon: -71.54 },

  // New Jersey
  { id: 'NJ-all', state: 'New Jersey', region: 'Statewide', usdaZone: '6b-7b', grassSeason: 'transition', lat: 40.22, lon: -74.77 },

  // New Mexico
  { id: 'NM-north', state: 'New Mexico', region: 'North (Santa Fe, Albuquerque)', usdaZone: '6a-7b', grassSeason: 'cool', lat: 35.69, lon: -105.94 },
  { id: 'NM-south', state: 'New Mexico', region: 'South (Las Cruces)', usdaZone: '7b-8a', grassSeason: 'warm', lat: 32.32, lon: -106.77 },

  // New York
  { id: 'NY-downstate', state: 'New York', region: 'Downstate (NYC, Long Island)', usdaZone: '7a-7b', grassSeason: 'cool', lat: 40.71, lon: -74.01 },
  { id: 'NY-upstate', state: 'New York', region: 'Upstate (excluding NYC metro)', usdaZone: '4b-6a', grassSeason: 'cool', lat: 42.65, lon: -73.76 },

  // North Carolina
  { id: 'NC-mountains', state: 'North Carolina', region: 'Mountains (Asheville)', usdaZone: '6b-7a', grassSeason: 'cool', lat: 35.60, lon: -82.55 },
  { id: 'NC-piedmont', state: 'North Carolina', region: 'Piedmont (Charlotte, Raleigh)', usdaZone: '7b-8a', grassSeason: 'transition', lat: 35.23, lon: -80.84 },
  { id: 'NC-coastal', state: 'North Carolina', region: 'Coastal Plain (Wilmington)', usdaZone: '8a-8b', grassSeason: 'warm', lat: 34.21, lon: -77.89 },

  // North Dakota
  { id: 'ND-all', state: 'North Dakota', region: 'Statewide', usdaZone: '3a-4a', grassSeason: 'cool', lat: 46.81, lon: -100.78 },

  // Ohio
  { id: 'OH-all', state: 'Ohio', region: 'Statewide', usdaZone: '5b-6b', grassSeason: 'cool', lat: 39.96, lon: -82.99 },

  // Oklahoma
  { id: 'OK-all', state: 'Oklahoma', region: 'Statewide', usdaZone: '7a-8a', grassSeason: 'warm', lat: 35.47, lon: -97.52 },

  // Oregon
  { id: 'OR-west', state: 'Oregon', region: 'West / Willamette Valley (Portland, Eugene)', usdaZone: '8a-9a', grassSeason: 'cool', lat: 45.52, lon: -122.68 },
  { id: 'OR-east', state: 'Oregon', region: 'East / High Desert (Bend)', usdaZone: '6a-7a', grassSeason: 'cool', lat: 44.06, lon: -121.31 },

  // Pennsylvania
  { id: 'PA-all', state: 'Pennsylvania', region: 'Statewide', usdaZone: '5b-7a', grassSeason: 'cool', lat: 40.27, lon: -76.88 },

  // Rhode Island
  { id: 'RI-all', state: 'Rhode Island', region: 'Statewide', usdaZone: '6b-7a', grassSeason: 'cool', lat: 41.82, lon: -71.41 },

  // South Carolina
  { id: 'SC-upstate', state: 'South Carolina', region: 'Upstate (Greenville, Spartanburg)', usdaZone: '7b-8a', grassSeason: 'transition', lat: 34.85, lon: -82.39 },
  { id: 'SC-lowcountry', state: 'South Carolina', region: 'Lowcountry / Coastal (Charleston)', usdaZone: '8b-9a', grassSeason: 'warm', lat: 32.78, lon: -79.93 },

  // South Dakota
  { id: 'SD-all', state: 'South Dakota', region: 'Statewide', usdaZone: '4a-5a', grassSeason: 'cool', lat: 44.37, lon: -100.34 },

  // Tennessee
  { id: 'TN-east', state: 'Tennessee', region: 'East (Knoxville, Chattanooga)', usdaZone: '7a', grassSeason: 'transition', lat: 35.96, lon: -83.92 },
  { id: 'TN-middle', state: 'Tennessee', region: 'Middle (Nashville)', usdaZone: '7a-7b', grassSeason: 'transition', lat: 36.16, lon: -86.78 },
  { id: 'TN-west', state: 'Tennessee', region: 'West (Memphis)', usdaZone: '7b-8a', grassSeason: 'transition', lat: 35.15, lon: -90.05 },

  // Texas
  { id: 'TX-north', state: 'Texas', region: 'North (Dallas, Fort Worth)', usdaZone: '8a', grassSeason: 'warm', lat: 32.78, lon: -96.80 },
  { id: 'TX-central', state: 'Texas', region: 'Central / Hill Country (Austin, San Antonio)', usdaZone: '8b', grassSeason: 'warm', lat: 30.27, lon: -97.74 },
  { id: 'TX-east', state: 'Texas', region: 'East (Houston, Tyler)', usdaZone: '9a', grassSeason: 'warm', lat: 29.76, lon: -95.37 },
  { id: 'TX-coastal', state: 'Texas', region: 'Gulf Coast', usdaZone: '9b', grassSeason: 'warm', lat: 27.80, lon: -97.40 },

  // Utah
  { id: 'UT-all', state: 'Utah', region: 'Statewide', usdaZone: '5a-7a', grassSeason: 'cool', lat: 40.76, lon: -111.89 },

  // Vermont
  { id: 'VT-all', state: 'Vermont', region: 'Statewide', usdaZone: '4a-5b', grassSeason: 'cool', lat: 44.26, lon: -72.57 },

  // Virginia
  { id: 'VA-northern', state: 'Virginia', region: 'Northern / DC Metro', usdaZone: '7a', grassSeason: 'cool', lat: 38.91, lon: -77.04 },
  { id: 'VA-central', state: 'Virginia', region: 'Central / Tidewater (Richmond, Norfolk)', usdaZone: '7b-8a', grassSeason: 'transition', lat: 37.54, lon: -77.43 },

  // Washington
  { id: 'WA-west', state: 'Washington', region: 'West (Seattle, Tacoma)', usdaZone: '8a-9a', grassSeason: 'cool', lat: 47.61, lon: -122.33 },
  { id: 'WA-east', state: 'Washington', region: 'East (Spokane, Tri-Cities)', usdaZone: '6a-7a', grassSeason: 'cool', lat: 47.66, lon: -117.43 },

  // West Virginia
  { id: 'WV-all', state: 'West Virginia', region: 'Statewide', usdaZone: '5b-7a', grassSeason: 'cool', lat: 38.35, lon: -81.63 },

  // Wisconsin
  { id: 'WI-all', state: 'Wisconsin', region: 'Statewide', usdaZone: '3b-5b', grassSeason: 'cool', lat: 43.07, lon: -89.40 },

  // Wyoming
  { id: 'WY-all', state: 'Wyoming', region: 'Statewide', usdaZone: '3a-5b', grassSeason: 'cool', lat: 41.14, lon: -104.82 },

  // ===== Canada (cool-season throughout; Plant Hardiness Canada zones, roughly equivalent to USDA - 0.5) =====

  // British Columbia
  { id: 'BC-coast', state: 'British Columbia', region: 'Coast (Vancouver, Victoria)', usdaZone: '8a-9a', grassSeason: 'cool', lat: 49.28, lon: -123.12 },
  { id: 'BC-interior', state: 'British Columbia', region: 'Interior / Okanagan (Kelowna)', usdaZone: '5b-7a', grassSeason: 'cool', lat: 49.89, lon: -119.50 },
  { id: 'BC-north', state: 'British Columbia', region: 'North (Prince George)', usdaZone: '3a-4a', grassSeason: 'cool', lat: 53.92, lon: -122.75 },

  // Alberta
  { id: 'AB-south', state: 'Alberta', region: 'South (Calgary)', usdaZone: '3b-4a', grassSeason: 'cool', lat: 51.05, lon: -114.07 },
  { id: 'AB-north', state: 'Alberta', region: 'North (Edmonton)', usdaZone: '3a-3b', grassSeason: 'cool', lat: 53.55, lon: -113.49 },

  // Saskatchewan
  { id: 'SK-all', state: 'Saskatchewan', region: 'Statewide', usdaZone: '2b-4a', grassSeason: 'cool', lat: 50.45, lon: -104.62 },

  // Manitoba
  { id: 'MB-all', state: 'Manitoba', region: 'Statewide', usdaZone: '2b-3b', grassSeason: 'cool', lat: 49.90, lon: -97.14 },

  // Ontario
  { id: 'ON-south', state: 'Ontario', region: 'South (Toronto, Niagara, Ottawa)', usdaZone: '5b-7a', grassSeason: 'cool', lat: 43.65, lon: -79.38 },
  { id: 'ON-north', state: 'Ontario', region: 'North (Sudbury, Thunder Bay)', usdaZone: '3a-5a', grassSeason: 'cool', lat: 46.49, lon: -80.99 },

  // Quebec
  { id: 'QC-south', state: 'Quebec', region: 'South (Montreal)', usdaZone: '4b-5b', grassSeason: 'cool', lat: 45.50, lon: -73.57 },
  { id: 'QC-north', state: 'Quebec', region: 'North (Quebec City, Saguenay)', usdaZone: '3b-5a', grassSeason: 'cool', lat: 46.81, lon: -71.21 },

  // New Brunswick
  { id: 'NB-all', state: 'New Brunswick', region: 'Statewide', usdaZone: '4a-5b', grassSeason: 'cool', lat: 45.96, lon: -66.65 },

  // Nova Scotia
  { id: 'NS-all', state: 'Nova Scotia', region: 'Statewide', usdaZone: '5a-6b', grassSeason: 'cool', lat: 44.65, lon: -63.58 },

  // Prince Edward Island
  { id: 'PE-all', state: 'Prince Edward Island', region: 'Statewide', usdaZone: '5a-5b', grassSeason: 'cool', lat: 46.24, lon: -63.13 },

  // Newfoundland and Labrador
  { id: 'NL-all', state: 'Newfoundland and Labrador', region: 'Statewide', usdaZone: '3a-6a', grassSeason: 'cool', lat: 47.56, lon: -52.71 },
];

export function getZone(id: string): ClimateZone | undefined {
  return CLIMATE_ZONES.find((z) => z.id === id);
}

// Group by state/province for the picker UI.
export function zonesByState(): { state: string; zones: ClimateZone[] }[] {
  const map = new Map<string, ClimateZone[]>();
  for (const z of CLIMATE_ZONES) {
    if (!map.has(z.state)) map.set(z.state, []);
    map.get(z.state)!.push(z);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([state, zones]) => ({ state, zones }));
}
