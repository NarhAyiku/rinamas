# RINAMAS banner and machine stickers

Print-ready files. Send the PDFs to the printer; the PNGs are previews for WhatsApp.

| File | Use | Final size |
|---|---|---|
| `rinamas-banner-3000x1000mm.pdf` | Yard / roadside banner | 3000 × 1000 mm (about 10 × 3.3 ft) |
| `rinamas-sticker-600x200mm.pdf` | Machine side, boom, tipper body | 600 × 200 mm, plus 3 mm bleed on every side |
| `rinamas-sticker-300x300mm.pdf` | Cab doors, small machines | 300 × 300 mm, plus 3 mm bleed on every side |

All three are vector PDFs with the fonts embedded and no photos, so they stay sharp at any size.

## Tell the printer

**Stickers (this is what stops them fading):**
- Print on **cast outdoor vinyl** (for example 3M IJ180 or Avery MPI 1105), not cheap calendered vinyl.
- Ask for a **UV protective laminate** on top (matte or gloss). Unlaminated stickers fade in the Ghana sun within a year; laminated cast vinyl lasts several years.
- Eco-solvent or UV inks.
- Cut to the trim size (600 × 200 or 300 × 300). The 3 mm bleed is already in the file.

**Banner:**
- Outdoor PVC flex banner, 440 gsm or heavier, eco-solvent or UV inks.
- Hemmed edges with metal eyelets about every 50 cm.
- Print at 3000 × 1000 mm. Everything important sits well inside the edges, so the hem and eyelets do not cut into it.

**Colours:** yellow `#FFCD11` (close to Pantone 116 C), dark `#1A1C1F`.

## Applying the stickers

- Clean the panel with soapy water, then wipe with spirit so there is no oil or diesel film. Let it dry.
- Flat or gently curved panels only; keep away from the exhaust and engine heat.
- A suggested set per machine: one wide sticker on each side, one square sticker on the cab door.

## The QR codes

The QR codes open rinamas.com. They are tagged (`utm_source=banner` and `utm_source=sticker`), so the site's visitor stats show how many people came from the banner and how many from the machines.

## Changing the designs

Edit `src/designs.html` (all sizes in millimetres), then run `node print/src/render.mjs` to make new PDFs and previews. Phone numbers and the address match `src/lib/contact.ts`; if those change, update both.
