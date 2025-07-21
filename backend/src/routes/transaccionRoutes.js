const express = require('express');
const router = express.Router();
const transaccionController = require('../controllers/transaccionController');

router.post('/transferencia', transaccionController.realizarTransferencia);
router.post('/deposito', transaccionController.realizarDeposito);
router.post('/avance', transaccionController.realizarAvanceTarjeta);
router.post('/pago-cuota', transaccionController.pagarCuotaAvance);
router.get('/', transaccionController.getTransacciones); // Para el historial
router.get('/avances-pendientes/:clienteId', transaccionController.getAvancesPendientesByCliente); // Ruta para el frontend
router.get('/avance/:id', transaccionController.getAvanceById);

module.exports = router;