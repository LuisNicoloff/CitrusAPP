require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

// Crear la aplicación Express
const app = express();

// Middlewares
app.use(cors()); // Permite peticiones desde cualquier origen (tu frontend en GitHub Pages)
app.use(express.json()); // Permite al servidor entender JSON

// Configuración de la conexión a la base de datos Neon
// Lee la URL de conexión desde las variables de entorno
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

// --- API ENDPOINTS ---

// Endpoint de prueba para saber si el servidor está vivo
app.get("/api", (req, res) => {
  res.json({ message: "Hola! La API de CitrusAPP está funcionando." });
});

// Endpoint para obtener TODOS los productores
app.get("/api/productores", async (req, res) => {
  try {
    console.log("Recibida petición para obtener productores.");
    const { rows } = await pool.query(
      "SELECT * FROM productores ORDER BY nombre ASC"
    );
    console.log("Enviando", rows.length, "productores.");
    res.json(rows);
  } catch (err) {
    console.error("Error al consultar la base de datos:", err.message);
    res.status(500).send("Error en el servidor al obtener los productores.");
  }
});

// Endpoint para CREAR un nuevo productor
app.post("/api/productores", async (req, res) => {
  try {
    const { nombre, cuit, ubicacion } = req.body;
    // Validación simple
    if (!nombre) {
      return res.status(400).json({ error: "El campo nombre es obligatorio." });
    }
    console.log("Recibida petición para crear productor:", req.body);

    const nuevoProductor = await pool.query(
      "INSERT INTO productores (nombre, cuit, ubicacion) VALUES($1, $2, $3) RETURNING *",
      [nombre, cuit, ubicacion]
    );

    console.log("Productor creado:", nuevoProductor.rows[0]);
    res.status(201).json(nuevoProductor.rows[0]); // 201 = Created
  } catch (err) {
    console.error("Error al crear productor:", err.message);
    res.status(500).send("Error en el servidor al crear el productor.");
  }
});

// --- Iniciar el Servidor ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});
