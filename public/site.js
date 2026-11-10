const slider = document.querySelector('[data-slider]');
document.querySelectorAll('[data-slide]').forEach(button => button.addEventListener('click', () => {
  const width = slider.firstElementChild.getBoundingClientRect().width;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  slider.scrollBy({ left: Number(button.dataset.slide) * (width + 16), behavior: reduced ? 'instant' : 'smooth' });
}));

document.querySelectorAll('[data-lock]').forEach(form => {
  const button = form.querySelector('button[type=submit]');
  const original = button.innerHTML;
  const feedback = form.querySelector('#form-feedback');
  const { name, phone, category, answer } = form.elements;
  const clearErrors = () => {
    for (const field of form.querySelectorAll('[aria-invalid]')) {
      field.removeAttribute('aria-invalid');
      field.removeAttribute('aria-describedby');
    }
    feedback.hidden = true;
  };
  form.addEventListener('input', clearErrors);
  form.addEventListener('submit', event => {
    if (button.disabled) return event.preventDefault();
    clearErrors();
    const invalid = [
      [name, name.value.trim().length >= 2],
      [phone, /^(?:\+998)?\d{9}$/.test(phone.value.trim().replace(/[ ()-]/g,''))],
      [category, Boolean(category.value)],
      [answer, /^\d{1,2}$/.test(answer.value.trim())]
    ].filter(([, valid]) => !valid).map(([field]) => field);
    if (invalid.length) {
      event.preventDefault();
      feedback.textContent = invalid[0] === answer ? form.dataset.captcha : form.dataset.invalid;
      feedback.hidden = false;
      invalid.forEach(field => {
        field.setAttribute('aria-invalid','true');
        field.setAttribute('aria-describedby',feedback.id);
      });
      invalid[0].focus();
      return;
    }
    button.disabled = true;
    button.textContent = form.dataset.sending;
  });
  window.addEventListener('pageshow', () => {
    button.disabled = false;
    button.innerHTML = original;
  });
});

const header = document.querySelector('.agency .site-header');
if (header) {
  const setHeader = () => header.classList.toggle('is-scrolled', window.scrollY > 12);
  setHeader();
  window.addEventListener('scroll', setHeader, { passive: true });
}

if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const reveal = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-revealed');
      reveal.unobserve(entry.target);
    }
  }, { threshold: .08 });
  document.querySelectorAll('.agency .section h2, .agency .section .card, .agency .strengths article, .agency .partner-card').forEach(element => reveal.observe(element));
}

document.querySelectorAll('[data-confirm]').forEach(button => button.addEventListener('click', event => {
  if (!window.confirm(button.dataset.confirm)) event.preventDefault();
}));

function imageBlob(canvas, quality) {
  return new Promise(resolve => canvas.toBlob(resolve,'image/webp',quality));
}

function asBase64(blob) {
  return new Promise((resolve,reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function optimize(file) {
  if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 12_000_000) {
    throw new Error('Choose a PNG, JPEG or WebP under 12 MB.');
  }
  const image = await createImageBitmap(file);
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    for (const size of [1800,1400,1000,720]) {
      const scale = Math.min(1,size/Math.max(image.width,image.height));
      canvas.width = Math.max(1,Math.round(image.width*scale));
      canvas.height = Math.max(1,Math.round(image.height*scale));
      ctx.drawImage(image,0,0,canvas.width,canvas.height);
      const blob = await imageBlob(canvas,.82);
      if (blob?.type === 'image/webp' && blob.size <= 450_000) return await asBase64(blob);
    }
    throw new Error('This browser could not optimize the image. Try a smaller image or a browser with WebP encoding.');
  } finally {
    image.close();
  }
}

document.querySelectorAll('[data-image-form]').forEach(form => {
  const input = form.querySelector('[data-image]');
  if (!input) return;
  let ready = false;
  let busy = false;
  form.addEventListener('submit', async event => {
    if (event.submitter?.value === 'delete' || ready || !input.files.length) return;
    event.preventDefault();
    if (busy) return;
    busy = true;
    const feedback = form.querySelector('[data-image-error]');
    feedback.hidden = true;
    const submitter = event.submitter;
    if (submitter) submitter.disabled = true;
    try {
      form.elements.upload.value = await optimize(input.files[0]);
      ready = true;
    } catch (error) {
      feedback.textContent = error.message || 'Unable to process this image.';
      feedback.hidden = false;
    } finally {
      busy = false;
      if (submitter) submitter.disabled = false;
    }
    if (ready) form.requestSubmit(submitter || undefined);
  });
});
