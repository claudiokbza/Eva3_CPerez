const contactoModel = require('../models/contactoModel');
const clienteModel = require('../models/clienteModel'); // Para verificar si la cuenta destino existe

exports.getContactosByCliente = async (req, res) => {
    const { clienteId } = req.params;
    try {
        const contactos = await contactoModel.getContactosByClienteId(clienteId);
        res.status(200).json(contactos);
    } catch (error) {
        console.error('Error al obtener contactos:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

exports.addContacto = async (req, res) => {
    const { clienteId } = req.params;
    const { nombre, numeroCuenta } = req.body;

    if (!nombre || !numeroCuenta) {
        return res.status(400).json({ message: 'Nombre y número de cuenta son requeridos.' });
    }

    const containsNumber = /\d/; // Expresión regular que busca cualquier dígito (0-9)
    if (containsNumber.test(nombre)) {
        return res.status(400).json({ message: 'El nombre del contacto no debe contener números.' });
    }

    try {
        const newContactoId = await contactoModel.addContacto(clienteId, nombre, numeroCuenta);
        // Para devolver el contacto completo al frontend, podrías recuperarlo de la DB
        const newContacto = { id: newContactoId, cliente_id: clienteId, nombre, numero_cuenta: numeroCuenta };
        res.status(201).json({ message: 'Contacto agregado exitosamente.', contacto: newContacto });
    } catch (error) {
        console.error('Error al agregar contacto (detalle):', error); // Esto nos ayudará a ver el objeto de error completo, incluyendo 'error.code'

        // 1. Manejar errores personalizados de tu modelo (como "no corresponde" o "ya está registrado")
        if (error.message && (error.message.includes('ya está registrado') || error.message.includes('no corresponde'))) {
            return res.status(400).json({ message: error.message });
        }

        // 2. Manejar errores específicos de MySQL, como duplicidad (ER_DUP_ENTRY)
        if (error.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ message: 'Este contacto ya existe para este cliente o la cuenta ya está registrada.' });
        }

        // 3. Si no es ninguno de los anteriores, es un error interno genérico
        res.status(500).json({ message: error.message || 'Error interno del servidor al agregar contacto.' });
        
    }
};

exports.deleteContacto = async (req, res) => {
    const { clienteId, contactoId } = req.params;
    try {
        const affectedRows = await contactoModel.deleteContacto(contactoId, clienteId);
        if (affectedRows === 0) {
        return res.status(404).json({ message: 'Contacto no encontrado o no pertenece a este cliente.' });
        }
        res.status(200).json({ message: 'Contacto eliminado exitosamente.' });
    } catch (error) {
        console.error('Error al eliminar contacto:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
};