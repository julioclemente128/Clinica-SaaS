// ── DEPENDENCIAS ──
const express    = require('express');
const cors       = require('cors');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// ── INICIALIZAR APP ──
const app  = express();
const PORT = process.env.PORT || 3000;

// ── MIDDLEWARES ──
// Permite que el formulario HTML envíe datos al servidor
app.use(cors());
// Permite leer JSON en el body de las requests
app.use(express.json());
// Sirve los archivos estáticos (index.html, styles.css)
app.use(express.static('.'));

// ── CONEXIÓN A SUPABASE ──
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// ── RUTA: RECIBIR LEAD DEL FORMULARIO ──
app.post('/api/lead', async (req, res) => {
  // 1. Extraer los datos que vienen del formulario
  const { nombre, email, telefono, tratamiento } = req.body;

  // 2. Validación básica en el servidor
  if (!nombre || !email || !telefono || !tratamiento) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios' });
  }

  // 3. Guardar el lead en Supabase
  const { data, error } = await supabase
    .from('leads')
    .insert([{ nombre, email, telefono, tratamiento }]);

  if (error) {
    console.error('Error Supabase:', error.message);
    return res.status(500).json({ error: 'Error al guardar el lead' });
  }

  console.log('✅ Nuevo lead guardado:', nombre, email);

  // 4. Responder al formulario que todo salió bien
  res.status(200).json({ ok: true, mensaje: 'Lead guardado correctamente' });
});

// ── INICIAR SERVIDOR ──
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});