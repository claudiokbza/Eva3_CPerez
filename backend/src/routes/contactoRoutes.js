const express = require('express');
const router = express.Router();
const contactoController = require('../controllers/contactoController');

// Rutas para contactos anidadas bajo un cliente específico
router.get('/:clienteId/contactos', contactoController.getContactosByCliente);
router.post('/:clienteId/contactos', contactoController.addContacto);
router.delete('/:clienteId/contactos/:contactoId', contactoController.deleteContacto);

module.exports = router;