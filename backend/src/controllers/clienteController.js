const clienteModel = require('../models/clienteModel');
const { validateRun } = require('../utils/runValidator');

exports.createCliente = async (req, res) => {
    const { nombre, apellido, run, montoInicial } = req.body;

    if (!nombre || !apellido || !run || montoInicial === undefined || parseInt(montoInicial) < 0) {
        return res.status(400).json({ message: 'Todos los campos son requeridos y el monto inicial debe ser un numero entero positivo.' });
    }
    if (!validateRun(run)) {
        return res.status(400).json({ message: 'El formato del RUN no es válido.' });
    }

    // --- NUEVAS VALIDACIONES PARA NOMBRE Y APELLIDO ---
    // Expresión regular para verificar que NO contenga dígitos (0-9)
    const containsNumber = /\d/;
    if (containsNumber.test(nombre)) {
        return res.status(400).json({ message: 'El nombre no debe contener números.' });
    }
    if (containsNumber.test(apellido)) {
        return res.status(400).json({ message: 'El apellido no debe contener números.' });
    }
    // --- FIN NUEVAS VALIDACIONES ---

    try {
        const newClienteId = await clienteModel.createCliente(nombre, apellido, run, parseInt(montoInicial));
        res.status(201).json({ message: 'Cliente creado exitosamente.', id: newClienteId });
    } catch (error) {
        console.error('Error al crear cliente:', error);
        if (error.message.includes('Duplicate entry')) {
        return res.status(409).json({ message: 'El RUN o número de cuenta ya existe.' });
        }
        res.status(500).json({ message: 'Error interno del servidor al crear cliente.' });
    }
};

exports.getClientes = async (req, res) => {
    try {
        const clientes = await clienteModel.getAllClientes();
        res.status(200).json(clientes);
    } catch (error) {
        console.error('Error al obtener clientes:', error);
        res.status(500).json({ message: 'Error interno del servidor al obtener clientes.' });
    }
};

exports.getClienteById = async (req, res) => {
    const { id } = req.params;
    try {
        const cliente = await clienteModel.getClienteById(id);
        if (!cliente) {
        return res.status(404).json({ message: 'Cliente no encontrado.' });
        }
        res.status(200).json(cliente);
    } catch (error) {
        console.error('Error al obtener cliente por ID:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

exports.updateCliente = async (req, res) => {
    const { id } = req.params;
    const { nombre, apellido } = req.body;

    if (!nombre || !apellido) {
        return res.status(400).json({ message: 'Nombre y apellido son requeridos para la actualización.' });
    }

    // --- NUEVAS VALIDACIONES PARA NOMBRE Y APELLIDO EN UPDATE ---
    const containsNumber = /\d/;
    if (containsNumber.test(nombre)) {
        return res.status(400).json({ message: 'El nombre no debe contener números.' });
    }
    if (containsNumber.test(apellido)) {
        return res.status(400).json({ message: 'El apellido no debe contener números.' });
    }
    // --- FIN NUEVAS VALIDACIONES ---

    try {
        const affectedRows = await clienteModel.updateCliente(id, nombre, apellido);
        if (affectedRows === 0) {
        return res.status(404).json({ message: 'Cliente no encontrado o no se realizaron cambios.' });
        }
        res.status(200).json({ message: 'Cliente actualizado exitosamente.' });
    } catch (error) {
        console.error('Error al actualizar cliente:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

exports.deleteCliente = async (req, res) => {
    const { id } = req.params;
    try {
        const affectedRows = await clienteModel.deleteCliente(id);
        if (affectedRows === 0) {
        return res.status(404).json({ message: 'Cliente no encontrado o no se pudo eliminar.' });
        }
        res.status(200).json({ message: 'Cliente eliminado exitosamente.' });
    } catch (error) {
        console.error('Error al eliminar cliente:', error);
        res.status(400).json({ message: error.message || 'Error interno del servidor al eliminar cliente.' });
    }
};