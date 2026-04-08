document.addEventListener('DOMContentLoaded', () => {

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
    let customTemplate = null;

    // STEP 1: Handle Custom Layout Upload & Check Transparency
    templateInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        templateStatus.innerHTML = `<span style="color: #f57c00;"><i class="fas fa-spinner fa-spin"></i> Scanning image for transparency...</span>`;

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
                    templateStatus.innerHTML = `❌ <b>Error:</b> No transparency detected! This image is completely solid and will hide your photos. Please upload a PNG with a transparent background cutout.`;
                    templateStatus.style.color = '#d32f2f';
                    dropZone.classList.add('locked');
                    return;
                }

                // Save template. We no longer set the final canvas size here!
                // We will set the canvas size dynamically based on the high-res photo later.
                customTemplate = img;
                
                let orientation = "Square";
                if (img.width > img.height) orientation = "Landscape";
                if (img.height > img.width) orientation = "Portrait";

                templateStatus.innerHTML = `✅ Template approved! Base Aspect Ratio: <b>${orientation}</b>.<br><small>Output will scale automatically to match your high-res photos.</small>`;
                templateStatus.style.color = '#2e7d32';
                
                dropZone.classList.remove('locked');
            };
            
            img.onerror = () => {
                templateStatus.innerHTML = `❌ Error loading template. Please ensure it's a valid PNG image.`;
                templateStatus.style.color = '#d32f2f';
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });

    function initializeState() {
        uploadedFiles = [];
        previewGallery.innerHTML = '';
        statusArea.textContent = '';
        generateBtn.disabled = true;
        fileInput.value = ''; 
        progressBar.style.display = 'none';
        galleryTitle.style.display = 'none';
    }

    // STEP 2: Handle Uploading Photos & Show True Preview
    function handleFiles(files) {
        if (!customTemplate) {
            alert("Please upload a valid layout template first!");
            return;
        }

        initializeState();
        const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
        if (imageFiles.length === 0) return;

        uploadedFiles = imageFiles;
        statusArea.textContent = `${uploadedFiles.length} photo(s) are ready to be processed.`;
        generateBtn.disabled = false;
        galleryTitle.style.display = 'block';
        
        const templateRatio = customTemplate.width / customTemplate.height;
        
        uploadedFiles.forEach(file => {
            const container = document.createElement('div');
            container.classList.add('preview-item');
            
            container.style.width = '200px';
            container.style.height = `${200 / templateRatio}px`;

            const sourceImg = document.createElement('img');
            sourceImg.classList.add('source-img');
            sourceImg.src = URL.createObjectURL(file);
            sourceImg.onload = () => URL.revokeObjectURL(sourceImg.src); 

            const overlayImg = document.createElement('img');
            overlayImg.classList.add('overlay-img');
            overlayImg.src = customTemplate.src; 

            container.appendChild(sourceImg);
            container.appendChild(overlayImg);
            previewGallery.appendChild(container);
        });
    }

    function loadImage(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = () => reject(`Image load error for: ${file.name}`);
                img.src = reader.result;
            };
            reader.onerror = () => reject(`FileReader error for: ${file.name}`);
            reader.readAsDataURL(file);
        });
    }

    // THE FIX: High-Resolution Dynamic Canvas Sizing
    function drawCoverImage(img) {
        // Calculate the scale needed to ensure the photo is NOT downscaled.
        // We find the scale factor comparing the photo to the template.
        const scaleX = img.width / customTemplate.width;
        const scaleY = img.height / customTemplate.height;
        
        // Use the largest scale to preserve maximum quality, ensuring it doesn't shrink below template size
        const maxScale = Math.max(scaleX, scaleY, 1);

        // Dynamically resize the invisible drawing canvas to be massive
        canvas.width = customTemplate.width * maxScale;
        canvas.height = customTemplate.height * maxScale;

        ctx.clearRect(0, 0, canvas.width, canvas.height); 
        const canvasAspectRatio = canvas.width / canvas.height;
        const imgAspectRatio = img.width / img.height;
        let drawWidth, drawHeight, drawX, drawY;

        // Smart Crop Math - now processing on a high-res canvas
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

        // 1. Draw the high-res photo
        ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
        
        // 2. Draw the template stretched over the new massive canvas
        if (customTemplate) {
            ctx.drawImage(customTemplate, 0, 0, canvas.width, canvas.height);
        }
    }

    // STEP 3: Generate and Zip
    async function generateAndZipFiles() {
        if (uploadedFiles.length === 0 || !customTemplate) return;

        generateBtn.disabled = true;
        resetBtn.disabled = true;
        const zip = new JSZip();
        
        progressBar.style.display = 'block';
        progressBar.value = 0;

        for (let i = 0; i < uploadedFiles.length; i++) {
            const file = uploadedFiles[i];
            statusArea.textContent = `Processing image ${i + 1} of ${uploadedFiles.length}: ${file.name}`;
            
            try {
                const image = await loadImage(file);
                drawCoverImage(image);
               
                // Using JPEG output with high quality instead of PNG because full-res Canon PNGs 
                // will crash the browser memory and result in massive 30MB+ files.
                const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.95));
                const fileName = `layout_${String(i + 1).padStart(3, '0')}.jpg`;
                zip.file(fileName, blob);

                progressBar.value = ((i + 1) / uploadedFiles.length) * 100;
            } catch (error) {
                console.error(error);
            }
        }

        statusArea.textContent = "Zipping high-res files... please wait (this may take a moment).";
        progressBar.removeAttribute('value');

        zip.generateAsync({ type: "blob" })
            .then(function(content) {
                const link = document.createElement('a');
                link.href = URL.createObjectURL(content);
                link.download = "high_res_layouts.zip";
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                statusArea.innerHTML = "✅ <b>All done! Your high-res .zip file has been downloaded.</b>";
                resetBtn.disabled = false;
                progressBar.style.display = 'none';
            });
    }

    // Event Listeners
    dropZone.addEventListener('click', () => { if (!dropZone.classList.contains('locked')) fileInput.click(); });
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); if (!dropZone.classList.contains('locked')) dropZone.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', (e) => { e.preventDefault(); dropZone.classList.remove('dragover'); if (!dropZone.classList.contains('locked')) handleFiles(e.dataTransfer.files); });
    
    fileInput.addEventListener('change', () => handleFiles(fileInput.files));
    resetBtn.addEventListener('click', initializeState);
    generateBtn.addEventListener('click', generateAndZipFiles);

    initializeState();
});