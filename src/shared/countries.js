export const COUNTRIES = [
  "Kazakhstan",
  "Russia",
  "Ukraine",
  "Belarus",
  "Uzbekistan",
  "Kyrgyzstan",
  "Georgia",
  "Armenia",
  "Azerbaijan",
  "Turkey",
  "Poland",
  "Germany",
  "France",
  "United Kingdom",
  "Netherlands",
  "Italy",
  "Spain",
  "United States",
  "Canada",
  "Brazil",
  "India",
  "China",
  "Japan",
  "South Korea",
  "Australia",
];

export function isSupportedCountry(country) {
  return COUNTRIES.includes(country);
}
