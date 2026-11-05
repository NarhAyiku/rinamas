/** Business contact details used across the public site. One place to change them. */
export const DISPATCH_PHONE = { display: "024 351 8749", tel: "+233243518749" };
export const OFFICE_PHONE = { display: "024 927 6713", tel: "+233249276713" };
export const MAPS_URL = "https://www.google.com/maps/search/?api=1&query=George+Walker+Bush+Motorway+N1+Highway+Accra";
export const WA_GREETING = "Hello RINAMAS dispatch, I'm looking to hire a machine.";

/** WhatsApp dispatch number, international digits only. Server-side: reads WHATSAPP_NUMBER. */
export const whatsappNumber = () => process.env.WHATSAPP_NUMBER ?? "233243518749";

/** The business as it should read everywhere (site, Google, Facebook, Instagram, WhatsApp). Keep these identical across profiles. */
export const BUSINESS_NAME = "RINAMAS Equipment and Trading Enterprise";
export const CEO = "Narh Richard Mashie";
export const ADDRESS = { street: "Off N1 Highway, George Walker Bush Motorway", locality: "Accra", region: "Greater Accra", country: "GH" };
export const HOURS = { label: "Mon to Sat, 08:00 to 18:00 GMT", days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"], opens: "08:00", closes: "18:00" };
/** Yard pin for maps and structured data. null until the owner supplies the Google Maps pin. */
export const YARD_GEO: { lat: number; lng: number } | null = null;
/** Public profiles, listed as sameAs in structured data. Empty until they exist. */
export const SOCIAL: { google: string; facebook: string; instagram: string } = { google: "", facebook: "", instagram: "" };
