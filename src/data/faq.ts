/** The customer FAQ. Rendered on the landing page, published as FAQPage structured data, and given to the chat assistant. */
export type Faq = { q: string; a: string };

export const faqItems = ({ dayHours }: { dayHours: number }): Faq[] => [
  { q: "Can I buy my own diesel?", a: "Yes, you choose on the quote form. Hire with fuel and RINAMAS delivers diesel to site and bills it on the metered hours. Hire without fuel and the machine arrives with a full tank; you fuel it on site and send it back full." },
  { q: "Can I use my own operator?", a: "Yes. Hire the machine only and bring an operator with a valid Ghanaian heavy-duty licence; we go through the pre-start checklist together on site. For excavators above 20T and cranes, we suggest adding our operator." },
  { q: "How do I pay?", a: "By MTN MoMo, bank transfer, or cheque for registered companies. A deposit holds your machine and date; your quote shows the amount. The balance is settled each week against the hour log your site agent signs." },
  { q: "What counts as a day?", a: `One shift of ${dayHours} hours on the machine's meter. Planning longer days, or expecting pauses for rain or site work? Tell us when you ask and your quote will show exactly how those hours are priced.` },
  { q: "Why does distance change the price?", a: "Tracked machines reach your site on our low bed, which is priced by zone from our Accra yard: a job in Tema or Kasoa costs less to deliver than one in Ada or Koforidua. The machine's day rate is the same everywhere. Your quote shows transport as its own line, so you always see what it costs." },
  { q: "What if the machine breaks down?", a: "Minor faults are fixed on site by our mechanic. If a unit is down for more than 24 hours we send a replacement from the yard, and you are not charged for the down time." },
  { q: "Do you hire for mining?", a: "Yes, for licensed operations with Minerals Commission papers; share them with your request and we'll get moving. We don't supply galamsey or any unlicensed mining." },
];
