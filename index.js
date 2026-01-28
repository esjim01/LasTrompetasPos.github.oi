// index.js reparado - Proyecto Las Trompetas
const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const XLSX = require("xlsx");

const app = express();
const PORT = 3000;

// --- RUTAS DE ARCHIVOS ---
const RUTA_DATA = path.join(__dirname, "data");
const RUTA_INVENTARIO = path.join(RUTA_DATA, "inventario.xlsx");
const RUTA_VENTAS = path.join(RUTA_DATA, "ventas.xlsx");
const RUTA_USUARIOS = path.join(RUTA_DATA, "usuarios.xlsx");

if (!fs.existsSync(RUTA_DATA)) fs.mkdirSync(RUTA_DATA);

// --- MIDDLEWARES ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

const USUARIOS_SISTEMA = [
  { usuario: "admin", clave: "1234", rol: "ADMIN" },
  { usuario: "vendedor1", clave: "5678", rol: "VENDEDOR" },
];

// --- FUNCIONES DE APOYO (LÓGICA MEJORADA) ---

function leerInventario() {
  try {
    if (!fs.existsSync(RUTA_INVENTARIO)) return [];
    const libro = XLSX.readFile(RUTA_INVENTARIO);
    const datos = XLSX.utils.sheet_to_json(libro.Sheets[libro.SheetNames[0]]);
    return datos.map((p) => ({
      nombre: p.nombre ? String(p.nombre).trim() : "Sin Nombre",
      categoria: p.categoria || "Otros",
      cantidad: Number(p.cantidad) || 0,
      precio: Number(p.precio) || 0,
      fecha_registro: p.fecha_registro || new Date().toLocaleDateString(),
      costo: Number(p.costo) || 0,
    }));
  } catch (e) {
    return [];
  }
}

function leerVentas() {
  try {
    if (!fs.existsSync(RUTA_VENTAS)) return [];
    const libro = XLSX.readFile(RUTA_VENTAS);
    return XLSX.utils.sheet_to_json(libro.Sheets[libro.SheetNames[0]]);
  } catch (e) {
    return [];
  }
}

function guardarExcel(ruta, datos) {
  try {
    const nuevoLibro = XLSX.utils.book_new();
    const nuevaHoja = XLSX.utils.json_to_sheet(datos);
    XLSX.utils.book_append_sheet(nuevoLibro, nuevaHoja, "Datos");

    // El error EBUSY ocurre exactamente aquí:
    XLSX.writeFile(nuevoLibro, ruta);
    console.log(`✅ Archivo guardado: ${path.basename(ruta)}`);
    return true;
  } catch (error) {
    if (error.code === "EBUSY") {
      console.error(
        `❌ ERROR CRÍTICO: El archivo ${path.basename(ruta)} está abierto en Excel. Ciérralo para poder guardar.`,
      );
    } else {
      console.error("❌ Error al guardar Excel:", error);
    }
    return false;
  }
}

// --- CONFIGURACIÓN MULTER ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, "public", "img");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const nombreLimpio = (req.body.nombre || "temp")
      .toLowerCase()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Quita tildes y eñes (ñ -> n)
      .replace(/[^a-z0-9]/g, "_") // Cualquier cosa que no sea letra o número será un guion bajo
      .replace(/_+/g, "_") // Si quedan varios guiones seguidos (como __), los vuelve uno solo (_)
      .replace(/^_|_$/g, "");
    cb(null, `${nombreLimpio}.jpg`);
  },
});
const upload = multer({ storage });

// --- RUTAS API ---

app.post("/api/login", (req, res) => {
  try {
    const usuarioInput = (req.body.usuario || req.body.user || "")
      .toString()
      .trim()
      .toLowerCase();
    const claveInput = (req.body.clave || req.body.pass || "")
      .toString()
      .trim();

    if (!fs.existsSync(RUTA_USUARIOS)) {
      const adminInicial = [{ usuario: "admin", clave: "1234", rol: "ADMIN" }];
      guardarExcel(RUTA_USUARIOS, adminInicial);
    }

    const libro = XLSX.readFile(RUTA_USUARIOS);
    const usuarios = XLSX.utils.sheet_to_json(
      libro.Sheets[libro.SheetNames[0]],
    );

    // Buscamos ignorando mayúsculas/minúsculas en el nombre y limpiando espacios
    const encontrado = usuarios.find((u) => {
      const uExcel = (u.usuario || "").toString().trim().toLowerCase();
      const cExcel = (u.clave || "").toString().trim();
      return uExcel === usuarioInput && cExcel === claveInput;
    });

    if (encontrado) {
      // Normalizamos el rol a MAYÚSCULAS para que el frontend lo reconozca
      const rolFinal = (encontrado.rol || "VENDEDOR")
        .toString()
        .toUpperCase()
        .trim();

      console.log(
        `✅ Login Exitoso: ${encontrado.usuario} con rol ${rolFinal}`,
      );

      res.json({
        exito: true,
        rol: rolFinal,
        user: encontrado.usuario,
      });
    } else {
      console.log(
        `❌ Fallo: Usuario '${usuarioInput}' no coincide con el Excel`,
      );
      res.status(401).json({ exito: false, mensaje: "Credenciales inválidas" });
    }
  } catch (error) {
    console.error("Error crítico en login:", error);
    res.status(500).json({ exito: false });
  }
});

app.get("/api/inventario", (req, res) => {
    try {
        const inventario = leerInventario(); // Asegúrate de que esta función devuelva el array
        res.json(inventario);
    } catch (e) {
        res.status(500).json({ mensaje: "Error al leer inventario" });
    }
});

app.get("/api/inventario/ver", (req, res) => {
  res.json(leerInventario().filter((p) => p.nombre !== "Sin Nombre"));
});

app.post("/api/inventario/agregar", upload.single("imagen"), (req, res) => {
  try {
    const { nombre, categoria, cantidad, precio, costo } = req.body; // Añadimos costo
    let inventario = leerInventario();

    const nuevoProducto = {
      nombre: nombre.trim(),
      categoria: categoria,
      cantidad: Number(cantidad),
      precio: Number(precio),
      costo: Number(req.body.costo) || 0, // Guardamos costo neto
      fecha_registro: new Date().toLocaleDateString(),
    };

    inventario.push(nuevoProducto);
    guardarExcel(RUTA_INVENTARIO, inventario);
    res.json({ mensaje: "Producto agregado con éxito" });
  } catch (e) {
    res.status(500).send("Error");
  }
});

app.get("/api/ventas/historial", (req, res) => {
    try {
        if (fs.existsSync(RUTA_VENTAS)) {
            const libro = XLSX.readFile(RUTA_VENTAS);
            const historial = XLSX.utils.sheet_to_json(libro.Sheets[libro.SheetNames[0]]);
            
            // Filtramos para asegurar que solo enviamos registros válidos
            const ventasValidas = historial.filter((v) => v["ID Venta"]);
            
            return res.json(ventasValidas); // Respondemos y salimos de la función
        } else {
            return res.json([]); // Si no hay archivo, enviamos lista vacía
        }
    } catch (error) {
        console.error("Error al leer historial:", error);
        return res.status(500).json({ mensaje: "Error al leer las ventas" });
    }
});

app.post("/api/ventas/confirmar", (req, res) => {
  const { carrito, vendedor, total, idVenta, numPersonas } = req.body;
  try {
    let inventario = leerInventario();
    let ventas = leerVentas();

    // 1. Actualizar Stock
    carrito.forEach((item) => {
      const prod = inventario.find(
        (p) => p.nombre.trim() === item.nombre.trim(),
      );
      if (prod)
        prod.cantidad =
          (Number(prod.cantidad) || 0) - (Number(item.cantidad) || 0);
    });

    guardarExcel(RUTA_INVENTARIO, inventario);

    // Guardar Historial
    let historial = [];
    if (fs.existsSync(RUTA_VENTAS)) {
      const libro = XLSX.readFile(RUTA_VENTAS);
      historial = XLSX.utils.sheet_to_json(libro.Sheets[libro.SheetNames[0]]);
    }

    // 2. Registrar Venta con nombres exactos para el frontend
    const ahora = new Date();
    ventas.push({
      "ID Venta": idVenta || `V-${Date.now()}`,
      Fecha: ahora.toLocaleDateString("es-CO"),
      Hora: ahora.toLocaleTimeString("es-CO", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      Vendedor: vendedor || "Admin",
      Productos: carrito.map((p) => `${p.nombre} (x${p.cantidad})`).join(", "),
      Total: Number(total) || 0,
      Personas: numPersonas || 0, // Guardamos la asistencia
    });

    historial.push(...ventas);
    guardarExcel(RUTA_INVENTARIO, inventario);
    guardarExcel(RUTA_VENTAS, ventas);
    res.json({ mensaje: "Venta registrada" });
  } catch (e) {
    res.status(500).json({ mensaje: "Error" });
  }
});

app.post("/api/ventas/anular", (req, res) => {
  const { idVenta } = req.body;
  try {
    let ventas = leerVentas();
    let inventario = leerInventario();
    const vAEliminar = ventas.find(
      (v) => String(v["ID Venta"]) === String(idVenta),
    );

    if (vAEliminar && vAEliminar.Productos) {
      vAEliminar.Productos.split(", ").forEach((item) => {
        const match = item.match(/(.+) \(x(\d+)\)/);
        if (match) {
          const prod = inventario.find(
            (p) => p.nombre.trim() === match[1].trim(),
          );
          if (prod) prod.cantidad += parseInt(match[2]);
        }
      });
    }
    const restantes = ventas.filter(
      (v) => String(v["ID Venta"]) !== String(idVenta),
    );
    guardarExcel(RUTA_INVENTARIO, inventario);
    guardarExcel(RUTA_VENTAS, restantes);
    res.json({ mensaje: "Venta anulada" });
  } catch (e) {
    res.status(500).send();
  }
});

// --- RUTA PARA EDITAR PRODUCTO ---
app.put("/api/inventario/editar", (req, res) => {
  const { nombreOriginal, nombreNuevo, cantidad, precio, costo } = req.body;
  try {
    let inventario = leerInventario();
    const index = inventario.findIndex((p) => p.nombre === nombreOriginal);
    if (index !== -1) {
      inventario[index] = {
        ...inventario[index],
        nombre: nombreNuevo.trim(),
        cantidad: Number(cantidad),
        precio: Number(precio),
        costo: Number(costo),
      };
      guardarExcel(RUTA_INVENTARIO, inventario);
      res.json({ mensaje: "Producto actualizado" });
    } else {
      res.status(404).json({ mensaje: "No encontrado" });
    }
  } catch (e) {
    res.status(500).json({ mensaje: "Error" });
  }
});

// --- RUTA PARA ELIMINAR PRODUCTO ---
app.delete("/api/inventario/eliminar", (req, res) => {
  const { nombre } = req.body;
  try {
    let inventario = leerInventario();
    const filtrado = inventario.filter((p) => p.nombre !== nombre);
    guardarExcel(RUTA_INVENTARIO, filtrado);
    res.json({ mensaje: "Producto eliminado" });
  } catch (e) {
    res.status(500).json({ mensaje: "Error" });
  }
});

app.listen(PORT, () => console.log(`🚀 Servidor en puerto ${PORT}`));

// --- RUTA DE LOGIN DESDE EXCEL ---
app.post("/api/login", (req, res) => {
  try {
    const usuarioInput = req.body.usuario || req.body.user;
    const claveInput = req.body.clave || req.body.pass;

    // 1. Leemos el archivo de usuarios
    const RUTA_USUARIOS = path.join(RUTA_DATA, "usuarios.xlsx");

    // Si no existe el archivo, creamos uno por defecto para que no te quedes fuera
    if (!fs.existsSync(RUTA_USUARIOS)) {
      const adminInicial = [{ usuario: "admin", clave: "1234", rol: "ADMIN" }];
      guardarExcel(RUTA_USUARIOS, adminInicial);
    }

    const libro = XLSX.readFile(RUTA_USUARIOS);
    const usuarios = XLSX.utils.sheet_to_json(
      libro.Sheets[libro.SheetNames[0]],
    );

    // 2. Buscamos al usuario
    const encontrado = usuarios.find(
      (u) =>
        String(u.usuario).trim() === usuarioInput &&
        String(u.clave).trim() === claveInput,
    );

    if (encontrado) {
      res.json({
        exito: true,
        rol: encontrado.rol,
        user: encontrado.usuario,
      });
    } else {
      console.log(`❌ Intento de login fallido para: ${usuarioInput}`);
      res
        .status(401)
        .json({ exito: false, mensaje: "Usuario o clave incorrectos" });
    }
  } catch (error) {
    console.error("Error en login excel:", error);
    res.status(500).json({ exito: false });
  }
});

// Obtener lista de usuarios
app.get("/api/usuarios/ver", (req, res) => {
  try {
    if (!fs.existsSync(RUTA_USUARIOS)) return res.json([]);
    const libro = XLSX.readFile(RUTA_USUARIOS);
    const datos = XLSX.utils.sheet_to_json(libro.Sheets[libro.SheetNames[0]]);
    res.json(datos);
  } catch (e) {
    res.status(500).json([]);
  }
});

// Agregar o actualizar usuario
app.post("/api/usuarios/guardar", (req, res) => {
  try {
    const { usuario, clave, rol } = req.body;
    let usuarios = [];
    if (fs.existsSync(RUTA_USUARIOS)) {
      const libro = XLSX.readFile(RUTA_USUARIOS);
      usuarios = XLSX.utils.sheet_to_json(libro.Sheets[libro.SheetNames[0]]);
    }

    // Evitar duplicados: si existe, lo actualiza, si no, lo agrega
    const index = usuarios.findIndex((u) => u.usuario === usuario);
    if (index !== -1) usuarios[index] = { usuario, clave, rol };
    else usuarios.push({ usuario, clave, rol });

    guardarExcel(RUTA_USUARIOS, usuarios);
    res.json({ mensaje: "Usuario guardado correctamente" });
  } catch (e) {
    res.status(500).json({ mensaje: "Error al guardar" });
  }
});
