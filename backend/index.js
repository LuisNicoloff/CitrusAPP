require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// --- API ENDPOINTS PRODUCTORES ---
app.get("/api/productores", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM productores ORDER BY nombre ASC"
    );
    res.json(rows);
  } catch (err) {
    console.error("Error al obtener productores:", err.message);
    res.status(500).send("Error en el servidor.");
  }
});

app.post("/api/productores", async (req, res) => {
  try {
    const { nombre, cuit, ubicacion } = req.body;
    if (!nombre)
      return res.status(400).json({ error: "El campo nombre es obligatorio." });

    const nuevoProductor = await pool.query(
      "INSERT INTO productores (nombre, cuit, ubicacion) VALUES($1, $2, $3) RETURNING *",
      [nombre, cuit, ubicacion]
    );
    res.status(201).json(nuevoProductor.rows[0]);
  } catch (err) {
    console.error("Error al crear productor:", err.message);
    res.status(500).send("Error en el servidor.");
  }
});

// --- API ENDPOINTS USUARIOS (NUEVO) ---
app.get("/api/usuarios", async (req, res) => {
  try {
    // Excluimos la contraseña de la consulta por seguridad
    const { rows } = await pool.query(
      "SELECT id, nombre, email, usuario, rol FROM usuarios ORDER BY nombre ASC"
    );
    res.json(rows);
  } catch (err) {
    console.error("Error al obtener usuarios:", err.message);
    res.status(500).send("Error en el servidor.");
  }
});

app.post("/api/usuarios", async (req, res) => {
  try {
    const { nombre, email, usuario, password, rol } = req.body;
    if (!nombre || !email || !usuario || !password || !rol) {
      return res
        .status(400)
        .json({ error: "Todos los campos son obligatorios." });
    }
    // ADVERTENCIA: En un entorno real, ¡NUNCA guardes la contraseña así! Debes encriptarla.
    const nuevoUsuario = await pool.query(
      "INSERT INTO usuarios (nombre, email, usuario, password, rol) VALUES($1, $2, $3, $4, $5) RETURNING id, nombre, email, usuario, rol",
      [nombre, email, usuario, password, rol]
    );
    res.status(201).json(nuevoUsuario.rows[0]);
  } catch (err) {
    console.error("Error al crear usuario:", err.message);
    // Manejar error de email/usuario duplicado
    if (err.code === "23505") {
      return res
        .status(409)
        .json({ error: "El email o el nombre de usuario ya existe." });
    }
    res.status(500).send("Error en el servidor.");
  }
});

// --- Iniciar el Servidor ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});
