const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const rateLimit  = require('express-rate-limit');
const he         = require('he');
const path       = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app  = express();
const PORT = process.env.PORT || 3000;

// ── SEGURIDAD: cabeceras HTTP ──
app.use(helmet());

// ── SEGURIDAD: CORS solo para orígenes conocidos ──
const allowedOrigins = [
  'https://clinica-lumina.vercel.app',
  'http://localhost:3000',
];
app.use(cors({
  origin: allowedOrigins,
  methods: ['POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
}));

// ── MIDDLEWARES ──
app.use(express.json({ limit: '4kb' }));
app.use(express.static(path.join(__dirname, 'frontend')));

// ── CONEXIÓN A SUPABASE ──
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// ── CONEXIÓN A BREVO ──
const { BrevoClient } = require('@getbrevo/brevo');
const brevo = new BrevoClient({ apiKey: process.env.BREVO_API_KEY });

// ── SEGURIDAD: rate limiting en el endpoint de leads ──
const leadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Demasiadas solicitudes. Intenta de nuevo en 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── VALIDACIÓN ──
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_LEN = 200;
const TRATAMIENTOS_PERMITIDOS = ['hydrafacial', 'biorevitalizacion', 'peeling', 'otro'];

// ── FUNCIÓN: ENVIAR SECUENCIA DE 3 EMAILS ──
async function enviarSecuenciaEmails(nombre, email, tratamiento) {
  // nombre y tratamiento ya vienen sanitizados con he.encode()
  const emails = [
    {
      subject: `${nombre}, tu consulta en Clínica Lumina está confirmada`,
      htmlContent: `
        <div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
          <p style="font-size: 13px; letter-spacing: 3px; text-transform: uppercase; color: #999;">Clínica Lumina</p>
          <h1 style="font-size: 28px; font-weight: 600; margin: 24px 0 16px;">Hola, ${nombre}.</h1>
          <p style="font-size: 16px; line-height: 1.8; color: #444;">
            Recibimos tu solicitud de consulta gratuita para <strong>${tratamiento}</strong>.
          </p>
          <p style="font-size: 16px; line-height: 1.8; color: #444;">
            Uno de nuestros especialistas se va a contactar contigo en las próximas 24 horas para coordinar tu evaluación sin costo ni compromiso.
          </p>
          <p style="font-size: 16px; line-height: 1.8; color: #444;">
            Mientras tanto, si tienes alguna pregunta puedes responder directamente a este correo.
          </p>
          <p style="margin-top: 40px; font-size: 14px; color: #999;">— Equipo Clínica Lumina</p>
        </div>
      `
    },
    {
      subject: `¿Sabías esto sobre ${tratamiento}, ${nombre}?`,
      htmlContent: `
        <div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
          <p style="font-size: 13px; letter-spacing: 3px; text-transform: uppercase; color: #999;">Clínica Lumina</p>
          <h1 style="font-size: 28px; font-weight: 600; margin: 24px 0 16px;">Lo que nadie te cuenta sobre ${tratamiento}.</h1>
          <p style="font-size: 16px; line-height: 1.8; color: #444;">
            Muchas personas llegan a nuestra clínica con dudas sobre si el tratamiento es para ellas. Es completamente normal.
          </p>
          <p style="font-size: 16px; line-height: 1.8; color: #444;">
            Por eso nuestra primera consulta es 100% gratuita — para que puedas hacer todas las preguntas que necesitas antes de tomar cualquier decisión.
          </p>
          <p style="font-size: 16px; line-height: 1.8; color: #444;">
            Sin presión, sin compromiso. Solo información honesta de nuestra parte.
          </p>
          <p style="margin-top: 40px; font-size: 14px; color: #999;">— Equipo Clínica Lumina</p>
        </div>
      `
    },
    {
      subject: `${nombre}, ¿pudiste agendar tu consulta?`,
      htmlContent: `
        <div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
          <p style="font-size: 13px; letter-spacing: 3px; text-transform: uppercase; color: #999;">Clínica Lumina</p>
          <h1 style="font-size: 28px; font-weight: 600; margin: 24px 0 16px;">Solo queríamos saber cómo estás, ${nombre}.</h1>
          <p style="font-size: 16px; line-height: 1.8; color: #444;">
            Hace unos días solicitaste información sobre <strong>${tratamiento}</strong> en Clínica Lumina.
          </p>
          <p style="font-size: 16px; line-height: 1.8; color: #444;">
            Si todavía no has podido agendar, este es el momento. Tenemos disponibilidad esta semana y nos encantaría conocerte.
          </p>
          <p style="font-size: 16px; line-height: 1.8; color: #444;">
            Responde este correo o llámanos directamente — estamos para ayudarte.
          </p>
          <p style="margin-top: 40px; font-size: 14px; color: #999;">— Equipo Clínica Lumina</p>
        </div>
      `
    }
  ];

  for (const emailData of emails) {
    await brevo.transactionalEmails.sendTransacEmail({
      sender: { name: 'Clínica Lumina', email: process.env.SENDER_EMAIL },
      to: [{ email, name: nombre }],
      subject: emailData.subject,
      htmlContent: emailData.htmlContent
    });
  }

  console.log('📧 Secuencia de emails enviada');
}

// ── RUTA: RECIBIR LEAD DEL FORMULARIO ──
app.post('/api/lead', leadLimiter, async (req, res) => {
  const { nombre, email, telefono, tratamiento, website } = req.body;

  // Honeypot: campo oculto que solo rellenan los bots
  if (website) {
    return res.status(200).json({ ok: true, mensaje: 'Lead guardado y emails enviados' });
  }

  if (!nombre || typeof nombre !== 'string' || nombre.trim().length === 0 || nombre.length > MAX_LEN) {
    return res.status(400).json({ error: 'Nombre inválido' });
  }
  if (!email || !EMAIL_REGEX.test(email) || email.length > MAX_LEN) {
    return res.status(400).json({ error: 'Email inválido' });
  }
  if (!telefono || typeof telefono !== 'string' || telefono.trim().length === 0 || telefono.length > 30) {
    return res.status(400).json({ error: 'Teléfono inválido' });
  }
  if (!TRATAMIENTOS_PERMITIDOS.includes(tratamiento)) {
    return res.status(400).json({ error: 'Tratamiento no válido' });
  }

  // Sanitizar antes de insertar en BD y embeber en HTML de emails
  const safeNombre      = he.encode(nombre.trim());
  const safeTratamiento = he.encode(tratamiento);

  const { data, error } = await supabase
    .from('leads')
    .insert([{ nombre: safeNombre, email, telefono: telefono.trim(), tratamiento }]);

  if (error) {
    console.error('Error Supabase:', error.message);
    return res.status(500).json({ error: 'Error al guardar el lead' });
  }

  console.log('✅ Nuevo lead guardado');

  try {
    await enviarSecuenciaEmails(safeNombre, email, safeTratamiento);
  } catch (emailError) {
    console.error('Error Brevo:', emailError.message);
  }

  res.status(200).json({ ok: true, mensaje: 'Lead guardado y emails enviados' });
});

// ── INICIAR SERVIDOR ──
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
