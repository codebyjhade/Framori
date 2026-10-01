document.addEventListener('DOMContentLoaded', () => {
    'use strict';

    const MAX_PHOTOS = 100;
    const MAX_PHOTO_BYTES = 50 * 1024 * 1024;
    const MAX_TEMPLATE_BYTES = 25 * 1024 * 1024;
    const MAX_OUTPUT_DIMENSION = 8192;
    const MAX_OUTPUT_PIXELS = 32_000_000;
    const PREVIEW_WIDTH = 360;

    const templateDropZone = document.getElementById('template-drop-zone');
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const templateInput = document.getElementById('template-input');
    const templateStatus = document.getElementById('template-status');
    const outputCanvas = document.getElementById('canvas');
    const generateBtn = document.getElementById('generate-btn');
    const resetBtn = document.getElementById('reset-btn');
    const statusArea = document.getElementById('status-area');
    const previewGallery = document.getElementById('preview-gallery');
    const progressBar = document.getElementById('progress-bar');
    const galleryTitle = document.getElementById('gallery-title');
    const previewContainer = document.querySelector('.preview-container');
    const workspaceSteps = Array.from(document.querySelectorAll('[data-workspace-step]'));

    const selectAllPhotos = document.getElementById('select-all-photos');
    const selectionCount = document.getElementById('selection-count');
    const photoSort = document.getElementById('photo-sort');
    const resetSelectedBtn = document.getElementById('reset-selected');
    const removeSelectedBtn = document.getElementById('remove-selected');

    const exportFormat = document.getElementById('export-format');
    const exportResolution = document.getElementById('export-resolution');
    const namingPattern = document.getElementById('naming-pattern');
    const zipName = document.getElementById('zip-name');
    const exportQuality = document.getElementById('export-quality');
    const qualityValue = document.getElementById('quality-value');
    const qualityField = document.querySelector('.quality-field');

    const photoEditor = document.getElementById('photo-editor');
    const editorCanvas = document.getElementById('editor-canvas');
    const editorFileName = document.getElementById('editor-file-name');
    const closeEditorBtn = document.getElementById('close-editor');
    const applyEditBtn = document.getElementById('apply-edit');
    const cropZoom = document.getElementById('crop-zoom');
    const zoomValue = document.getElementById('zoom-value');
    const rotateLeftBtn = document.getElementById('rotate-left');
    const rotateRightBtn = document.getElementById('rotate-right');
    const resetEditBtn = document.getElementById('reset-edit');
    const fitModeButtons = Array.from(document.querySelectorAll('[data-fit-mode]'));

    const uploadedFiles = [];
    const templates = { landscape: null, portrait: null };
    let requestedTemplateOrientation = null;
    let isBusy = false;
    let nextPhotoId = 1;
    let editorItem = null;
    let editorDraft = null;
    let dragState = null;

    function defaultEdit() {
        return { zoom: 1, offsetX: 0, offsetY: 0, rotation: 0, fitMode: 'cover' };
    }

    function cloneEdit(edit) {
        return { ...edit };
    }

    function setStatus(message, type = '') {
        statusArea.textContent = message;
        statusArea.classList.toggle('is-error', type === 'error');
        statusArea.classList.toggle('is-warning', type === 'warning');
    }

    function setTemplateStatus(message, type = '') {
        templateStatus.textContent = message;
        templateStatus.classList.toggle('is-error', type === 'error');
        templateStatus.classList.toggle('is-warning', type === 'warning');
    }

    function updateWorkspaceSteps(activeOverride = null) {
        let activeStep = 0;
        if (templates.landscape || templates.portrait) activeStep = 1;
        if (uploadedFiles.length > 0) activeStep = 2;
        if (activeOverride !== null) activeStep = activeOverride;

        workspaceSteps.forEach((step, index) => {
            step.classList.toggle('is-active', index === activeStep);
            step.classList.toggle('is-complete', index < activeStep);
        });
    }

    function formatDimensions(width, height) {
        return `${width.toLocaleString()} × ${height.toLocaleString()} px`;
    }

    function orientationForImage(img) {
        return img.naturalWidth >= img.naturalHeight ? 'landscape' : 'portrait';
    }

    function isPng(file) {
        return file.type === 'image/png' || file.name.toLowerCase().endsWith('.png');
    }

    function isSupportedPhoto(file) {
        const name = file.name.toLowerCase();
        return file.type === 'image/jpeg' || file.type === 'image/png' || /\.(jpe?g|png)$/.test(name);
    }

    function loadImageFile(file) {
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(file);
            const img = new Image();
            img.onload = () => {
                if (!img.naturalWidth || !img.naturalHeight) {
                    URL.revokeObjectURL(url);
                    reject(new Error('The image has invalid dimensions.'));
                    return;
                }
                resolve({ img, url });
            };
            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error('The image could not be decoded.'));
            };
            img.src = url;
        });
    }

    function hasTransparency(img) {
        const maxCheckDimension = 1024;
        const scale = Math.min(1, maxCheckDimension / Math.max(img.naturalWidth, img.naturalHeight));
        const width = Math.max(1, Math.round(img.naturalWidth * scale));
        const height = Math.max(1, Math.round(img.naturalHeight * scale));
        const checkCanvas = document.createElement('canvas');
        checkCanvas.width = width;
        checkCanvas.height = height;
        const checkCtx = checkCanvas.getContext('2d', { willReadFrequently: true });
        checkCtx.clearRect(0, 0, width, height);
        checkCtx.drawImage(img, 0, 0, width, height);
        const pixels = checkCtx.getImageData(0, 0, width, height).data;

        for (let index = 3; index < pixels.length; index += 4) {
            if (pixels[index] < 250) {
                checkCanvas.width = 1;
                checkCanvas.height = 1;
                return true;
            }
        }

        checkCanvas.width = 1;
        checkCanvas.height = 1;
        return false;
    }

    function setTemplate(orientation, template) {
        const existing = templates[orientation];
        if (existing) URL.revokeObjectURL(existing.url);
        templates[orientation] = template;
    }

    function updateTemplateCard(orientation) {
        const template = templates[orientation];
        const card = document.getElementById(`${orientation}-template-card`);
        const preview = document.getElementById(`${orientation}-template-preview`);
        const meta = document.getElementById(`${orientation}-template-meta`);
        const replaceButton = card.querySelector('[data-replace-template]');
        const removeButton = card.querySelector('[data-remove-template]');

        card.classList.toggle('is-empty', !template);
        removeButton.disabled = !template || isBusy;
        replaceButton.disabled = isBusy;
        replaceButton.textContent = template ? 'Replace' : 'Add';

        if (!template) {
            preview.removeAttribute('src');
            meta.textContent = 'Not added';
            return;
        }

        preview.src = template.url;
        preview.alt = `${orientation} frame: ${template.file.name}`;
        meta.textContent = `${template.file.name} · ${formatDimensions(template.img.naturalWidth, template.img.naturalHeight)}`;
    }

    function assignMatchingTemplates() {
        uploadedFiles.forEach(item => {
            item.template = templates[item.orientation];
        });
    }

    function updateTemplateUI(message = '') {
        updateTemplateCard('landscape');
        updateTemplateCard('portrait');
        const loadedOrientations = Object.keys(templates).filter(key => templates[key]);
        const hasTemplate = loadedOrientations.length > 0;
        dropZone.classList.toggle('locked', !hasTemplate || isBusy);
        dropZone.setAttribute('aria-disabled', String(!hasTemplate || isBusy));

        if (message) {
            setTemplateStatus(message);
        } else if (loadedOrientations.length === 2) {
            setTemplateStatus('Portrait and landscape frames are ready.');
        } else if (loadedOrientations.length === 1) {
            const label = loadedOrientations[0][0].toUpperCase() + loadedOrientations[0].slice(1);
            setTemplateStatus(`${label} frame ready. Add the other orientation when needed.`);
        } else {
            setTemplateStatus('Waiting for your frames.');
        }

        assignMatchingTemplates();
        updateWorkspaceSteps();
        renderGallery();
    }

    async function processTemplateFiles(fileList, expectedOrientation = null) {
        if (isBusy) return;
        const files = Array.from(fileList);
        const validFiles = files.filter(isPng);
        const notes = [];

        if (validFiles.length === 0) {
            setTemplateStatus('Please choose a transparent PNG frame.', 'error');
            templateInput.value = '';
            requestedTemplateOrientation = null;
            return;
        }

        setTemplateStatus('Checking frame files...');
        setBusyState(true);

        for (const file of validFiles) {
            if (file.size > MAX_TEMPLATE_BYTES) {
                notes.push(`${file.name} was skipped because it is larger than 25 MB.`);
                continue;
            }

            try {
                const loaded = await loadImageFile(file);
                const orientation = orientationForImage(loaded.img);
                if (expectedOrientation && orientation !== expectedOrientation) {
                    URL.revokeObjectURL(loaded.url);
                    notes.push(`${file.name} is ${orientation}; choose a ${expectedOrientation} frame instead.`);
                    continue;
                }
                if (!hasTransparency(loaded.img)) {
                    URL.revokeObjectURL(loaded.url);
                    notes.push(`${file.name} was skipped because no transparent area was detected.`);
                    continue;
                }

                const wasReplacement = Boolean(templates[orientation]);
                setTemplate(orientation, { file, img: loaded.img, url: loaded.url });
                notes.push(`${orientation[0].toUpperCase() + orientation.slice(1)} frame ${wasReplacement ? 'replaced' : 'added'}: ${file.name}.`);
                if (expectedOrientation) break;
            } catch (error) {
                notes.push(`${file.name} could not be loaded.`);
            }
        }

        setBusyState(false);
        templateInput.value = '';
        requestedTemplateOrientation = null;
        updateTemplateUI(notes.join(' '));
    }

    function removeTemplate(orientation) {
        const template = templates[orientation];
        if (!template || isBusy) return;
        URL.revokeObjectURL(template.url);
        templates[orientation] = null;
        updateTemplateUI(`${orientation[0].toUpperCase() + orientation.slice(1)} frame removed.`);
    }

    async function handleFiles(fileList) {
        if (isBusy || (!templates.landscape && !templates.portrait)) {
            setStatus('Add at least one valid frame before adding photos.', 'warning');
            return;
        }

        const supported = Array.from(fileList).filter(isSupportedPhoto);
        const notes = [];
        if (supported.length === 0) {
            setStatus('No supported JPG or PNG photos were selected.', 'error');
            return;
        }

        const availableSlots = Math.max(0, MAX_PHOTOS - uploadedFiles.length);
        const files = supported.slice(0, availableSlots);
        if (supported.length > availableSlots) {
            notes.push(`${supported.length - availableSlots} photo(s) were not added because the current limit is ${MAX_PHOTOS}.`);
        }
        if (files.length === 0) {
            setStatus(`The ${MAX_PHOTOS}-photo limit has been reached.`, 'warning');
            return;
        }

        setStatus(`Loading ${files.length} photo(s)...`);
        setBusyState(true);

        for (const file of files) {
            if (file.size > MAX_PHOTO_BYTES) {
                notes.push(`${file.name} was skipped because it is larger than 50 MB.`);
                continue;
            }

            try {
                const loaded = await loadImageFile(file);
                const orientation = orientationForImage(loaded.img);
                const photoId = nextPhotoId++;
                uploadedFiles.push({
                    id: photoId,
                    addedIndex: photoId,
                    file,
                    img: loaded.img,
                    url: loaded.url,
                    orientation,
                    template: templates[orientation],
                    selected: false,
                    edit: defaultEdit()
                });
            } catch (error) {
                notes.push(`${file.name} could not be loaded.`);
            }
        }

        setBusyState(false);
        fileInput.value = '';
        renderGallery(notes.join(' '), notes.length ? 'warning' : '');
    }

    function getSortedItems() {
        const items = [...uploadedFiles];
        if (photoSort.value === 'name') {
            items.sort((a, b) => a.file.name.localeCompare(b.file.name, undefined, { numeric: true }));
        } else if (photoSort.value === 'orientation') {
            items.sort((a, b) => a.orientation.localeCompare(b.orientation) || a.addedIndex - b.addedIndex);
        } else {
            items.sort((a, b) => a.addedIndex - b.addedIndex);
        }
        return items;
    }

    function rotatedDimensions(img, rotation) {
        const normalized = ((rotation % 360) + 360) % 360;
        const swapsSides = normalized === 90 || normalized === 270;
        return swapsSides
            ? { width: img.naturalHeight, height: img.naturalWidth }
            : { width: img.naturalWidth, height: img.naturalHeight };
    }

    function clampEdit(item, edit, width, height) {
        const rotated = rotatedDimensions(item.img, edit.rotation);
        const baseScale = edit.fitMode === 'contain'
            ? Math.min(width / rotated.width, height / rotated.height)
            : Math.max(width / rotated.width, height / rotated.height);
        const scale = baseScale * edit.zoom;
        const maxX = Math.max(0, ((rotated.width * scale) - width) / 2) / width;
        const maxY = Math.max(0, ((rotated.height * scale) - height) / 2) / height;
        edit.offsetX = Math.max(-maxX, Math.min(maxX, edit.offsetX));
        edit.offsetY = Math.max(-maxY, Math.min(maxY, edit.offsetY));
        return { scale };
    }

    function drawComposite(item, targetCanvas, width, height, edit = item.edit, includeFrame = true) {
        targetCanvas.width = Math.max(1, Math.round(width));
        targetCanvas.height = Math.max(1, Math.round(height));
        const targetCtx = targetCanvas.getContext('2d');
        targetCtx.imageSmoothingEnabled = true;
        targetCtx.imageSmoothingQuality = 'high';
        targetCtx.fillStyle = '#ffffff';
        targetCtx.fillRect(0, 0, targetCanvas.width, targetCanvas.height);

        const transform = clampEdit(item, edit, targetCanvas.width, targetCanvas.height);
        targetCtx.save();
        targetCtx.translate(
            (targetCanvas.width / 2) + (edit.offsetX * targetCanvas.width),
            (targetCanvas.height / 2) + (edit.offsetY * targetCanvas.height)
        );
        targetCtx.rotate((edit.rotation * Math.PI) / 180);
        targetCtx.drawImage(
            item.img,
            -(item.img.naturalWidth * transform.scale) / 2,
            -(item.img.naturalHeight * transform.scale) / 2,
            item.img.naturalWidth * transform.scale,
            item.img.naturalHeight * transform.scale
        );
        targetCtx.restore();

        if (includeFrame && item.template) {
            targetCtx.drawImage(item.template.img, 0, 0, targetCanvas.width, targetCanvas.height);
        }
    }

    function updateSelectionControls() {
        const selectedCount = uploadedFiles.filter(item => item.selected).length;
        selectionCount.textContent = `${selectedCount} selected`;
        selectAllPhotos.checked = uploadedFiles.length > 0 && selectedCount === uploadedFiles.length;
        selectAllPhotos.indeterminate = selectedCount > 0 && selectedCount < uploadedFiles.length;
        resetSelectedBtn.disabled = isBusy || selectedCount === 0;
        removeSelectedBtn.disabled = isBusy || selectedCount === 0;
    }

    function createPhotoAction(label, iconPath, action) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'photo-action';
        button.setAttribute('aria-label', label);
        button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${iconPath}</svg>`;
        button.addEventListener('click', action);
        return button;
    }

    function renderGallery(extraMessage = '', extraType = '') {
        previewGallery.replaceChildren();

        if (uploadedFiles.length === 0) {
            galleryTitle.hidden = true;
            previewContainer.hidden = true;
            generateBtn.disabled = true;
            resetBtn.disabled = true;
            if (extraMessage) setStatus(extraMessage, extraType);
            updateSelectionControls();
            updateWorkspaceSteps();
            return;
        }

        galleryTitle.hidden = false;
        previewContainer.hidden = false;
        resetBtn.disabled = isBusy;
        let missingTemplateCount = 0;

        getSortedItems().forEach(item => {
            const container = document.createElement('figure');
            container.className = 'preview-item';
            container.classList.toggle('is-selected', item.selected);
            const ratio = item.template
                ? item.template.img.naturalWidth / item.template.img.naturalHeight
                : item.img.naturalWidth / item.img.naturalHeight;
            container.style.aspectRatio = String(ratio);

            const previewCanvas = document.createElement('canvas');
            previewCanvas.setAttribute('role', 'img');
            previewCanvas.setAttribute('aria-label', `Preview of ${item.file.name}`);
            const previewHeight = Math.max(1, Math.round(PREVIEW_WIDTH / ratio));
            drawComposite(item, previewCanvas, PREVIEW_WIDTH, previewHeight, item.edit, Boolean(item.template));
            container.appendChild(previewCanvas);

            const selectLabel = document.createElement('label');
            selectLabel.className = 'photo-select';
            selectLabel.title = `Select ${item.file.name}`;
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = item.selected;
            checkbox.setAttribute('aria-label', `Select ${item.file.name}`);
            checkbox.addEventListener('change', () => {
                item.selected = checkbox.checked;
                container.classList.toggle('is-selected', item.selected);
                updateSelectionControls();
            });
            selectLabel.appendChild(checkbox);
            container.appendChild(selectLabel);

            if (!item.template) {
                missingTemplateCount += 1;
                container.classList.add('is-missing-template');
                const warning = document.createElement('div');
                warning.className = 'preview-warning';
                warning.textContent = `Needs a ${item.orientation} frame`;
                container.appendChild(warning);
            }

            const badge = document.createElement('div');
            badge.className = 'orientation-badge';
            badge.textContent = item.orientation[0].toUpperCase() + item.orientation.slice(1);
            container.appendChild(badge);

            const footer = document.createElement('figcaption');
            footer.className = 'photo-card-footer';
            const name = document.createElement('span');
            name.className = 'photo-card-name';
            name.textContent = item.file.name;
            name.title = item.file.name;
            const actions = document.createElement('div');
            actions.className = 'photo-card-actions';
            actions.appendChild(createPhotoAction(
                `Edit ${item.file.name}`,
                '<path d="m4 16-.8 4.8L8 20l11-11-4-4L4 16Z"/><path d="m13 7 4 4"/>',
                () => openEditor(item)
            ));
            actions.appendChild(createPhotoAction(
                `Remove ${item.file.name}`,
                '<path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5"/>',
                () => removeItems([item.id])
            ));
            footer.append(name, actions);
            container.appendChild(footer);
            previewGallery.appendChild(container);
        });

        generateBtn.disabled = isBusy || missingTemplateCount > 0;
        const summary = missingTemplateCount > 0
            ? `${uploadedFiles.length} photo(s) loaded. ${missingTemplateCount} need a matching frame before export.`
            : `${uploadedFiles.length} photo(s) matched and ready to review.`;
        setStatus(extraMessage ? `${summary} ${extraMessage}` : summary, missingTemplateCount ? 'warning' : extraType);
        updateSelectionControls();
        updateWorkspaceSteps();
    }

    function removeItems(ids) {
        if (isBusy) return;
        const idSet = new Set(ids);
        for (let index = uploadedFiles.length - 1; index >= 0; index -= 1) {
            if (idSet.has(uploadedFiles[index].id)) {
                URL.revokeObjectURL(uploadedFiles[index].url);
                uploadedFiles.splice(index, 1);
            }
        }
        renderGallery(`${ids.length} photo(s) removed.`);
    }

    function clearPhotos() {
        if (isBusy) return;
        uploadedFiles.forEach(item => URL.revokeObjectURL(item.url));
        uploadedFiles.length = 0;
        previewGallery.replaceChildren();
        galleryTitle.hidden = true;
        previewContainer.hidden = true;
        generateBtn.disabled = true;
        resetBtn.disabled = true;
        fileInput.value = '';
        progressBar.hidden = true;
        setStatus('Photos cleared. Your frames are still ready.');
        updateSelectionControls();
        updateWorkspaceSteps();
    }

    function editorDimensions(item) {
        const ratio = item.template
            ? item.template.img.naturalWidth / item.template.img.naturalHeight
            : item.img.naturalWidth / item.img.naturalHeight;
        const maxWidth = 720;
        const maxHeight = 520;
        if (ratio >= maxWidth / maxHeight) {
            return { width: maxWidth, height: Math.round(maxWidth / ratio) };
        }
        return { width: Math.round(maxHeight * ratio), height: maxHeight };
    }

    function syncEditorControls() {
        cropZoom.value = String(editorDraft.zoom);
        zoomValue.textContent = `${Math.round(editorDraft.zoom * 100)}%`;
        fitModeButtons.forEach(button => {
            button.classList.toggle('is-selected', button.dataset.fitMode === editorDraft.fitMode);
        });
    }

    function renderEditor() {
        if (!editorItem || !editorDraft) return;
        const size = editorDimensions(editorItem);
        drawComposite(editorItem, editorCanvas, size.width, size.height, editorDraft, Boolean(editorItem.template));
        syncEditorControls();
    }

    function openEditor(item) {
        if (isBusy || !item.template) return;
        editorItem = item;
        editorDraft = cloneEdit(item.edit);
        editorFileName.textContent = `${item.file.name} · ${formatDimensions(item.img.naturalWidth, item.img.naturalHeight)}`;
        renderEditor();
        photoEditor.showModal();
    }

    function closeEditor() {
        if (photoEditor.open) photoEditor.close();
        editorItem = null;
        editorDraft = null;
        dragState = null;
    }

    function constrainOutputSize(width, height) {
        const dimensionScale = Math.min(1, MAX_OUTPUT_DIMENSION / width, MAX_OUTPUT_DIMENSION / height);
        const pixelScale = Math.min(1, Math.sqrt(MAX_OUTPUT_PIXELS / (width * height)));
        const scale = Math.min(dimensionScale, pixelScale);
        return {
            width: Math.max(1, Math.floor(width * scale)),
            height: Math.max(1, Math.floor(height * scale))
        };
    }

    function photoLimitedSize(item) {
        const rotated = rotatedDimensions(item.img, item.edit.rotation);
        const targetRatio = item.template.img.naturalWidth / item.template.img.naturalHeight;
        const sourceRatio = rotated.width / rotated.height;
        let width;
        let height;
        if (sourceRatio > targetRatio) {
            height = rotated.height / item.edit.zoom;
            width = height * targetRatio;
        } else {
            width = rotated.width / item.edit.zoom;
            height = width / targetRatio;
        }
        return constrainOutputSize(width, height);
    }

    function outputSizeForItem(item) {
        if (exportResolution.value === 'frame') {
            return constrainOutputSize(item.template.img.naturalWidth, item.template.img.naturalHeight);
        }

        const photoSize = photoLimitedSize(item);
        if (exportResolution.value === 'social') {
            const ratio = item.template.img.naturalWidth / item.template.img.naturalHeight;
            let width = ratio >= 1 ? 2048 : 2048 * ratio;
            let height = ratio >= 1 ? 2048 / ratio : 2048;
            const noUpscale = Math.min(1, photoSize.width / width, photoSize.height / height);
            width *= noUpscale;
            height *= noUpscale;
            return constrainOutputSize(width, height);
        }
        return photoSize;
    }

    function canvasToBlob(mimeType, quality) {
        return new Promise((resolve, reject) => {
            outputCanvas.toBlob(blob => {
                if (blob) resolve(blob);
                else reject(new Error('The browser could not create the output image.'));
            }, mimeType, quality);
        });
    }

    function outputNameForItem(item, index, usedNames, extension) {
        const originalBase = item.file.name.replace(/\.[^.]+$/, '') || 'photo';
        const requestedBase = namingPattern.value === 'sequence'
            ? `framori_${String(index + 1).padStart(3, '0')}`
            : `${originalBase}_framed`;
        const safeBase = requestedBase.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_').slice(0, 100);
        let candidate = `${safeBase}.${extension}`;
        let suffix = 2;
        while (usedNames.has(candidate.toLowerCase())) {
            candidate = `${safeBase}_${suffix}.${extension}`;
            suffix += 1;
        }
        usedNames.add(candidate.toLowerCase());
        return candidate;
    }

    function safeZipName() {
        const cleanName = zipName.value
            .replace(/\.zip$/i, '')
            .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
            .trim()
            .replace(/[. ]+$/g, '')
            .slice(0, 80);
        return `${cleanName || 'framori-export'}.zip`;
    }

    function updateExportControls() {
        const isPngOutput = exportFormat.value === 'png';
        [exportFormat, exportResolution, namingPattern, zipName, photoSort].forEach(control => {
            control.disabled = isBusy;
        });
        exportQuality.disabled = isBusy || isPngOutput;
        qualityField.classList.toggle('is-disabled', isPngOutput);
    }

    function setBusyState(busy) {
        isBusy = busy;
        generateBtn.disabled = busy || uploadedFiles.length === 0 || uploadedFiles.some(item => !item.template);
        resetBtn.disabled = busy || uploadedFiles.length === 0;
        templateInput.disabled = busy;
        fileInput.disabled = busy;
        templateDropZone.setAttribute('aria-disabled', String(busy));
        updateTemplateCard('landscape');
        updateTemplateCard('portrait');
        dropZone.classList.toggle('locked', busy || (!templates.landscape && !templates.portrait));
        dropZone.setAttribute('aria-disabled', String(busy || (!templates.landscape && !templates.portrait)));
        updateExportControls();
        selectAllPhotos.disabled = busy;
        updateSelectionControls();
    }

    async function generateAndZipFiles() {
        if (isBusy || uploadedFiles.length === 0) return;
        const unmatched = uploadedFiles.filter(item => !item.template);
        if (unmatched.length > 0) {
            setStatus(`Add matching frames for all ${unmatched.length} unmatched photo(s) before exporting.`, 'warning');
            return;
        }
        if (typeof JSZip === 'undefined') {
            setStatus('The ZIP library did not load. Check your connection and refresh the page.', 'error');
            return;
        }

        setBusyState(true);
        updateWorkspaceSteps(3);
        progressBar.hidden = false;
        progressBar.value = 0;
        const zip = new JSZip();
        const usedNames = new Set();
        const failures = [];
        const orderedItems = getSortedItems();
        const mimeType = exportFormat.value === 'png' ? 'image/png' : 'image/jpeg';
        const extension = exportFormat.value === 'png' ? 'png' : 'jpg';
        const quality = Number(exportQuality.value) / 100;
        let completed = 0;

        try {
            for (let index = 0; index < orderedItems.length; index += 1) {
                const item = orderedItems[index];
                setStatus(`Processing photo ${index + 1} of ${orderedItems.length}...`);
                try {
                    const size = outputSizeForItem(item);
                    drawComposite(item, outputCanvas, size.width, size.height, item.edit, true);
                    const blob = await canvasToBlob(mimeType, quality);
                    zip.file(outputNameForItem(item, index, usedNames, extension), blob);
                    completed += 1;
                } catch (error) {
                    failures.push(item.file.name);
                }
                progressBar.value = ((index + 1) / orderedItems.length) * 80;
            }

            if (completed === 0) throw new Error('No photos could be generated.');
            setStatus('Creating your ZIP file...');
            const content = await zip.generateAsync({ type: 'blob' }, metadata => {
                progressBar.value = 80 + (metadata.percent * 0.2);
            });

            const downloadUrl = URL.createObjectURL(content);
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = safeZipName();
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);

            if (failures.length > 0) {
                setStatus(`${completed} photo(s) downloaded. ${failures.length} could not be generated: ${failures.join(', ')}.`, 'warning');
            } else {
                setStatus(`${completed} edited photo(s) downloaded successfully.`);
            }
        } catch (error) {
            setStatus(error.message || 'The ZIP file could not be created. Please try again.', 'error');
            updateWorkspaceSteps();
        } finally {
            outputCanvas.width = 1;
            outputCanvas.height = 1;
            progressBar.hidden = true;
            setBusyState(false);
        }
    }

    function activateTemplatePicker(expectedOrientation = null) {
        if (isBusy) return;
        requestedTemplateOrientation = expectedOrientation;
        templateInput.multiple = !expectedOrientation;
        templateInput.click();
    }

    function activatePhotoPicker() {
        if (!isBusy && !dropZone.classList.contains('locked')) fileInput.click();
    }

    function addKeyboardActivation(element, action) {
        element.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                action();
            }
        });
    }

    templateDropZone.addEventListener('click', () => activateTemplatePicker());
    addKeyboardActivation(templateDropZone, () => activateTemplatePicker());
    templateInput.addEventListener('change', event => processTemplateFiles(event.target.files, requestedTemplateOrientation));
    templateDropZone.addEventListener('dragover', event => {
        event.preventDefault();
        if (!isBusy) templateDropZone.classList.add('dragover');
    });
    templateDropZone.addEventListener('dragleave', () => templateDropZone.classList.remove('dragover'));
    templateDropZone.addEventListener('drop', event => {
        event.preventDefault();
        templateDropZone.classList.remove('dragover');
        processTemplateFiles(event.dataTransfer.files);
    });

    document.querySelectorAll('[data-replace-template]').forEach(button => {
        button.addEventListener('click', () => activateTemplatePicker(button.dataset.replaceTemplate));
    });
    document.querySelectorAll('[data-remove-template]').forEach(button => {
        button.addEventListener('click', () => removeTemplate(button.dataset.removeTemplate));
    });

    dropZone.addEventListener('click', activatePhotoPicker);
    addKeyboardActivation(dropZone, activatePhotoPicker);
    dropZone.addEventListener('dragover', event => {
        event.preventDefault();
        if (!dropZone.classList.contains('locked')) dropZone.classList.add('dragover');
    });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', event => {
        event.preventDefault();
        dropZone.classList.remove('dragover');
        if (!dropZone.classList.contains('locked')) handleFiles(event.dataTransfer.files);
    });

    fileInput.addEventListener('change', event => handleFiles(event.target.files));
    resetBtn.addEventListener('click', clearPhotos);
    generateBtn.addEventListener('click', generateAndZipFiles);

    selectAllPhotos.addEventListener('change', () => {
        uploadedFiles.forEach(item => { item.selected = selectAllPhotos.checked; });
        renderGallery();
    });

    photoSort.addEventListener('change', () => renderGallery());

    resetSelectedBtn.addEventListener('click', () => {
        uploadedFiles.filter(item => item.selected).forEach(item => { item.edit = defaultEdit(); });
        renderGallery('Selected edits were reset.');
    });

    removeSelectedBtn.addEventListener('click', () => {
        removeItems(uploadedFiles.filter(item => item.selected).map(item => item.id));
    });

    exportQuality.addEventListener('input', () => {
        qualityValue.textContent = `${exportQuality.value}%`;
    });

    exportFormat.addEventListener('change', () => {
        updateExportControls();
    });

    closeEditorBtn.addEventListener('click', closeEditor);
    applyEditBtn.addEventListener('click', () => {
        if (editorItem && editorDraft) editorItem.edit = cloneEdit(editorDraft);
        closeEditor();
        renderGallery('Photo adjustments applied.');
    });

    photoEditor.addEventListener('click', event => {
        if (event.target === photoEditor) closeEditor();
    });
    photoEditor.addEventListener('cancel', event => {
        event.preventDefault();
        closeEditor();
    });

    cropZoom.addEventListener('input', () => {
        if (!editorDraft) return;
        editorDraft.zoom = Number(cropZoom.value);
        renderEditor();
    });

    fitModeButtons.forEach(button => {
        button.addEventListener('click', () => {
            if (!editorDraft) return;
            editorDraft.fitMode = button.dataset.fitMode;
            editorDraft.offsetX = 0;
            editorDraft.offsetY = 0;
            renderEditor();
        });
    });

    rotateLeftBtn.addEventListener('click', () => {
        if (!editorDraft) return;
        editorDraft.rotation = (editorDraft.rotation - 90 + 360) % 360;
        editorDraft.offsetX = 0;
        editorDraft.offsetY = 0;
        renderEditor();
    });

    rotateRightBtn.addEventListener('click', () => {
        if (!editorDraft) return;
        editorDraft.rotation = (editorDraft.rotation + 90) % 360;
        editorDraft.offsetX = 0;
        editorDraft.offsetY = 0;
        renderEditor();
    });

    resetEditBtn.addEventListener('click', () => {
        editorDraft = defaultEdit();
        renderEditor();
    });

    editorCanvas.addEventListener('pointerdown', event => {
        if (!editorDraft) return;
        editorCanvas.setPointerCapture(event.pointerId);
        dragState = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
        editorCanvas.classList.add('is-dragging');
    });

    editorCanvas.addEventListener('pointermove', event => {
        if (!editorDraft || !dragState || dragState.pointerId !== event.pointerId) return;
        const bounds = editorCanvas.getBoundingClientRect();
        editorDraft.offsetX += (event.clientX - dragState.x) / bounds.width;
        editorDraft.offsetY += (event.clientY - dragState.y) / bounds.height;
        dragState.x = event.clientX;
        dragState.y = event.clientY;
        renderEditor();
    });

    function endEditorDrag(event) {
        if (!dragState || dragState.pointerId !== event.pointerId) return;
        dragState = null;
        editorCanvas.classList.remove('is-dragging');
    }

    editorCanvas.addEventListener('pointerup', endEditorDrag);
    editorCanvas.addEventListener('pointercancel', endEditorDrag);
    editorCanvas.addEventListener('wheel', event => {
        if (!editorDraft) return;
        event.preventDefault();
        editorDraft.zoom = Math.max(1, Math.min(3, editorDraft.zoom + (event.deltaY < 0 ? 0.08 : -0.08)));
        renderEditor();
    }, { passive: false });

    editorCanvas.addEventListener('keydown', event => {
        if (!editorDraft || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
        event.preventDefault();
        const amount = event.shiftKey ? 0.05 : 0.01;
        if (event.key === 'ArrowLeft') editorDraft.offsetX -= amount;
        if (event.key === 'ArrowRight') editorDraft.offsetX += amount;
        if (event.key === 'ArrowUp') editorDraft.offsetY -= amount;
        if (event.key === 'ArrowDown') editorDraft.offsetY += amount;
        renderEditor();
    });

    window.addEventListener('beforeunload', () => {
        uploadedFiles.forEach(item => URL.revokeObjectURL(item.url));
        Object.values(templates).forEach(template => {
            if (template) URL.revokeObjectURL(template.url);
        });
    });

    updateTemplateUI();
    updateSelectionControls();
    updateExportControls();
});
