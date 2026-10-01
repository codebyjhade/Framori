# Framori

**Brand every photo in one go.** Framori is a free, no-signup batch photo framing tool for school organizations, events, communities, and creative teams. It matches portrait and landscape photos with the correct transparent PNG artwork, lets you adjust each crop, and exports the finished set in one ZIP.

Built and designed by **Bryan Jhade Ebuan**.

## Why Framori

- Process up to 100 photos in one focused workflow
- Use separate portrait and landscape frame artwork
- Review, select, sort, rotate, zoom, and reposition photos
- Export JPG or PNG at the photo, frame, or social-ready resolution
- Choose readable filenames and download one ZIP
- Keep photo processing in the browser with no account or application backend
- Use it comfortably on desktop, tablet, and mobile layouts

## Use it

Open `index.html` directly in a modern browser, or serve the folder with any static web server. An internet connection is required to load JSZip from cdnjs before ZIP export can work.

1. Add a transparent PNG frame for one or both orientations.
2. Add JPG or PNG photos.
3. Review the automatic matches and adjust any crop.
4. Choose the export settings and download the ZIP.

## Development

The project intentionally has no framework, build dependency, account system, or server. Node.js is only used for release checks and assembling the deployment folder.

```text
npm run check
npm run build
```

`npm run check` validates the JavaScript, HTML IDs, brand references, and required release files. `npm run build` creates a clean `dist/` folder for static hosting.

## Publish for free

The included GitHub Actions workflow deploys the project to GitHub Pages after a push to `main`.

1. Push the repository to GitHub.
2. Open **Settings → Pages** in the repository.
3. Under **Build and deployment**, select **GitHub Actions** as the source.
4. Run the **Deploy Framori to GitHub Pages** workflow, or push to `main`.

The expected project URL is `https://codebyjhade.github.io/Framori/`.

## Privacy

Photos and frames are processed in browser memory and are not intentionally uploaded by Framori. The app fetches JSZip from cdnjs, and the hosting provider may keep normal access logs. Read [PRIVACY.md](PRIVACY.md) for the exact privacy boundaries.

## Browser support

Use a current version of Chrome, Edge, Firefox, or Safari. Framori relies on Canvas, object URLs, `createImageBitmap`/image decoding, and the native dialog element.

## Contributing and license

Contributions are welcome; see [CONTRIBUTING.md](CONTRIBUTING.md). Framori is available under the [MIT License](LICENSE).
