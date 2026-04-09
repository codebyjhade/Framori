document.addEventListener('DOMContentLoaded', () => {

    const templateDropZone = document.getElementById('template-drop-zone'); 
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const templateInput = document.getElementById('template-input');
    const templateStatus = document.getElementById('template-status');
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const generateBtn = document.getElementById('generate-btn');
    const resetBtn = document.getElementById('reset-btn');
    const statusArea = document.getElementById('status-area');
    const previewGallery = document.getElementById('preview-gallery');
    const progressBar = document.getElementById('progress-bar');
    const galleryTitle = document.getElementById('gallery-title');

    let uploadedFiles = [];
    
    // NEW: Store both templates
    let templates = {
        landscape: null,
        portrait: null
    };

    // STEP 1: Handle Multiple Custom Layout Uploads
    function processTemplateFiles(files) {
        const fileArray = Array.from(files).filter(file => file.type.startsWith('image/'));
        if (fileArray.length === 0) return;

        templateStatus.innerHTML = `<span style="color: #f57c00;"><i class="fas fa-spinner fa-spin"></i> Analyzing templates...</span>`;

        let loadedCount = 0;

        fileArray.forEach(file => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    
                    // Transparency Check
                    const tempCanvas = document.createElement('canvas');
                    tempCanvas.width = img.width;
                    tempCanvas.height = img.height;
                    const tempCtx = tempCanvas.getContext('2d');
                    tempCtx.drawImage(img, 0, 0);

                    const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
                    const pixels = imageData.data;
                    let hasTransparency = false;

                    for (let i = 3; i < pixels.length; i += 4) {
                        if (pixels[i] < 255) {
                            hasTransparency = true;
                            break;
                        }
                    }

                    if (!hasTransparency) {
                        alert(`❌ Error: ${file.name} has no transparency! Skipping this file.`);
                    } else {
                        // SORT THE TEMPLATES BY ORIENTATION
                        if (img.width >= img.height) {
                            templates.landscape = img;
                        } else {
                            templates.portrait = img;
                        }
                    }

                    loadedCount++;
                    if (loadedCount === fileArray.length) {
                        updateTemplateStatusUI();
                    }
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        });
    }

    function updateTemplateStatusUI() {
        let html = '';
        if (templates.landscape) {
            html += `<div style="color: #2e7d32; margin-top: 5px;">✅ <b>Landscape</b> Layout Ready</div>`;
        }
        if (templates.portrait) {
            html += `<div style="color: #2e7d32; margin-top: 5px;">✅ <b>Portrait</b> Layout Ready</div>`;
        }
        
        if (html === '') {
            templateStatus.innerHTML = `❌ No valid transparent templates loaded.`;
            templateStatus.style.color = '#d32f2f';
        } else {
            html += `<div style="font-size: 0.85em; color: #475569; margin-top: 8px;">Photos will automatically sort to fit available layouts.</div>`;
            templateStatus.innerHTML = html;
            dropZone.classList.remove('locked');
            
            // Re-render if templates change mid-session
            if (uploadedFiles.length > 0) {
                // Re-evaluate template choices for existing photos
                uploadedFiles.forEach(item => {
                    item.template = (item.isLandscape && templates.landscape) ? templates.landscape : 
                                    (!item.isLandscape && templates.portrait) ? templates.portrait : 
                                    (templates.landscape || templates.portrait);
                });
                renderGallery();
            }
        }
    }

    // Template Event Listeners
    templateInput.addEventListener('change', (e) => processTemplateFiles(e.target.files));
    templateDropZone.addEventListener('dragover', (e) => { e.preventDefault(); templateDropZone.classList.add('dragover'); });
    templateDropZone.addEventListener('dragleave', () => templateDropZone.classList.remove('dragover'));
    templateDropZone.addEventListener('drop', (e) => { 
        e.preventDefault(); 
        templateDropZone.classList.remove('dragover'); 
        processTemplateFiles(e.dataTransfer.files);
    });

    // STEP 2: Handle Uploading & Sorting Photos
    async function handleFiles(files) {
        if (!templates.landscape && !templates.portrait) {
            alert("Please upload at least one layout template first!");
            return;
        }

        const newImageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
        if (newImageFiles.length === 0) return;

        statusArea.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Sorting photos by orientation...`;

        // Pre-load images to detect orientation before they enter the gallery
        for (let file of newImageFiles) {
            try {
                const img = await loadImage(file);
                const isLandscape = img.width >= img.height;
                
                // Assign the perfect template, or fallback to whatever template is available
                let bestTemplate = null;
                if (isLandscape && templates.landscape) bestTemplate = templates.landscape;
                else if (!isLandscape && templates.portrait) bestTemplate = templates.portrait;
                else bestTemplate = templates.landscape || templates.portrait;

                uploadedFiles.push({
                    file: file,
                    img: img,
                    isLandscape: isLandscape,
                    template: bestTemplate
                });
            } catch (e) {
                console.error(e);
            }
        }

        renderGallery();
    }

    function renderGallery() {
        previewGallery.innerHTML = ''; 
        
        statusArea.innerHTML = `✅ ${uploadedFiles.length} photo(s) sorted and ready.`;
        generateBtn.disabled = false;
        galleryTitle.style.display = 'block';
        
        uploadedFiles.forEach(item => {
            const container = document.createElement('div');
            container.classList.add('preview-item');
            
            const templateRatio = item.template.width / item.template.height;
            
            container.style.width = '200px';
            container.style.height = `${200 / templateRatio}px`;

            const sourceImg = document.createElement('img');
            sourceImg.classList.add('source-img');
            sourceImg.src = item.img.src; // Using the pre-loaded image data

            const overlayImg = document.createElement('img');
            overlayImg.classList.add('overlay-img');
            overlayImg.src = item.template.src; 

            // Add an orientation label to the preview box
            const badge = document.createElement('div');
            badge.style.position = 'absolute';
            badge.style.bottom = '8px';
            badge.style.right = '8px';
            badge.style.backgroundColor = 'rgba(15, 23, 42, 0.85)'; 
            badge.style.color = '#fff';
            badge.style.padding = '4px 8px';
            badge.style.borderRadius = '6px';
            badge.style.fontSize = '0.75rem';
            badge.style.fontWeight = '600';
            badge.innerText = item.isLandscape ? 'Landscape' : 'Portrait';

            container.appendChild(sourceImg);
            container.appendChild(overlayImg);
            container.appendChild(badge);
            previewGallery.appendChild(container);
        });
    }

    function clearPhotos() {
        uploadedFiles = [];
        previewGallery.innerHTML = '';
        statusArea.textContent = '';
        generateBtn.disabled = true;
        fileInput.value = ''; 
        progressBar.style.display = 'none';
        galleryTitle.style.display = 'none';
    }

    function loadImage(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = () => reject(`Image load error`);
                img.src = reader.result;
            };
            reader.readAsDataURL(file);
        });
    }

    // Pass the specific active template into the draw function
    function drawCoverImage(img, activeTemplate) {
        const scaleX = img.width / activeTemplate.width;
        const scaleY = img.height / activeTemplate.height;
        const maxScale = Math.max(scaleX, scaleY, 1);

        canvas.width = activeTemplate.width * maxScale;
        canvas.height = activeTemplate.height * maxScale;

        ctx.clearRect(0, 0, canvas.width, canvas.height); 
        const canvasAspectRatio = canvas.width / canvas.height;
        const imgAspectRatio = img.width / img.height;
        let drawWidth, drawHeight, drawX, drawY;

        if (imgAspectRatio > canvasAspectRatio) {
            drawHeight = canvas.height;
            drawWidth = drawHeight * imgAspectRatio;
            drawX = -(drawWidth - canvas.width) / 2;
            drawY = 0;
        } else {
            drawWidth = canvas.width;
            drawHeight = drawWidth / imgAspectRatio;
            drawX = 0;
            drawY = -(drawHeight - canvas.height) / 2;
        }

        ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
        ctx.drawImage(activeTemplate, 0, 0, canvas.width, canvas.height);
    }

    // STEP 3: Generate and Zip
    async function generateAndZipFiles() {
        if (uploadedFiles.length === 0) return;

        generateBtn.disabled = true;
        resetBtn.disabled = true;
        const zip = new JSZip();
        
        progressBar.style.display = 'block';
        progressBar.value = 0;

        for (let i = 0; i < uploadedFiles.length; i++) {
            const item = uploadedFiles[i];
            statusArea.textContent = `Processing image ${i + 1} of ${uploadedFiles.length}`;
            
            try {
                // Use the specifically assigned template for this photo
                drawCoverImage(item.img, item.template);
               
                const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.95));
                
                // File name is set here! Change "layout_" to whatever you want.
                const fileName = `odizee_${String(i + 1).padStart(3, '0')}.jpg`;
                zip.file(fileName, blob);

                progressBar.value = ((i + 1) / uploadedFiles.length) * 100;
            } catch (error) {
                console.error(error);
            }
        }

        statusArea.textContent = "Zipping high-res files... please wait.";
        progressBar.removeAttribute('value');

        zip.generateAsync({ type: "blob" })
            .then(function(content) {
                const link = document.createElement('a');
                link.href = URL.createObjectURL(content);
                // Download file name is set here!
                link.download = "Odizee_Council_Photos.zip"; 
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                statusArea.innerHTML = "✅ <b>All done! Your sorted, high-res .zip file has been downloaded.</b>";
                resetBtn.disabled = false;
                progressBar.style.display = 'none';
            });
    }

    dropZone.addEventListener('click', () => { if (!dropZone.classList.contains('locked')) fileInput.click(); });
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); if (!dropZone.classList.contains('locked')) dropZone.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', (e) => { e.preventDefault(); dropZone.classList.remove('dragover'); if (!dropZone.classList.contains('locked')) handleFiles(e.dataTransfer.files); });
    
    fileInput.addEventListener('change', () => handleFiles(fileInput.files));
    
    resetBtn.addEventListener('click', clearPhotos);
    generateBtn.addEventListener('click', generateAndZipFiles);
});