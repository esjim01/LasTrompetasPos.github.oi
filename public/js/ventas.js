// ventas.js - Proyecto Las Trompetas (REPARADO)

// --- 2. VARIABLES GLOBALES ---
let carrito = [];
let todosLosProductos = [];
let productosBase = [];
const CATEGORIAS_DEFINIDAS = [
  "Todas",
  "Cervezas",
  "Rones",
  "Aguardientes",
  "Whisky",
  "Vinos",
  "Energizantes",
  "Gaseosas",
  "Otros",
];

// --- 1. SEGURIDAD Y SESIÓN (En ventas.js) ---
(function () {
  function verificarSesion() {
    const rol = localStorage.getItem("usuarioRol");
    if (!rol) window.location.replace("index.html");

    // --- LÓGICA DE RESTRICCIÓN PARA EL BOTÓN INVENTARIO ---
    // Esperamos a que el DOM cargue para buscar el ID
    document.addEventListener("DOMContentLoaded", () => {
      const liInventario = document.getElementById("li-inventario");

      if (liInventario) {
        if (rol !== "ADMIN") {
          // Si no es admin, borramos el botón por completo de la vista
          liInventario.style.display = "none";
        }
      }
    });
  }
  verificarSesion();
})();
//
function cerrarSesion() {
  localStorage.clear();
  window.location.replace("index.html");//
}

document.addEventListener("DOMContentLoaded", function () {
  M.AutoInit();
  cargarDatos();
  // Intentamos cargar el historial al iniciar por si la tabla existe en la página actual
  if (document.getElementById("tabla-historial")) {
    cargarHistorial();
  }
});

// --- 3. LÓGICA DE PRODUCTOS ---
async function cargarDatos() {
  try {
    const res = await fetch("/api/inventario/ver");
    const data = await res.json(); // Guardamos el resultado en una variable temporal

    todosLosProductos = data;
    productosBase = data; // <<--- ESTA ES LA LÍNEA CLAVE QUE DEBES AGREGAR

    generarMenuCategorias();
    renderizarCatalogo(todosLosProductos);
  } catch (error) {
    M.toast({ html: "Error al cargar productos", classes: "red" });
  }
}

function generarMenuCategorias() {
  const menu = document.getElementById("menu-categorias");
  if (!menu) return;

  const iconos = {
    Todas: "grid_view",
    Cervezas: "sports_bar",
    Rones: "liquor",
    Aguardientes: "local_bar",
    Whisky: "wine_bar",
    Vinos: "icecream",
    Energizantes: "bolt",
    Gaseosas: "local_drink",
    Otros: "more_horiz",
  };

  menu.innerHTML = `
        <p class="sidebar-title">Navegación</p>
        ${CATEGORIAS_DEFINIDAS.map(
          (cat) => `
            <div class="cat-item ${cat === "Todas" ? "active" : ""}" 
                 onclick="ejecutarFiltro('${cat}', this)">
                <i class="material-icons">${iconos[cat] || "label"}</i>
                <span>${cat}</span>
            </div>
        `,
        ).join("")}
    `;
}

function renderizarCatalogo(listaAmostrar, nombreCat = "Todas") {
  const contenedor = document.getElementById("catalogo-productos");
  if (!contenedor) return;
  contenedor.innerHTML = "";

  if (listaAmostrar.length === 0) {
    contenedor.innerHTML = `<div class="col s12 center-align grey-text"><p>No hay productos en esta categoría</p></div>`;
    return;
  }

  listaAmostrar.forEach((p) => {
    // Normalización de imagen
    const nombreArchivo = p.nombre
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "");

    const urlImagen = `img/${nombreArchivo}.jpg?v=${Date.now()}`;
    const nombreEscapado = p.nombre
      .replace(/'/g, "\\'")
      .replace(/"/g, "&quot;");

    // Determinar color de stock
    let stockClass = "stock-ok";
    let stockIcon = "check_circle";
    if (p.cantidad <= 0) {
      stockClass = "stock-low red-text";
      stockIcon = "error_outline";
    } else if (p.cantidad < 5) {
      stockClass = "stock-low orange-text";
      stockIcon = "warning";
    }

    contenedor.innerHTML += `
            <div class="product-card hoverable animate__animated animate__fadeIn" 
                 onclick="${p.cantidad > 0 ? `agregarAlCarrito('${nombreEscapado}', ${p.precio}, ${p.cantidad})` : "M.toast({html: 'Sin stock', classes:'red'})"}">
                <div class="card-image">
                    <img src="${urlImagen}" 
                         onerror="this.onerror=null; this.src='https://placehold.co/300x400?text=Las+Trompetas'">
                </div>
                <div class="card-content">
                    <span class="card-title">${p.nombre}</span>
                    <div class="product-price">$${p.precio.toLocaleString()}</div>
                    <div class="stock-badge ${stockClass}" style="display: flex; align-items: center; justify-content: center; gap: 5px;">
                        <i class="material-icons" style="font-size: 14px;">${stockIcon}</i>
                        <span>Stock: ${p.cantidad}</span>
                    </div>
                </div>
            </div>`;
  });
}

// --- 4. CARRITO ---
function agregarAlCarrito(nombre, precio, stockDisponible) {
  console.log("Intentando agregar:", nombre, precio, stockDisponible);

  // 1. Buscar si el producto ya está en el carrito
  const itemExistente = carrito.find((item) => item.nombre === nombre);

  if (itemExistente) {
    if (itemExistente.cantidad < stockDisponible) {
      itemExistente.cantidad++;
      M.toast({ html: `+1 ${nombre}`, classes: "blue" });
    } else {
      M.toast({ html: "Stock agotado", classes: "red" });
    }
  } else {
    // 2. Si es nuevo y hay stock, agregarlo
    if (stockDisponible > 0) {
      carrito.push({
        nombre: nombre,
        precio: precio,
        cantidad: 1,
      });
      M.toast({ html: `${nombre} agregado`, classes: "green" });
    } else {
      M.toast({ html: "Sin stock disponible", classes: "red" });
    }
  }

  // 3. Actualizar la lista visual del carrito y el total
  actualizarInterfazCarrito();
}

function actualizarInterfazCarrito() {
  const listaCarrito = document.getElementById("lista-carrito");
  const totalElemento = document.getElementById("total-venta");
  const badge = document.getElementById("badge-cart");

  if (!listaCarrito) return;
  listaCarrito.innerHTML = "";
  let total = 0;
  let cantidadTotal = 0;

  carrito.forEach((item, index) => {//
    const subtotal = item.precio * item.cantidad;
    total += subtotal;
    cantidadTotal += item.cantidad;

    // Dentro de tu función actualizarInterfazCarrito
listaCarrito.innerHTML += `
    <li class="collection-item" style="padding: 15px !important;">
        <div style="margin-bottom: 8px;">
            <span class="bold" style="font-size: 0.95rem; display: block;">${item.nombre}</span>
        </div>
        
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <div class="controles-carrito">
                <button class="btn-floating btn-small btn-cant" onclick="cambiarCantidad(${index}, -1)">
                    <i class="material-icons">remove</i>
                </button>
                <span class="bold">${item.cantidad}</span>
                <button class="btn-floating btn-small btn-cant" onclick="cambiarCantidad(${index}, 1)">
                    <i class="material-icons">add</i>
                </button>
            </div>
            
            <div style="text-align: right;">
                <span class="indigo-text bold" style="font-size: 1rem;">$${(item.precio * item.cantidad).toLocaleString()}</span>
                <i class="material-icons red-text" onclick="eliminarDelCarrito(${index})" style="margin-left: 10px; cursor: pointer; vertical-align: middle;">delete_outline</i>
            </div>
        </div>
    </li>
`;
  });

  if (totalElemento) totalElemento.innerText = total.toLocaleString();
  if (badge) badge.innerText = cantidadTotal;
}
function cambiarCantidad(index, delta) {
  const item = carrito[index];
  if (!item) return;

  // 1. Lógica para SUMAR (delta positivo, ej: +1)
  if (delta > 0) {
    // Buscamos en productosBase con trim() para evitar errores por espacios en el Excel
    const productoEnInventario = productosBase.find(
      (p) => p.nombre.trim() === item.nombre.trim(),
    );
    const stockActual = productoEnInventario
      ? Number(productoEnInventario.cantidad)
      : 0;

    if (item.cantidad < stockActual) {
      item.cantidad += 1;
    } else {
      M.toast({ html: "No hay más stock disponible", classes: "orange" });
      return; // Salimos para no actualizar interfaz innecesariamente
    }
  }
  // 2. Lógica para RESTAR (delta negativo, ej: -1)
  else {
    if (item.cantidad > 1) {
      item.cantidad -= 1;
    } else {
      // Si la cantidad es 1 y restamos, se elimina el producto
      eliminarDelCarrito(index);
      return;
    }
  }

  // 3. ACTUALIZACIÓN CRÍTICA
  // Asegúrate de que esta función redibuje la tabla y recalcule el TOTAL general
  actualizarInterfazCarrito();
}

function eliminarDelCarrito(index) {
  carrito.splice(index, 1);
  actualizarInterfazCarrito();
  M.toast({ html: "Producto quitado", classes: "red" });

  // Si el carrito queda vacío, cerramos la "cinta"
  if (carrito.length === 0) {
    const instance = M.Modal.getInstance(
      document.getElementById("modal-pedido"),
    );
    instance.close();
  }
}

// --- 5. HISTORIAL Y CONFIRMACIÓN ---
async function cargarHistorial() {
  try {
    const res = await fetch(`/api/ventas/historial?t=${Date.now()}`);
    const ventas = await res.json();
    const tabla = document.getElementById("tabla-historial");
    if (!tabla) return;

    tabla.innerHTML = "";
    // Invertimos para ver la última venta arriba
    ventas.reverse().forEach((v) => {
      tabla.innerHTML += `
                <tr>
                    <td><b>${v.Fecha}</b><br><small>${v.Hora}</small></td>
                    <td><span class="chip">${v.Vendedor}</span></td>
                    <td style="font-size: 0.85rem;">${v.Productos}</td>
                    <td><b>$${(v.Total || 0).toLocaleString()}</b></td>
                    <td>
                        <button class="btn-small red" onclick="anularVenta('${v["ID Venta"]}')">
                            <i class="material-icons">delete</i>
                        </button>
                    </td>
                </tr>`;
    });
  } catch (error) {
    console.error("Error historial:", error);
  }
}

async function confirmarVenta() {
  if (carrito.length === 0) return M.toast({ html: "Carrito vacío" });

  const checkActivo = document.getElementById("check-personas").checked;
  //
  const inputPersonas = document.getElementById("num-personas");
  let nPersonas = 0;

  if (checkActivo) {
    // .value siempre devuelve un String, lo pasamos a Número
    nPersonas = parseInt(inputPersonas.value);

    if (isNaN(nPersonas) || nPersonas < 1) {
      return M.toast({
        html: "Por favor, ingresa un número válido de personas",
        classes: "red",
      });
    }
  }

  const datosVenta = {
    carrito: carrito,
    vendedor: localStorage.getItem("usuarioNombre") || "Admin",
    total: carrito.reduce((sum, item) => sum + item.precio * item.cantidad, 0),
    idVenta: "V-" + Date.now(),
    numPersonas: nPersonas, // Enviamos el dato al servidor
  };

  try {
    const res = await fetch("/api/ventas/confirmar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datosVenta),
    });

    if (res.ok) {
      M.toast({ html: "✅ Venta exitosa", classes: "green" });
      carrito = [];
      actualizarInterfazCarrito();
      M.Modal.getInstance(document.getElementById("modal-pedido")).close();

      // REFRESCAR TODO
      cargarDatos(); // Actualiza stock en tarjetas
      cargarHistorial(); // Actualiza tabla de ventas
    } else {
      const err = await res.json();
      M.toast({ html: "Error: " + err.mensaje });
    }
  } catch (e) {
    M.toast({ html: "Error de conexión", classes: "red" });
  }
}

async function anularVenta(id) {
  if (!confirm("¿Anular esta venta? El stock será devuelto.")) return;
  try {
    const res = await fetch("/api/ventas/anular", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idVenta: id }),
    });
    if (res.ok) {
      M.toast({ html: "Venta anulada" });
      cargarHistorial();
      cargarDatos();
    }
  } catch (e) {
    console.error(e);
  }
}

// Filtros y búsqueda
function ejecutarFiltro(cat, el) {
  document
    .querySelectorAll(".cat-item")
    .forEach((i) => i.classList.remove("active"));
  if (el) el.classList.add("active");
  const filtrados =
    cat === "Todas"
      ? todosLosProductos
      : todosLosProductos.filter((p) => p.categoria === cat);
  renderizarCatalogo(filtrados, cat);
}
// Toggle personas
function togglePersonas() {
  const check = document.getElementById("check-personas");
  const contenedor = document.getElementById("contenedor-personas");

  if (check.checked) {
    contenedor.style.display = "block";
  } else {
    contenedor.style.display = "none";
    document.getElementById("num-personas").value = 1; // Resetear valor
  }
}
