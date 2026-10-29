/** The kinds of machine RINAMAS hires, shown near the top of the landing page so visitors see the range at once. */
const TYPES: { label: string; icon: string; filter?: string }[] = [
  { label: "Excavators", icon: "excavator", filter: "earth" },
  { label: "Bulldozers", icon: "dozer", filter: "earth" },
  { label: "Pile drivers", icon: "piling", filter: "earth" },
  { label: "Backhoes", icon: "backhoe", filter: "earth" },
  { label: "Loaders", icon: "loader", filter: "lift" },
  { label: "Tipper trucks", icon: "tipper", filter: "haul" },
  { label: "Low beds", icon: "lowbed", filter: "haul" },
  { label: "Telehandlers", icon: "telehandler", filter: "lift" },
  { label: "Graders", icon: "grader", filter: "road" },
  { label: "Rollers", icon: "roller", filter: "road" },
  { label: "Cranes", icon: "crane", filter: "lift" },
  { label: "Water tankers", icon: "tanker", filter: "haul" },
];

const ICONS: Record<string, React.ReactNode> = {
  excavator: <><rect x="6" y="24" width="24" height="6" rx="3" /><path d="M9 24V17h14l3 7z" /><path d="M20 18L34 8l3 3-12 12z" /><path d="M34 8l3 3 4 11-3 2z" /><path d="M38 24l3-2 5 4-2 4-6-1z" /></>,
  dozer: <><rect x="12" y="24" width="24" height="6" rx="3" /><path d="M15 24v-8h16l4 8z" /><path d="M15 17H5v13h4V21h6z" /><rect x="22" y="10" width="7" height="6" /></>,
  piling: <><rect x="8" y="24" width="22" height="6" rx="3" /><path d="M11 24v-7h12l3 7z" /><rect x="30" y="2" width="5" height="30" /><rect x="27" y="6" width="11" height="5" /><path d="M17 17L31 6l1 3-12 9z" /></>,
  backhoe: <><circle cx="12" cy="27" r="4" /><circle cx="31" cy="27" r="3.5" /><rect x="13" y="16" width="19" height="8" /><rect x="18" y="10" width="9" height="6" /><path d="M13 20l-9-2-1 4 5 5-5 0 1-3z" /><path d="M32 17l10-7 2 2-9 7z" /><path d="M42 10l2 2 3 10-3 2z" /></>,
  loader: <><circle cx="17" cy="27" r="4" /><circle cx="34" cy="27" r="4" /><rect x="19" y="14" width="19" height="9" /><rect x="27" y="7" width="9" height="7" /><path d="M19 18l-11-3-5 3v8l8 1 1-4 7 1z" /></>,
  tipper: <><circle cx="11" cy="27" r="3.5" /><circle cx="30" cy="27" r="3.5" /><circle cx="38" cy="27" r="3.5" /><path d="M5 23v-9h8l3 4v5z" /><path d="M17 23l2-10h26l-2 10z" /><rect x="5" y="23" width="38" height="2" /></>,
  lowbed: <><path d="M3 22h8v-7h6l3 3v4h3" fill="none" stroke="currentColor" strokeWidth="2.5" /><path d="M23 22l3 4h17l4-4" fill="none" stroke="currentColor" strokeWidth="2.5" /><circle cx="8" cy="26" r="3" /><circle cx="17" cy="26" r="3" /><circle cx="33" cy="29" r="2.5" /><circle cx="40" cy="29" r="2.5" /><path d="M26 24v-5h11l3 3v2z" /></>,
  telehandler: <><circle cx="13" cy="27" r="4" /><circle cx="33" cy="27" r="4" /><rect x="10" y="15" width="26" height="8" /><rect x="12" y="9" width="8" height="6" /><path d="M24 17L44 4l2 3-18 13z" /><path d="M44 4l2 3-1 5-4-2z" /></>,
  grader: <><circle cx="9" cy="27" r="3.5" /><circle cx="33" cy="27" r="3.5" /><circle cx="41" cy="27" r="3.5" /><path d="M8 22l22-3v-5h14v8z" /><rect x="30" y="8" width="10" height="6" /><path d="M9 22l21-3" stroke="currentColor" strokeWidth="2" /><path d="M15 23l11 2-1 4-11-2z" /></>,
  roller: <><circle cx="15" cy="24" r="8" /><circle cx="15" cy="24" r="3.5" fill="var(--steel)" /><circle cx="36" cy="26" r="5" /><path d="M23 23l4-7h14v8H23z" /><rect x="28" y="10" width="8" height="6" /></>,
  crane: <><circle cx="12" cy="28" r="3.5" /><circle cx="22" cy="28" r="3.5" /><circle cx="36" cy="28" r="3.5" /><rect x="6" y="20" width="36" height="5" /><rect x="14" y="15" width="12" height="5" /><path d="M20 17L44 3l2 3-24 15z" /><path d="M45 5v9" stroke="currentColor" strokeWidth="2" /><path d="M42 14h6l-3 4z" /></>,
  tanker: <><circle cx="11" cy="27" r="3.5" /><circle cx="32" cy="27" r="3.5" /><circle cx="40" cy="27" r="3.5" /><path d="M5 23v-9h8l3 4v5z" /><rect x="17" y="12" width="28" height="11" rx="5.5" /><rect x="5" y="23" width="40" height="2" /></>,
};

export function MachineTypes({ classes }: { classes: number }) {
  return (
    <section className="types" aria-label="Machines we hire">
      <div className="wrap">
        <div className="types-head">
          <p className="eyebrow">What we hire</p>
          <span className="types-count">{classes} machine classes on the yard · more on request</span>
        </div>
        <ul className="types-row">
          {TYPES.map((t) => (
            <li key={t.icon}>
              <a href="#fleet" data-filter={t.filter}>
                <svg viewBox="0 0 48 32" aria-hidden="true" fill="currentColor">{ICONS[t.icon]}</svg>
                <span>{t.label}</span>
              </a>
            </li>
          ))}
          <li className="types-more"><a href="#quote"><span>Something else?<br /><b>Ask dispatch</b></span></a></li>
        </ul>
      </div>
    </section>
  );
}
