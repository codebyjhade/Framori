# Framori privacy notes

Framori is designed to process photo and frame files locally in your browser.

- There is no Framori account, database, analytics service, or photo-upload endpoint.
- Selected photos and frames are held in browser memory for the current tab and are not intentionally transmitted by the application.
- Closing or refreshing the tab clears the working session. Files you explicitly download remain on your device.
- The application loads JSZip from cdnjs so it can create ZIP downloads. As with any external web resource, that provider may receive ordinary request information such as your IP address and browser headers. Your selected photos are not part of that request.
- A host such as GitHub Pages may keep standard access logs under its own privacy terms.

You can inspect the complete source code in this repository. If you publish a modified version with analytics, storage, or uploads, update this notice and the privacy claims in the interface.
