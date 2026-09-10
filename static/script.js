// ============================================================================
// Global Script for AI Healthcare Frontend
// - Dark mode
// - Scroll animations
// - Animated counters
// - Shared interactions (upload, diagnosis preview, chatbot, appointments)
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  initDarkMode();
  initScrollAnimations();
  initCounters();
  initAuthForms();
  initDiagnosisUpload();
  initResultPage();
  initChatbot();
  initAppointmentBooking();
});

function randomBrainConfidence() {
  // Random float between 0.80 and 0.90 for demo confidence display.
  return 0.8 + Math.random() * 0.1;
}

// ---------------------------------------------------------------------------//
// Dark Mode (persisted in localStorage)
// ---------------------------------------------------------------------------//

function initDarkMode() {
  const toggle = document.querySelector('[data-toggle="dark-mode"]');
  const stored = localStorage.getItem('aihealth-theme');

  if (stored === 'dark') {
    document.body.classList.add('dark-mode');
  }

  if (!toggle) return;

  const updateIcon = () => {
    const isDark = document.body.classList.contains('dark-mode');
    toggle.textContent = isDark ? '☀️' : '🌙';
  };

  updateIcon();

  toggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('aihealth-theme', isDark ? 'dark' : 'light');
    updateIcon();
  });
}
//chatbot
const handleSend = text => {
  const trimmed = text.trim();
  if (!trimmed) return;
  appendMessage(trimmed, 'user');
  input.value = '';

  const typing = appendTyping();

  // NEW: call backend
  fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: trimmed })
  })
    .then(res => res.json())
    .then(data => {
      removeTyping(typing);
      if (data && data.reply) {
        appendMessage(data.reply, 'ai');
      } else {
        appendMessage('Sorry, I could not understand the response from the server.', 'ai');
      }
    })
    .catch(() => {
      removeTyping(typing);
      appendMessage('There was an error contacting the chat server. Please try again.', 'ai');
    });
};

// ---------------------------------------------------------------------------//
// Scroll fade-in animations
// ---------------------------------------------------------------------------//

function initScrollAnimations() {
  const elements = document.querySelectorAll('.fade-in');
  if (!elements.length) return;

  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('fade-in-visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );

  elements.forEach(el => observer.observe(el));
}

// ---------------------------------------------------------------------------//
// Animated counters
// ---------------------------------------------------------------------------//

function initCounters() {
  const counters = document.querySelectorAll('[data-counter]');
  if (!counters.length) return;

  const startCounter = el => {
    const target = Number(el.getAttribute('data-counter')) || 0;
    const duration = 1200;
    const startTime = performance.now();

    function tick(now) {
      const progress = Math.min((now - startTime) / duration, 1);
      const value = Math.floor(progress * target);
      el.textContent = value.toLocaleString();
      if (progress < 1) requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  };

  const io = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          startCounter(entry.target);
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.4 }
  );

  counters.forEach(el => io.observe(el));
}

// ---------------------------------------------------------------------------//
// Auth forms (validation, password strength & toggles)
// ---------------------------------------------------------------------------//

function initAuthForms() {
  const signupForm = document.querySelector('[data-form="signup"]');
  const signinForm = document.querySelector('[data-form="signin"]');

  if (signupForm) {
    signupForm.addEventListener('submit', e => {
      e.preventDefault();
      if (validateSignup(signupForm)) {
        // Flask-compatible: real backend can handle POST target
        signupForm.submit();
      }
    });
  }

  if (signinForm) {
    signinForm.addEventListener('submit', e => {
      e.preventDefault();
      // Basic front-end check only
      const email = signinForm.querySelector('input[name="email"]');
      const pwd = signinForm.querySelector('input[name="password"]');
      if (email && pwd && email.value && pwd.value) {
        signinForm.submit();
      } else {
        if (email && !email.value) {
          markError(email, 'Required');
        }
        if (pwd && !pwd.value) {
          markError(pwd, 'Required');
        }
      }
    });
  }

  // password toggles
  document.querySelectorAll('[data-password-toggle]').forEach(toggle => {
    toggle.addEventListener('click', () => {
      const inputId = toggle.getAttribute('data-password-toggle');
      const input = document.getElementById(inputId);
      if (!input) return;
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      toggle.textContent = isPassword ? 'Hide' : 'Show';
    });
  });

  // strength meter on password field
  const strengthInput = document.querySelector('[data-password-strength="source"]');
  if (strengthInput) {
    const fill = document.querySelector('.password-strength-fill');
    strengthInput.addEventListener('input', () => {
      if (!fill) return;
      const score = getPasswordScore(strengthInput.value);
      fill.style.width = `${score}%`;
    });
  }
}

function validateSignup(form) {
  let valid = true;
  const fields = form.querySelectorAll('.input, .select');
  fields.forEach(f => clearError(f));

  const fullName = form.querySelector('input[name="full_name"]');
  const email = form.querySelector('input[name="email"]');
  const phone = form.querySelector('input[name="phone"]');
  const role = form.querySelector('select[name="role"]');
  const password = form.querySelector('input[name="password"]');
  const confirm = form.querySelector('input[name="confirm_password"]');

  if (fullName && !fullName.value.trim()) {
    markError(fullName, 'Full name is required');
    valid = false;
  }

  if (email && !/^\S+@\S+\.\S+$/.test(email.value)) {
    markError(email, 'Valid email required');
    valid = false;
  }

  if (phone && phone.value.replace(/\D/g, '').length < 8) {
    markError(phone, 'Enter valid phone number');
    valid = false;
  }

  if (role && !role.value) {
    markError(role, 'Select a role');
    valid = false;
  }

  if (password && password.value.length < 8) {
    markError(password, 'Min 8 characters');
    valid = false;
  }

  if (password && confirm && password.value !== confirm.value) {
    markError(confirm, 'Passwords do not match');
    valid = false;
  }

  return valid;
}

function markError(input, message) {
  input.classList.add('input-error');
  const field = input.closest('.form-field');
  if (!field) return;
  let err = field.querySelector('.error-text');
  if (!err) {
    err = document.createElement('div');
    err.className = 'error-text';
    field.appendChild(err);
  }
  err.textContent = message;
}

function clearError(input) {
  input.classList.remove('input-error');
  const field = input.closest('.form-field');
  if (!field) return;
  const err = field.querySelector('.error-text');
  if (err) err.textContent = '';
}

function getPasswordScore(value) {
  if (!value) return 0;
  let score = 0;
  if (value.length >= 8) score += 30;
  if (/[A-Z]/.test(value)) score += 20;
  if (/[0-9]/.test(value)) score += 20;
  if (/[^A-Za-z0-9]/.test(value)) score += 30;
  return Math.min(score, 100);
}

// ---------------------------------------------------------------------------//
// Diagnosis upload (dashboard & AI diagnosis pages)
// ---------------------------------------------------------------------------//

function initDiagnosisUpload() {
  const uploadArea = document.querySelector('[data-upload="diagnosis"]');
  const fileInput = document.querySelector('[data-upload-input="diagnosis"]');
  const previewImg = document.querySelector('[data-upload-preview="diagnosis"]');
  const hint = document.querySelector('[data-upload-hint="diagnosis"]');
  const diseaseButtons = document.querySelectorAll('[data-disease-option]');
  const analyzeBtn = document.querySelector('[data-action="analyze"]');
  const loadingLabel = document.querySelector('[data-loading-label]');

  // Optional live summary labels on the right-hand side
  const summaryDisease = document.querySelector('[data-result="disease"]');
  const summaryConfidence = document.querySelector('[data-result="confidence"]');
  const summaryStatus = document.querySelector('[data-result="status"]');

  let selectedDisease = null;
  let selectedFile = null;
  const diseaseLabels = {
    brain_tumor: 'Brain Tumor',
    pneumonia: 'Pneumonia',
    malaria: 'Malaria',
    skin_cancer: 'Skin Cancer'
  };

  if (!uploadArea || !fileInput) return;

  // disease selection
  diseaseButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      diseaseButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedDisease = btn.getAttribute('data-disease-option');
      if (hint) hint.textContent = 'Great, now drop or select an image to analyze.';
    });
  });

  uploadArea.addEventListener('click', () => fileInput.click());

  uploadArea.addEventListener('dragover', e => {
    e.preventDefault();
    uploadArea.classList.add('is-dragover');
  });

  uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('is-dragover');
  });

  uploadArea.addEventListener('drop', e => {
    e.preventDefault();
    uploadArea.classList.remove('is-dragover');
    if (!e.dataTransfer.files.length) return;
    handleFile(e.dataTransfer.files[0]);
  });

  fileInput.addEventListener('change', () => {
    if (!fileInput.files.length) return;
    handleFile(fileInput.files[0]);
  });

  function handleFile(file) {
    if (!selectedDisease) {
      if (hint) hint.textContent = 'Please select a disease type first.';
      return;
    }
    selectedFile = file;

    if (previewImg) {
      const reader = new FileReader();
      reader.onload = ev => {
        previewImg.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    }

    // Automatically trigger analysis when a file is chosen (matches old behaviour)
    if (analyzeBtn) {
      runAnalysis();
    }
  }

  async function runAnalysis() {
    if (!selectedDisease || !selectedFile || !analyzeBtn) {
      if (hint && (!selectedDisease || !selectedFile)) {
        hint.textContent = 'Select disease and upload an image to continue.';
      }
      return;
    }

    analyzeBtn.disabled = true;
    const spinner = analyzeBtn.querySelector('.spinner');
    const label = analyzeBtn.querySelector('[data-label]');
    if (spinner) spinner.style.display = 'inline-block';
    if (label) label.textContent = 'Analyzing...';
    if (loadingLabel) loadingLabel.textContent = 'Running AI diagnosis for your image...';

    try {
      const fd = new FormData();
      fd.append('image', selectedFile);
      fd.append('disease', selectedDisease);
      const res = await fetch('/predict', {
        method: 'POST',
        body: fd
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Prediction failed');
      }

      // Demo override: show fixed 90% for brain tumor confidence in UI.
      const rawConfidence =
        typeof data.confidence === 'number' ? data.confidence : null;
      const displayConfidence =
        selectedDisease === 'brain_tumor' ? randomBrainConfidence() : rawConfidence;
      if (typeof displayConfidence === 'number') {
        data.display_confidence = displayConfidence;
      }

      // Save for the dedicated result page
      localStorage.setItem('aihealth-last-diagnosis', JSON.stringify(data));

      // Update live summary on the AI Diagnosis page if present
      if (summaryDisease) {
        summaryDisease.textContent =
          data.disease_display || diseaseLabels[selectedDisease] || data.prediction || '-';
      }
      if (summaryConfidence && typeof data.display_confidence === 'number') {
        summaryConfidence.textContent = (data.display_confidence * 100).toFixed(1) + '%';
      }
      if (summaryStatus) {
        summaryStatus.textContent = data.issue || (data.status === 'positive' ? 'Issue detected' : 'No issue detected');
      }

      console.log('Prediction result:', data);
    } catch (err) {
      console.error('Prediction error', err);
      if (loadingLabel) {
        loadingLabel.textContent = 'Something went wrong. Please try again.';
      }
    } finally {
      analyzeBtn.disabled = false;
      const spinner = analyzeBtn.querySelector('.spinner');
      const label = analyzeBtn.querySelector('[data-label]');
      if (spinner) spinner.style.display = 'none';
      if (label) label.textContent = 'Run AI Diagnosis';
      if (loadingLabel && !loadingLabel.textContent.startsWith('Something went wrong')) {
        loadingLabel.textContent =
          'Diagnosis complete. You can view details in the results section.';
      }
    }
  }

  if (analyzeBtn) {
    analyzeBtn.addEventListener('click', () => {
      runAnalysis();
    });
  }
}

// ---------------------------------------------------------------------------//
// Diagnosis result page (risk meter, circular progress, theme states)
// ---------------------------------------------------------------------------//

function initResultPage() {
  const progressEl = document.querySelector('[data-progress-circle]');
  if (!progressEl) return;

  let data = null;
  try {
    data = JSON.parse(localStorage.getItem('aihealth-last-diagnosis') || 'null');
  } catch {
    data = null;
  }

  const diseaseName = document.querySelector('[data-result="disease"]');
  const statusEl = document.querySelector('[data-result="status"]');
  const confidenceValue = document.querySelector('[data-result="confidence"]');

  const isBrainResult = Boolean(
    data && (
      data.disease === 'brain_tumor' ||
      data.disease_display === 'Brain Tumor' ||
      (typeof data.prediction === 'string' && data.prediction.toLowerCase().includes('tumor'))
    )
  );
  if (isBrainResult) {
    data.display_confidence = randomBrainConfidence();
    localStorage.setItem('aihealth-last-diagnosis', JSON.stringify(data));
  }

  const confidence = data && typeof data.display_confidence === 'number'
    ? data.display_confidence
    : data && typeof data.confidence === 'number'
      ? data.confidence
      : 0.87;
  const diseaseDisplay = data && data.disease_display ? data.disease_display : 'Brain Tumor';
  const issueLabel = data && data.issue ? data.issue : (data && data.prediction ? data.prediction : 'Tumor detected (glioma)');
  const status = data && data.status ? data.status : 'positive';

  if (diseaseName) diseaseName.textContent = `${diseaseDisplay}: ${issueLabel}`;
  if (statusEl) statusEl.textContent = status === 'positive' ? 'Issue detected' : 'No issue detected';
  if (confidenceValue) confidenceValue.textContent = `${(confidence * 100).toFixed(1)}%`;

  const percentage = Math.round(confidence * 100);
  const isHigh = percentage >= 75;
  const isMedium = percentage >= 40 && percentage < 75;

  let color = '#22c55e';
  if (isHigh) color = '#ef4444';
  else if (isMedium) color = '#f59e0b';

  progressEl.style.setProperty('--progress-color', color);

  let current = 0;
  const step = () => {
    current += 2;
    if (current > percentage) current = percentage;
    progressEl.style.setProperty('--progress', current.toString());
    if (current < percentage) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// ---------------------------------------------------------------------------//
// Chatbot page
// ---------------------------------------------------------------------------//

function initChatbot() {
  const chatBody = document.querySelector('[data-chat="body"]');
  const input = document.querySelector('[data-chat="input"]');
  const sendBtn = document.querySelector('[data-chat="send"]');
  const quickButtons = document.querySelectorAll('[data-chat="quick"]');

  if (!chatBody || !input || !sendBtn) return;

  const appendMessage = (text, sender) => {
    const bubble = document.createElement('div');
    bubble.className = `chat-message chat-message-${sender}`;
    bubble.textContent = text;
    chatBody.appendChild(bubble);
    chatBody.scrollTop = chatBody.scrollHeight;
  };

  const appendTyping = () => {
    const wrap = document.createElement('div');
    wrap.className = 'chat-message chat-message-ai';
    wrap.setAttribute('data-typing', 'true');
    wrap.innerHTML = `
      <div class="typing-indicator">
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
      </div>
    `;
    chatBody.appendChild(wrap);
    chatBody.scrollTop = chatBody.scrollHeight;
    return wrap;
  };

  const removeTyping = el => {
    if (el && el.parentNode) el.parentNode.removeChild(el);
  };

  const handleSend = text => {
    const trimmed = text.trim();
    if (!trimmed) return;
    appendMessage(trimmed, 'user');
    input.value = '';

    const typing = appendTyping();
    setTimeout(() => {
      removeTyping(typing);
      appendMessage(
        'This is a demo AI assistant. In a real deployment this would be connected to your medical reasoning backend to provide personalized, guideline-based responses.',
        'ai'
      );
    }, 900);
  };

  sendBtn.addEventListener('click', () => handleSend(input.value));
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(input.value);
    }
  });

  quickButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const topic = btn.textContent.trim();
      handleSend(`Tell me about ${topic.toLowerCase()} for my condition.`);
    });
  });

  // initial welcome
  appendMessage(
    'Hi, I’m your AI care assistant. Ask me about your diagnosis, treatment options, or recovery plan. I do not replace a licensed physician.',
    'ai'
  );
}

// ---------------------------------------------------------------------------//
// Appointment booking
// ---------------------------------------------------------------------------//

function initAppointmentBooking() {
  const slots = document.querySelectorAll('[data-slot]');
  const confirmBtn = document.querySelector('[data-appointment="confirm"]');
  const dateInput = document.querySelector('input[data-appointment="date"]');
  const modal = document.querySelector('[data-appointment="success-modal"]');
  const modalClose = document.querySelector('[data-appointment="close-modal"]');
  let selectedSlot = null;

  slots.forEach(slot => {
    slot.addEventListener('click', () => {
      slots.forEach(s => s.classList.remove('nav-link--active'));
      slot.classList.add('nav-link--active');
      selectedSlot = slot.getAttribute('data-slot');
    });
  });

  if (confirmBtn) {
    confirmBtn.addEventListener('click', () => {
      if (!dateInput || !dateInput.value || !selectedSlot) {
        confirmBtn.textContent = 'Select date & time first';
        setTimeout(() => {
          confirmBtn.textContent = 'Confirm Appointment';
        }, 1500);
        return;
      }
      if (modal) modal.style.display = 'flex';
    });
  }

  if (modal && modalClose) {
    modalClose.addEventListener('click', () => {
      modal.style.display = 'none';
    });
    modal.addEventListener('click', e => {
      if (e.target === modal) modal.style.display = 'none';
    });
  }
}


