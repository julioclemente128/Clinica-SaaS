const CLINIC_SLUG = 'lumina';
const form = document.querySelector('#formulario form');
const btn  = form.querySelector('button[type="submit"]');

// ── Validación básica ──
function validar() {
  const nombre      = document.getElementById('nombre').value.trim();
  const email       = document.getElementById('email').value.trim();
  const telefono    = document.getElementById('telefono').value.trim();
  const tratamiento = document.getElementById('tratamiento').value;
  const emailRegex  = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!nombre) {
    mostrarError('nombre', 'Ingresa tu nombre completo');
    return false;
  }
  if (!email || !emailRegex.test(email)) {
    mostrarError('email', 'Ingresa un correo válido');
    return false;
  }
  if (!telefono) {
    mostrarError('telefono', 'Ingresa tu número de teléfono');
    return false;
  }
  if (!tratamiento) {
    mostrarError('tratamiento', 'Selecciona un tratamiento');
    return false;
  }
  return true;
}

function mostrarError(campoId, mensaje) {
  limpiarErrores();
  const campo = document.getElementById(campoId);
  campo.style.borderColor = '#c0392b';
  campo.focus();

  const error = document.createElement('span');
  error.className = 'campo-error';
  error.textContent = mensaje;
  campo.parentElement.appendChild(error);
}

function limpiarErrores() {
  document.querySelectorAll('.campo-error').forEach(e => e.remove());
  document.querySelectorAll('#formulario input, #formulario select').forEach(el => {
    el.style.borderColor = '';
  });
}

// ── Submit handler ──
form.addEventListener('submit', function(e) {
  e.preventDefault();   // evita el reload de página
  limpiarErrores();

  if (!validar()) return;

  const nombre      = document.getElementById('nombre').value.trim();
  const email       = document.getElementById('email').value.trim();
  const telefono    = document.getElementById('telefono').value.trim();
  const tratamiento = document.getElementById('tratamiento').value;
  const website     = document.getElementById('website').value;

  // Estado de carga
  btn.disabled = true;
  btn.textContent = 'Enviando...';

  fetch('https://clinica-saas-production-f678.up.railway.app/api/lead', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre, email, telefono, tratamiento, website, slug: CLINIC_SLUG })
  })
  .then(function(res) { return res.json(); })
  .then(function(data) {
    if (data.ok) {
      mostrarExito();
    } else {
      btn.disabled = false;
      btn.textContent = 'Quiero mi consulta gratuita';
      alert('Hubo un error. Intenta de nuevo.');
    }
  })
  .catch(function() {
    btn.disabled = false;
    btn.textContent = 'Quiero mi consulta gratuita';
    alert('Error de conexión. Intenta de nuevo.');
  });
});

// ── Estado de éxito ──
function mostrarExito() {
  form.innerHTML = `
    <div class="form-exito">
      <div class="exito-icono">✓</div>
      <h3>¡Solicitud recibida!</h3>
      <p>Te contactaremos en menos de 24 horas para coordinar tu consulta gratuita.</p>
    </div>
  `;
}

// Limpiar error al escribir
document.querySelectorAll('#formulario input, #formulario select').forEach(el => {
  el.addEventListener('input', function() {
    this.style.borderColor = '';
    const error = this.parentElement.querySelector('.campo-error');
    if (error) error.remove();
  });
});
