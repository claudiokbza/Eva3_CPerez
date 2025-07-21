const express = require('express');
const cors = require('cors');
require('dotenv').config(); // Cargar variables de entorno al inicio
const clienteRoutes = require('./src/routes/clienteRoutes');
const contactoRoutes = require('./src/routes/contactoRoutes');
const transaccionRoutes = require('./src/routes/transaccionRoutes');
const transaccionController = require('./src/controllers/transaccionController'); // Para la tarea programada

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors()); // Habilitar CORS para que React pueda comunicarse
app.use(express.json()); // Habilitar el parseo de JSON en el cuerpo de las solicitudes

// Rutas
app.use('/api/clientes', clienteRoutes);
app.use('/api/clientes', contactoRoutes); // Contactos están anidados bajo clientes
app.use('/api/transacciones', transaccionRoutes);

// Ruta de prueba
app.get('/', (req, res) => {
    res.send('API del Banco INACAPINO funcionando!');
});

// Tarea programada para chequear y penalizar líneas de crédito
// Para pruebas, puedes usar un setInterval. En producción, usarías un cron job.
// Intervalo de 24 horas (24 * 60 * 60 * 1000 ms)
// ¡ADVERTENCIA: Para desarrollo, puedes ponerlo cada X minutos, pero ten cuidado con la frecuencia!
// setInterval(transaccionController.checkAndPenalizeInactiveCreditLines, 24 * 60 * 60 * 1000);
// console.log('Tarea de chequeo de penalización programada.');

// Iniciar el servidor
app.listen(PORT, () => {
    console.log(`Servidor de backend corriendo en http://localhost:${PORT}`);
});