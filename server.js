// ── DEPENDENCIAS ──
const express    = require('express');
const cors       = require('cors');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();



// ── INICIALIZAR APP ──
const app  = express();
const PORT = process.env.PORT || 3000;

// ── MIDDLEWARES ──
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// ── CONEXIÓN A SUPABASE ──
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// ── CONEXIÓN A BREVO ──
const { BrevoClient } = require('@getbrevo/brevo');
const brevo = new BrevoClient({ apiKey: process.env.BREVO_API_KEY });

// ── FUNCIÓN: ENVIAR SECUENCIA DE 3 EMAILS ──
async function enviarSecuenciaEmails(nombre, email, tratamiento) {

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

  console.log(`📧 Secuencia de 3 emails enviada a ${email}`);
}

// ── RUTA: RECIBIR LEAD DEL FORMULARIO ──
app.post('/api/lead', async (req, res) => {
  const { nombre, email, telefono, tratamiento } = req.body;

  if (!nombre || !email || !telefono || !tratamiento) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios' });
  }

  // Guardar en Supabase
  const { data, error } = await supabase
    .from('leads')
    .insert([{ nombre, email, telefono, tratamiento }]);

  if (error) {
    console.error('Error Supabase:', error.message);
    return res.status(500).json({ error: 'Error al guardar el lead' });
  }

  console.log('✅ Nuevo lead guardado:', nombre, email);

  // Enviar secuencia de emails
  try {
    await enviarSecuenciaEmails(nombre, email, tratamiento);
  } catch (emailError) {
    console.error('Error Brevo:', emailError.message);
    // No falla la request si el email falla — el lead ya quedó guardado
  }

  res.status(200).json({ ok: true, mensaje: 'Lead guardado y emails enviados' });
});

// ── INICIAR SERVIDOR ──
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});