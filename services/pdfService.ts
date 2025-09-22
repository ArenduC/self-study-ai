// Declare the global pdfjsLib object provided by the script tag in index.html
declare const pdfjsLib: any;

let isWorkerInitialized = false;

const initializePdfWorker = () => {
    // Ensure pdfjsLib is available on the window
    if (typeof pdfjsLib === 'undefined') {
        console.error("pdf.js library is not loaded yet.");
        throw new Error("PDF processing library failed to load. Please try again.");
    }

    // Set the worker source only once
    if (!isWorkerInitialized) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
        isWorkerInitialized = true;
    }
};

/**
 * Extracts both text and images from a PDF file.
 * @param file The PDF file to process.
 * @returns A promise that resolves with the extracted text and an array of base64 image data URLs.
 */
export const extractPdfContent = async (file: File): Promise<{ text: string; images: string[] }> => {
  initializePdfWorker();

  if (file.type !== 'application/pdf') {
    throw new Error('Invalid file type. Please upload a PDF file.');
  }

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
  const numPages = pdf.numPages;
  const allText: string[] = [];
  const allImages: string[] = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    
    // Extract Text
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item: any) => ('str' in item ? item.str : '')).join(' ');
    allText.push(pageText);

    // Extract Images
    const opList = await page.getOperatorList();
    const fns = opList.fnArray;
    const args = opList.argsArray;

    for (let j = 0; j < fns.length; j++) {
      if (fns[j] === pdfjsLib.OPS.paintImageXObject) {
        const imageName = args[j][0];
        try {
            // Asynchronously get the image object from the page resources
            const image = await page.objs.get(imageName);
            if (image && image.data) {
                const { width, height, data, kind } = image;
                
                // Don't process tiny images, likely just spacers or lines
                if (width < 50 && height < 50) continue;

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                
                if (ctx) {
                    const imageData = ctx.createImageData(width, height);
                    if (kind === pdfjsLib.ImageKind.RGBA_32BPP) {
                         // RGBA data can be directly put onto the canvas
                        imageData.data.set(data);
                    } else if (kind === pdfjsLib.ImageKind.RGB_24BPP) {
                        // Manually construct RGBA from RGB
                        const pixelData = new Uint8ClampedArray(width * height * 4);
                        for (let k = 0, l = 0; k < data.length; k += 3, l += 4) {
                            pixelData[l] = data[k];
                            pixelData[l + 1] = data[k + 1];
                            pixelData[l + 2] = data[k + 2];
                            pixelData[l + 3] = 255; // Alpha channel
                        }
                        imageData.data.set(pixelData);
                    } else {
                        // For other kinds, like grayscale, you might need more handling.
                        // This basic handling covers common RGB/RGBA cases.
                        continue; // Skip unsupported image types for now.
                    }
                    ctx.putImageData(imageData, 0, 0);
                    allImages.push(canvas.toDataURL());
                }
            }
        } catch(e: any) {
            // This error is common in some PDFs where an image reference is encountered before its data.
            // We can safely skip it as the library (pdf.js) cannot resolve it at this stage.
            if (e?.message?.includes("Requesting object that isn't resolved yet")) {
                console.log(`Skipping an image that could not be resolved immediately: ${imageName}`);
            } else {
                console.warn(`Could not process image ${imageName}`, e);
            }
        }
      }
    }
  }

  return {
    text: allText.join('\n\n'),
    images: allImages,
  };
};