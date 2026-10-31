/** Business contact details used across the public site. One place to change them. */
export const DISPATCH_PHONE = { display: "024 351 8749", tel: "+233243518749" };
export const OFFICE_PHONE = { display: "024 927 6713", tel: "+233249276713" };
export const MAPS_URL = "https://www.google.com/maps/search/?api=1&query=George+Walker+Bush+Motorway+N1+Highway+Accra";
export const WA_GREETING = "Hello RINAMAS dispatch, I'm looking to hire a machine.";

/** WhatsApp dispatch number, international digits only. Server-side: reads WHATSAPP_NUMBER. */
export const whatsappNumber = () => process.env.WHATSAPP_NUMBER ?? "233243518749";
