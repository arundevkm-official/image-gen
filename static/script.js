let progressInterval;

function simulateProgress(duration) {
  const bar = document.getElementById("progress-bar");
  const container = document.getElementById("progress-container");
  container.style.display = "block";
  let width = 0;
  bar.style.width = "0%";

  clearInterval(progressInterval);
  progressInterval = setInterval(() => {
    if (width >= 95) {
      clearInterval(progressInterval);
    } else {
      // Slow down as it gets higher
      const increment = width < 50 ? 5 : width < 80 ? 2 : 0.5;
      width += increment;
      bar.style.width = width + "%";
    }
  }, duration / 50); // Rough distribution
}

function completeProgress() {
  clearInterval(progressInterval);
  const bar = document.getElementById("progress-bar");
  bar.style.width = "100%";
  setTimeout(() => {
    document.getElementById("progress-container").style.display = "none";
    bar.style.width = "0%";
  }, 500);
}

// Toast Notification
function showToast(message, type = "error") {
  const container = document.getElementById("toast-container");
  
  // Create toast element
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerText = message;
  
  // Add to container
  container.appendChild(toast);
  
  // Trigger animation
  requestAnimationFrame(() => {
    toast.classList.add("visible");
  });
  
  // Remove after 3 seconds
  setTimeout(() => {
    toast.classList.remove("visible");
    setTimeout(() => {
      toast.remove();
    }, 300); // Wait for transition
  }, 3000);
}

async function generateImage() {
  const promptInput = document.getElementById("prompt");
  const negPromptInput = document.getElementById("negative-prompt");
  const guidanceInput = document.getElementById("guidance-scale");
  const stepsInput = document.getElementById("inference-steps");
  const btn = document.getElementById("generate-btn");
  const loadingText = document.getElementById("loading-text");
  const gallery = document.getElementById("gallery");

  const prompt = promptInput.value.trim();
  if (!prompt) return showToast("Please enter a prompt!", "error");

  // UI State: Loading
  btn.disabled = true;
  btn.innerText = "Dreaming...";
  loadingText.style.display = "block";

  // Start Progress (~10s roughly)
  simulateProgress(10000);

  try {
    const response = await fetch("/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: prompt,
        negative_prompt: negPromptInput.value.trim(),
        guidance_scale: parseFloat(guidanceInput.value),
        num_inference_steps: parseInt(stepsInput.value),
      }),
    });

    if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`);
    }

    const data = await response.json();

    // Create new Gallery Item
    const galleryItem = document.createElement("div");
    galleryItem.className = "gallery-item";

    const img = document.createElement("img");
    img.src = `data:image/png;base64,${data.image}`;
    img.alt = prompt;
    img.style.cursor = "pointer";
    img.onclick = () => openLightbox(img.src, prompt);

    const actions = document.createElement("div");
    actions.className = "actions";

    const downloadBtn = document.createElement("a");
    downloadBtn.href = img.src;
    downloadBtn.download = `dream-canvas-${Date.now()}.png`;
    downloadBtn.innerText = "Download";
    downloadBtn.className = "download-btn";

    actions.appendChild(downloadBtn);
    galleryItem.appendChild(img);
    galleryItem.appendChild(actions);

    // Prepend to gallery
    gallery.prepend(galleryItem);

    completeProgress();
  } catch (err) {
    showToast("Failed to generate image: " + err.message, "error");
    document.getElementById("progress-container").style.display = "none";
  } finally {
    loadingText.style.display = "none";
    btn.disabled = false;
    btn.innerText = "Generate";
  }
}

// Lightbox Functions
function openLightbox(src, caption) {
  const lightbox = document.getElementById("lightbox");
  const lightboxImg = document.getElementById("lightbox-img");
  const captionDiv = document.getElementById("lightbox-caption");

  lightboxImg.src = src;
  captionDiv.innerText = caption || "";
  lightbox.style.display = "flex";
}

function closeLightbox() {
  document.getElementById("lightbox").style.display = "none";
}

// Allow Enter key to submit (Shift+Enter for new line)
document.getElementById("prompt").addEventListener("keypress", function (e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    generateImage();
  }
});

// Escape key to close lightbox
document.addEventListener("keydown", function (event) {
  if (event.key === "Escape") {
    closeLightbox();
  }
});
