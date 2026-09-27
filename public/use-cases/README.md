# Use-case PDFs for /solutions

Drop the real documents here with these exact names. The cards on
`solutions.html` find them automatically: the placeholder cover is replaced,
and **View Use Case** / **Download PDF** switch on. No markup change is needed.

| File | Used by |
|---|---|
| `insurance.pdf` | Insurance section + library |
| `crop-insurance.pdf` | Library ("Flood Risk & Agricultural Insurance") |
| `banking.pdf` | Banking section + library |
| `agriculture.pdf` | Agriculture section |
| `infrastructure.pdf` | Infrastructure section + library |
| `government.pdf` | Government & Disaster Management section |

Optional: a first-page image with the same name and `.jpg`
(e.g. `insurance.jpg`, about 600 × 850 px). If present it is used as the
preview; otherwise the card shows the PDF's own first page.

To add a new document, copy one `<article class="card doc" data-pdf=…>`
block in `solutions.html` and point `data-pdf` / `data-preview` at the new
file.

Everything in `public/` is copied as-is into the build, so these files are
served at `/use-cases/<name>` in production.
