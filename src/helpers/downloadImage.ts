/**
 * Converts an image URL to base64, handling CORS errors gracefully
 */
async function toBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      return null;
    }
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    return null;
  }
}

/**
 * Downloads the current page as an image, handling cover images that need CORS
 */
export async function downloadImage(): Promise<void> {
  // 1. Select the cover image (try both selectors)
  const coverImg = 
    (document.querySelector("#cover-image") as HTMLImageElement) ??
    (document.querySelector(".wp-block-cover img") as HTMLImageElement);
  
  let originalSrc: string | null = null;
  let originalCrossOrigin: string | null = null;
  let wasConverted = false;

  if (coverImg) {
    originalSrc = coverImg.src;
    originalCrossOrigin = coverImg.crossOrigin;
    
    // 2. Try to convert cover to base64
    const base64 = await toBase64(originalSrc);
    
    if (base64) {
      // 3. Replace image with base64 version
      coverImg.src = base64;
      wasConverted = true;
    } else {
      // If conversion fails, try setting crossOrigin to help html2canvas
      try {
        coverImg.crossOrigin = "anonymous";
      } catch (e) {
        // Ignore if crossOrigin can't be set
      }
    }
  }

  // 4. Get padding value and add it temporarily to blog-post-content
  const root = document.documentElement;
  const paddingValue = getComputedStyle(root).getPropertyValue('--spacing-page-x').trim();
  
  const rootFontSize = parseFloat(getComputedStyle(root).fontSize) || 16;
  let paddingPx: number;
  
  if (paddingValue.endsWith('rem')) {
    const remValue = parseFloat(paddingValue);
    paddingPx = remValue * rootFontSize;
  } else if (paddingValue.endsWith('px')) {
    paddingPx = parseFloat(paddingValue);
  } else {
    paddingPx = 5.5 * rootFontSize;
  }

  // 5. Capture the page
  const html2canvas = (await import("html2canvas")).default;
  const blogPostContent = document.querySelector(".blog-post-content") as HTMLElement;
  if (!blogPostContent) {
    return;
  }

  const originalPaddingLeft = blogPostContent.style.paddingLeft;
  const originalPaddingRight = blogPostContent.style.paddingRight;
  const originalBoxSizing = blogPostContent.style.boxSizing;
  const originalWidth = blogPostContent.style.width;
  
  blogPostContent.style.boxSizing = 'content-box';
  blogPostContent.style.paddingLeft = `${paddingPx}px`;
  blogPostContent.style.paddingRight = `${paddingPx}px`;

  const canvas = await html2canvas(blogPostContent, {
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#ffffff',
    ignoreElements: (element) => {
      return (
        element.classList?.contains('download-image-button') ||
        element.classList?.contains('audio-player')
      );
    },
  });

  blogPostContent.style.paddingLeft = originalPaddingLeft;
  blogPostContent.style.paddingRight = originalPaddingRight;
  blogPostContent.style.boxSizing = originalBoxSizing;
  blogPostContent.style.width = originalWidth;

  // 6. Restore original image
  if (coverImg && originalSrc) {
    coverImg.src = originalSrc;
    if (originalCrossOrigin !== null) {
      coverImg.crossOrigin = originalCrossOrigin;
    } else if (wasConverted) {
      // Remove crossOrigin if we added it
      try {
        coverImg.removeAttribute("crossorigin");
      } catch (e) {
        // Ignore
      }
    }
  }

  // 7. Download
  const url = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = url;
  const title = document.querySelector(".blog-post-title")?.textContent || "pagina";
  a.download = `${title}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

