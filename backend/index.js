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
  /* ...código existente sin cambios... */
});
app.post("/api/productores", async (req, res) => {
  /* ...código existente sin cambios... */
});

// --- ENDPOINTS USUARIOS ---
app.get("/api/usuarios", async (req, res) => {
  /* ...código existente sin cambios... */
});
app.post("/api/usuarios", async (req, res) => {
  /* ...código existente sin cambios... */
});

// --- ENDPOINTS INGRESOS DE FRUTA (NUEVO) ---
app.get("/api/ingresos", async (req, res) => {
  try {
    // Unimos con la tabla de productores para obtener el nombre directamente
    const query = `
            SELECT i.*, p.nombre AS productor_nombre 
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
    await client.query("BEGIN"); // Iniciar transacción

    const ingreso = req.body;
    const detalles = ingreso.detalles || [];

    const ingresoQuery = `
            INSERT INTO ingresos_fruta (n_ticket, productor_id, fecha_ingreso, fecha_cosecha, transporte, chofer, chasis, acoplado, peso_bruto, tara, peso_neto, bins_total, kg_promedio_bin, usuario_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            RETURNING id;
        `;
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
      ingreso.kg_promedio_bin,
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

    await client.query("COMMIT"); // Confirmar transacción
    res
      .status(201)
      .json({ id: ingresoId, message: "Ingreso creado exitosamente." });
  } catch (err) {
    await client.query("ROLLBACK"); // Revertir en caso de error
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
