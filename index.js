// index.js - VERSIÓN DEFINITIVA Y CORREGIDA
const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const XLSX = require("xlsx"); // Importante: usaremos "XLSX" en mayúscula en todo el archivo

const app = express();
const PORT = 3000;

// --- 1. CONFIGURACIÓN DE RUTAS Y CARPETAS ---
const RUTA_DATA = path.join(__dirname, "data");
const RUTA_INVENTARIO = path.join(RUTA_DATA, "inventario.xlsx");
const RUTA_VENTAS = path.join(RUTA_DATA, "ventas.xlsx");
const RUTA_USUARIOS = path.join(RUTA_DATA, "usuarios.xlsx");

// Crear carpeta data si no existe
if (!fs.existsSync(RUTA_DATA)) fs.mkdirSync(RUTA_DATA);

// --- 2. MIDDLEWARES ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public"))); 
app.use(express.static(__dirname)); 

// --- 3. RUTAS HTML (PÁGINAS) ---
// Estas rutas aseguran que al entrar a /dashboard o /usuarios se vea el HTML correcto
app.get("/dashboard", (req, res) => res.sendFile(path.join(__dirname, "public", "dashboard.html")));
app.get("/dashboard.html", (req, res) => res.sendFile(path.join(__dirname, "public", "dashboard.html")));

app.get("/inventario", (req, res) => res.sendFile(path.join(__dirname, "public", "inventario.html")));
app.get("/inventario.html", (req, res) => res.sendFile(path.join(__dirname, "public", "inventario.html")));

app.get("/ventas", (req, res) => res.sendFile(path.join(__dirname, "public", "ventas.html")));
app.get("/ventas.html", (req, res) => res.sendFile(path.join(__dirname, "public", "ventas.html")));

app.get("/usuarios", (req, res) => res.sendFile(path.join(__dirname, "public", "usuarios.html")));
app.get("/usuarios.html", (req, res) => res.sendFile(path.join(__dirname, "public", "usuarios.html")));

app.get("/index", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.get("/index.html", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

// --- 4. CONFIGURACIÓN IMÁGENES (MULTER) ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, "public", "img");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    // Normalizamos el nombre para evitar caracteres raros en el archivo
    const nombreLimpio = (req.body.nombre || "temp")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") 
      .replace(/[^a-z0-9]/g, "_") 
      .replace(/_+/g, "_") 
      .replace(/^_|_$/g, "");
    cb(null, `${nombreLimpio}.jpg`);
  },
});
const upload = multer({ storage });

// --- 5. FUNCIONES DE BASE DE DATOS (EXCEL) ---

// Función Maestra para guardar cualquier Excel (Inventario, Ventas o Usuarios)
function guardarExcel(ruta, datos) {
  try {
    const nuevoLibro = XLSX.utils.book_new();
    const nuevaHoja = XLSX.utils.json_to_sheet(datos);
    XLSX.utils.book_append_sheet(nuevoLibro, nuevaHoja, "Datos");
    XLSX.writeFile(nuevoLibro, ruta);
    return true;
  } catch (error) {
    if (error.code === "EBUSY") {
      console.error(`❌ ERROR: El archivo ${path.basename(ruta)} está abierto. Ciérralo para guardar.`);
    } else {
      console.error("❌ Error al guardar Excel:", error);
    }
    return false;
  }
}

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
  } catch (e) { return []; }
}

function leerVentas() {
  try {
    if (!fs.existsSync(RUTA_VENTAS)) return [];
    const libro = XLSX.readFile(RUTA_VENTAS);
    return XLSX.utils.sheet_to_json(libro.Sheets[libro.SheetNames[0]]);
  } catch (e) { return []; }
}

function leerUsuarios() {
    if (!fs.existsSync(RUTA_USUARIOS)) return [];
    try {
        const workbook = XLSX.readFile(RUTA_USUARIOS);
        const sheetName = workbook.SheetNames[0];
        return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
    } catch(e) { return []; }
}

// --- 6. API: LOGIN ---
app.post("/api/index", (req, res) => {
  try {
    const usuarioInput = (req.body.usuario || req.body.user || "").toString().trim().toLowerCase();
    const claveInput = (req.body.clave || req.body.pass || "").toString().trim();

    // Crear admin por defecto si no existe archivo
    if (!fs.existsSync(RUTA_USUARIOS)) {
      const adminInicial = [{ usuario: "admin", clave: "1234", rol: "ADMIN" }];
      guardarExcel(RUTA_USUARIOS, adminInicial);
    }

    const usuarios = leerUsuarios();
    
    // Buscar usuario y contraseña
    const encontrado = usuarios.find((u) => {
      const uExcel = (u.usuario || "").toString().trim().toLowerCase();
      const cExcel = (u.clave || "").toString().trim();
      return uExcel === usuarioInput && cExcel === claveInput;
    });

    if (encontrado) {
      const rolFinal = (encontrado.rol || "VENDEDOR").toString().toUpperCase().trim();
      res.json({ exito: true, rol: rolFinal, user: encontrado.usuario });
    } else {
      res.status(401).json({ exito: false, mensaje: "Credenciales inválidas" });
    }
  } catch (error) {
    res.status(500).json({ exito: false });
  }
});

// --- 7. API: INVENTARIO ---
app.get("/api/inventario", (req, res) => res.json(leerInventario()));

app.get("/api/inventario/ver", (req, res) => {
  res.json(leerInventario().filter((p) => p.nombre !== "Sin Nombre"));
});

app.post("/api/inventario/agregar", upload.single("imagen"), (req, res) => {
  try {
    const { nombre, categoria, cantidad, precio, costo } = req.body;
    let inventario = leerInventario();
    inventario.push({
      nombre: nombre.trim(),
      categoria: categoria,
      cantidad: Number(cantidad),
      precio: Number(precio),
      costo: Number(costo) || 0,
      fecha_registro: new Date().toLocaleDateString(),
    });
    guardarExcel(RUTA_INVENTARIO, inventario);
    res.json({ mensaje: "Producto agregado con éxito" });
  } catch (e) { res.status(500).send("Error"); }
});

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
  } catch (e) { res.status(500).json({ mensaje: "Error" }); }
});

app.delete("/api/inventario/eliminar", (req, res) => {
  const { nombre } = req.body;
  const carpetaImg = path.join(__dirname, "public/img");

  try {
    let inventario = leerInventario();
    const productoAborrar = inventario.find((p) => p.nombre === nombre);

    // Borrado de imagen
    if (productoAborrar) {
      const nombreArchivo = nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "") + ".jpg";
      const rutaCompleta = path.join(carpetaImg, nombreArchivo);
      if (fs.existsSync(rutaCompleta)) {
        try { fs.unlinkSync(rutaCompleta); } catch (e) { console.error("Error borrando img"); }
      }
    }
    // Borrado de datos
    const filtrado = inventario.filter((p) => p.nombre !== nombre);
    guardarExcel(RUTA_INVENTARIO, filtrado);
    res.json({ mensaje: "Eliminado correctamente" });
  } catch (e) { res.status(500).json({ mensaje: "Error al eliminar" }); }
});

// --- 8. API: VENTAS ---
app.get("/api/ventas/historial", (req, res) => {
    const ventas = leerVentas().filter(v => v["ID Venta"]);
    res.json(ventas);
});

app.post("/api/ventas/confirmar", (req, res) => {
  const { carrito, vendedor, total, idVenta, numPersonas } = req.body;
  try {
    let inventario = leerInventario();
    let ventas = leerVentas();

    // Descontar stock
    carrito.forEach((item) => {
      const prod = inventario.find((p) => p.nombre.trim() === item.nombre.trim());
      if (prod) prod.cantidad = (Number(prod.cantidad) || 0) - (Number(item.cantidad) || 0);
    });

    const ahora = new Date();
    // Registrar venta
    ventas.push({
      "ID Venta": idVenta || `V-${Date.now()}`,
      Fecha: ahora.toLocaleDateString("es-CO"),
      Hora: ahora.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" }),
      Vendedor: vendedor || "Admin",
      Productos: carrito.map((p) => `${p.nombre} (x${p.cantidad})`).join(", "),
      Total: Number(total) || 0,
      Personas: numPersonas || 0,
    });

    guardarExcel(RUTA_INVENTARIO, inventario);
    guardarExcel(RUTA_VENTAS, ventas);
    res.json({ mensaje: "Venta registrada" });
  } catch (e) { res.status(500).json({ mensaje: "Error" }); }
});

app.post("/api/ventas/anular", (req, res) => {
  const { idVenta } = req.body;
  try {
    let ventas = leerVentas();
    let inventario = leerInventario();
    const vAEliminar = ventas.find((v) => String(v["ID Venta"]) === String(idVenta));

    // Devolver stock
    if (vAEliminar && vAEliminar.Productos) {
      vAEliminar.Productos.split(", ").forEach((item) => {
        const match = item.match(/(.+) \(x(\d+)\)/);
        if (match) {
          const prod = inventario.find((p) => p.nombre.trim() === match[1].trim());
          if (prod) prod.cantidad += parseInt(match[2]);
        }
      });
    }
    const restantes = ventas.filter((v) => String(v["ID Venta"]) !== String(idVenta));
    guardarExcel(RUTA_INVENTARIO, inventario);
    guardarExcel(RUTA_VENTAS, restantes);
    res.json({ mensaje: "Venta anulada" });
  } catch (e) { res.status(500).send(); }
});

// --- 9. API: USUARIOS (NUEVO MÓDULO) ---

app.get("/api/usuarios/ver", (req, res) => {
  res.json(leerUsuarios());
});

app.post("/api/usuarios/guardar", (req, res) => {
  const { usuario, clave, rol } = req.body;
  let usuarios = leerUsuarios();
  
  if (usuarios.find(u => u.usuario === usuario)) {
      return res.status(400).send("El usuario ya existe");
  }

  usuarios.push({ usuario, clave, rol });
  guardarExcel(RUTA_USUARIOS, usuarios); 
  res.json({ message: "Guardado" });
});

app.put("/api/usuarios/editar", (req, res) => {
  const { usuarioOriginal, usuario, clave, rol } = req.body;
  let usuarios = leerUsuarios();
  const index = usuarios.findIndex((u) => u.usuario === usuarioOriginal);

  if (index !== -1) {
    usuarios[index].usuario = usuario;
    usuarios[index].rol = rol;
    // Solo si escribieron clave nueva, la actualizamos
    if (clave && clave.trim() !== "") usuarios[index].clave = clave;
    
    guardarExcel(RUTA_USUARIOS, usuarios);
    res.json({ message: "Actualizado" });
  } else {
    res.status(404).send("Usuario no encontrado");
  }
});

app.delete("/api/usuarios/eliminar", (req, res) => {
  const { nombre } = req.body;
  let usuarios = leerUsuarios();
  const nuevosUsuarios = usuarios.filter((u) => u.usuario !== nombre);

  if (nuevosUsuarios.length === usuarios.length) {
    return res.status(404).send("Usuario no encontrado");
  }

  guardarExcel(RUTA_USUARIOS, nuevosUsuarios);
  res.json({ message: "Eliminado" });
});

// --- 10. INICIAR SERVIDOR ---
app.listen(PORT, () => console.log(`🚀 Servidor en puerto ${PORT}`));