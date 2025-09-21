require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
app.use(cors());
app.use(express.json()); // Para poder leer JSON en el body

// Configuración de la conexión a la base de datos Neon
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

// --- API ENDPOINTS ---

// Obtener todos los productores
app.get("/api/productores", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM productores ORDER BY nombre ASC"
    );
    res.json(rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Error en el servidor");
  }
});

// Crear un nuevo productor
app.post("/api/productores", async (req, res) => {
  try {
    const { nombre, cuit, ubicacion } = req.body;
    const newProductor = await pool.query(
      "INSERT INTO productores (nombre, cuit, ubicacion) VALUES($1, $2, $3) RETURNING *",
      [nombre, cuit, ubicacion]
    );
    res.json(newProductor.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Error en el servidor");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});
