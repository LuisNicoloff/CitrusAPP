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

// --- AUTH ENDPOINT ---
app.post("/api/login", async (req, res) => {
  try {
    const { usuario, password } = req.body;
    if (!usuario || !password) {
      return res
        .status(400)
        .json({ error: "Usuario y contraseña son requeridos." });
    }
    const result = await pool.query(
      "SELECT id, nombre, email, usuario, rol, password FROM usuarios WHERE usuario = $1",
      [usuario]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Credenciales inválidas." });
    }

    const user = result.rows[0];
    // ADVERTENCIA: Comparación de texto plano. ¡USAR BCRYPT EN PRODUCCIÓN!
    if (password !== user.password) {
      return res.status(401).json({ error: "Credenciales inválidas." });
    }

    // No devolver nunca la contraseña al frontend
    const { password: _, ...userToReturn } = user;
    res.json(userToReturn);
  } catch (err) {
    console.error("Error en el login:", err.message);
    res.status(500).send("Error en el servidor.");
  }
});

// --- ENDPOINTS PRODUCTORES ---
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

// --- ENDPOINTS USUARIOS ---
app.get("/api/usuarios", async (req, res) => {
  try {
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
    const nuevoUsuario = await pool.query(
      "INSERT INTO usuarios (nombre, email, usuario, password, rol) VALUES($1, $2, $3, $4, $5) RETURNING id, nombre, email, usuario, rol",
      [nombre, email, usuario, password, rol]
    );
    res.status(201).json(nuevoUsuario.rows[0]);
  } catch (err) {
    console.error("Error al crear usuario:", err.message);
    if (err.code === "23505") {
      return res
        .status(409)
        .json({ error: "El email o el nombre de usuario ya existe." });
    }
    res.status(500).send("Error en el servidor.");
  }
});

// --- ENDPOINTS INGRESOS DE FRUTA ---
app.get("/api/ingresos", async (req, res) => {
  try {
    const query = `
            SELECT i.id, i.n_ticket, i.fecha_ingreso, i.peso_neto, i.bins_total, p.nombre AS productor_nombre 
            FROM ingresos_fruta i
            LEFT JOIN productores p ON i.productor_id = p.id
            ORDER BY i.fecha_ingreso DESC
        `;
    const { rows } = await pool.query(query);
    res.json(rows);
  } catch (err) {
    console.error("Error al obtener ingresos:", err.message);
    res.status(500).send("Error en el servidor.");
  }
});

app.post("/api/ingresos", async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const ingreso = req.body;
    const detalles = ingreso.detalles || [];

    const ingresoQuery = `
            INSERT INTO ingresos_fruta (n_ticket, productor_id, fecha_ingreso, fecha_cosecha, transporte, chofer, chasis, acoplado, peso_bruto, tara, peso_neto, bins_total, kg_promedio_bin, usuario_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            RETURNING id;
        `;

    // Calcular kg_promedio_bin
    const kgPromedio =
      ingreso.bins_total > 0 ? ingreso.peso_neto / ingreso.bins_total : 0;

    const ingresoValues = [
      ingreso.n_ticket,
      ingreso.productor_id,
      ingreso.fecha_ingreso,
      ingreso.fecha_cosecha,
      ingreso.transporte,
      ingreso.chofer,
      ingreso.chasis,
      ingreso.acoplado,
      ingreso.peso_bruto,
      ingreso.tara,
      ingreso.peso_neto,
      ingreso.bins_total,
      kgPromedio,
      ingreso.usuario_id,
    ];
    const result = await client.query(ingresoQuery, ingresoValues);
    const ingresoId = result.rows[0].id;

    for (const detalle of detalles) {
      const detalleQuery = `
                INSERT INTO ingresos_detalle (ingreso_id, n_remito, finca, producto, lote, contratista_cosecha, tipo_cosecha, tipo_bin, cantidad_bins, peso_bins_vacios, peso_neto_estimado, estado_liquidacion)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12);
            `;
      const detalleValues = [
        ingresoId,
        detalle.n_remito,
        detalle.finca,
        detalle.producto,
        detalle.lote,
        detalle.contratista_cosecha,
        detalle.tipo_cosecha,
        detalle.tipo_bin,
        detalle.cantidad_bins,
        detalle.peso_bins_vacios,
        detalle.peso_neto_estimado,
        detalle.estado_liquidacion,
      ];
      await client.query(detalleQuery, detalleValues);
    }

    await client.query("COMMIT");
    res
      .status(201)
      .json({ id: ingresoId, message: "Ingreso creado exitosamente." });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error al crear ingreso:", err.message);
    res.status(500).send("Error en el servidor.");
  } finally {
    client.release();
  }
});

// --- Iniciar el Servidor ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});
