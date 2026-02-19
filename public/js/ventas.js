// ventas.js - Proyecto Las Trompetas (VERSIÓN FINAL LIMPIA)

// --- VARIABLES GLOBALES ---
let carrito = [];
let todosLosProductos = [];
const CATEGORIAS_DEFINIDAS = [
  "Todas",
  "Cervezas",
  "Rones",
  "Brandy",
  "Aguardientes",
  "Whisky",
  "Gaseosas",
  "Hidratantes",
  "Otros",
];

// --- INICIALIZACIÓN PRINCIPAL ---
document.addEventListener("DOMContentLoaded", function () {
  // 1. Verificar quién es el usuario antes de nada
  verificarSesionVentas();

  // 2. Iniciar Materialize
  M.AutoInit();

  // 3. Cargar productos
  cargarDatos();
});

// --- SISTEMA DE SEGURIDAD Y ROLES (IGUAL QUE INVENTARIO) ---
function verificarSesionVentas() {
  console.log("🔒 Verificando permisos de Ventas...");

  // 1. Buscar sesión (Soporta ambos nombres de variable)
  const sesionGuardada =
    localStorage.getItem("usuarioNombre") ||
    localStorage.getItem("usuarioActual");

  // 2. Si no hay sesión, al Login
  if (!sesionGuardada) {
    console.warn("No hay sesión. Redirigiendo a Login.");
    window.location.href = "../index.html";
    return;
  }

  let usuario = null;

  // 3. Intento de lectura inteligente (JSON vs Texto)
  try {
    usuario = JSON.parse(sesionGuardada);
  } catch (error) {
    // Si falla, es texto plano (Legacy). Creamos un objeto temporal.
    // Asumimos rol VENDEDOR por seguridad si no se sabe, o ADMIN si el texto es "admin"
    usuario = {
      nombre: sesionGuardada,
      rol: sesionGuardada.toLowerCase() === "admin" ? "ADMIN" : "VENDEDOR",
    };
    // Auto-reparación
    localStorage.setItem("usuarioNombre", JSON.stringify(usuario));
  }

  // 4. Validar objeto usuario
  if (!usuario) {
    window.location.href = "../index.html";
    return;
  }

  // 5. GESTIÓN DEL BOTÓN DE ADMIN
  // Buscamos el botón que lleva al Dashboard/Inventario
  const btnAdmin = document.getElementById("btn-admin");

  // Normalizamos el rol a mayúsculas para comparar
  const rol = (usuario.rol || "").toUpperCase();
  const esAdmin = ["ADMIN", "ADMINISTRADOR", "JEFE", "ENCARGADO"].includes(rol);

  if (btnAdmin) {
    if (esAdmin) {
      // Es Admin: Mostrar botón
      btnAdmin.style.display = "inline-flex";
    } else {
      // Es Vendedor: Ocultar y eliminar botón para que no estorbe
      btnAdmin.style.display = "none";
      btnAdmin.remove();
    }
  }

  console.log(`✅ Sesión iniciada como: ${usuario.nombre} (${rol})`);
}

// --- FUNCIONES DE UTILIDAD ---
function cerrarSesion() {
  if (confirm("¿Cerrar sesión?")) {
    localStorage.clear();
    window.location.replace("/");
  }
}

function formatearNombreImagen(nombre) {
  if (!nombre) return "temp.jpg";
  return (
    nombre
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "") + ".jpg"
  );
}

// --- CARGA DE DATOS ---
async function cargarDatos() {
  try {
    const res = await fetch("/api/inventario/ver");
    if (!res.ok) throw new Error("Error server");
    todosLosProductos = await res.json();

    generarMenuCategorias();
    renderizarCatalogo(todosLosProductos);
  } catch (error) {
    console.error(error);
    M.toast({ html: "Error de conexión con inventario", classes: "red" });
  }
}

// --- GENERACIÓN DE MENÚS ---
function generarMenuCategorias() {
  const menuDesktop = document.getElementById("menu-categorias");
  const menuMobile = document.getElementById("menu-categorias-movil");

  const iconos = {
    Todas: "grid_view",
    Cervezas: "sports_bar",
    Rones: "liquor",
    Brandy: "local_bar",
    Aguardientes: "whatshot",
    Whisky: "wine_bar",
    Gaseosas: "opacity",
    Hidratantes: "local_drink",
    Otros: "more_horiz",
  };

  let htmlDesktop = `<div class="indigo lighten-5" style="padding:15px; font-weight:bold; color:#1a237e">CATEGORÍAS</div>`;
  let htmlMobile = ``;

  CATEGORIAS_DEFINIDAS.forEach((cat) => {
    const icon = iconos[cat] || "label";
    const isActive = cat === "Todas" ? "active" : "";
    const isMobileActive = cat === "Todas" ? "indigo white-text" : "";

    htmlDesktop += `
            <div class="cat-item ${isActive}" onclick="filtrarPorCategoria('${cat}', this, false)">
                <i class="material-icons">${icon}</i> ${cat}
            </div>`;

    htmlMobile += `
            <div class="chip ${isMobileActive}" onclick="filtrarPorCategoria('${cat}', this, true)">
                ${cat}
            </div>`;
  });

  if (menuDesktop) menuDesktop.innerHTML = htmlDesktop;
  if (menuMobile) menuMobile.innerHTML = htmlMobile;
}

// --- RENDERIZADO DE PRODUCTOS ---
function renderizarCatalogo(lista, categoria = "Todas") {
  const contenedor = document.getElementById("catalogo-productos");
  contenedor.innerHTML = "";

  if (lista.length === 0) {
    contenedor.innerHTML = `<div class="col s12 center-align grey-text" style="margin-top:50px">
            <i class="material-icons large">search_off</i>
            <h5>No hay productos aquí</h5>
        </div>`;
    return;
  }

  lista.forEach((p) => {
    const stock = Number(p.cantidad);
    const precio = Number(p.precio);
    const nombreSafe = p.nombre.replace(/'/g, "\\'");

    let badgeColor = "green";
    let disabled = "";

    if (stock <= 0) {
      badgeColor = "grey";
      disabled =
        "style='pointer-events:none; filter:grayscale(1); opacity:0.6'";
    } else if (stock < 5) {
      badgeColor = "red";
    }

    const imgUrl = `img/${formatearNombreImagen(p.nombre)}`;
    // Usamos una imagen transparente o placeholder local si prefieres
    const imagenError = "https://via.placeholder.com/150?text=Sin+Foto";

    contenedor.innerHTML += `
            <div class="col s6 m4 l3">
                <div class="card product-card hoverable" ${disabled} onclick="agregarAlCarrito('${nombreSafe}', ${precio}, ${stock})" style="height: 100%; min-height: 320px; display: flex; flex-direction: column;">
                    <div class="card-image" style="height: 150px; padding: 10px; display: flex; align-items: center; justify-content: center;">
                        <img src="${imgUrl}" style="max-height: 100%; width: auto;" onerror="this.onerror=null; this.src='${imagenError}'">
                    </div>
                    <div class="card-content" style="flex-grow: 1; display: flex; flex-direction: column; justify-content: space-between; padding: 10px;">
                        <span style="font-weight:600; font-size:1rem; line-height: 1.2; display: block; margin-bottom: 8px; color: #333;">
                            ${p.nombre}
                        </span>
                        
                        <div>
                            <div class="product-price" style="font-size: 1.2rem; color: #1a237e; font-weight: bold;">$${precio.toLocaleString()}</div>
                            <span class="new badge ${badgeColor}" data-badge-caption="stock" style="float:none; margin:5px auto 0; padding: 2px 8px; border-radius:4px;">${stock}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
  });
}

// --- FILTROS Y BÚSQUEDA ---
function filtrarPorCategoria(categoria, elementoDOM, esMovil = false) {
  if (esMovil) {
    const contenedorMovil = document.getElementById("menu-categorias-movil");
    if (contenedorMovil) {
      contenedorMovil.querySelectorAll(".chip").forEach((chip) => {
        chip.classList.remove("indigo", "white-text");
      });
    }
    if (elementoDOM) {
      elementoDOM.classList.add("indigo", "white-text");
    }
  } else {
    document
      .querySelectorAll(".cat-item")
      .forEach((el) => el.classList.remove("active"));
    if (elementoDOM) elementoDOM.classList.add("active");
  }

  const filtrados =
    categoria === "Todas"
      ? todosLosProductos
      : todosLosProductos.filter((p) => p.categoria === categoria);

  renderizarCatalogo(filtrados, categoria);
}

function buscarProductoVenta() {
  const texto = document.getElementById("busqueda-venta").value.toLowerCase();
  const filtrados = todosLosProductos.filter(
    (p) =>
      p.nombre.toLowerCase().includes(texto) ||
      (p.categoria && p.categoria.toLowerCase().includes(texto)),
  );
  renderizarCatalogo(filtrados);
}

// --- LÓGICA DEL CARRITO ---
function agregarAlCarrito(nombre, precio, stockMax) {
  const item = carrito.find((i) => i.nombre === nombre);

  if (item) {
    if (item.cantidad < stockMax) {
      item.cantidad++;
      M.toast({
        html: "Agregado +1",
        classes: "green rounded",
        displayLength: 1000,
      });
    } else {
      M.toast({ html: "¡Stock máximo alcanzado!", classes: "orange rounded" });
    }
  } else {
    carrito.push({ nombre, precio, cantidad: 1, stockMax });
    M.toast({
      html: "Producto agregado",
      classes: "green rounded",
      displayLength: 1000,
    });
  }
  actualizarInterfazCarrito();
}

function actualizarInterfazCarrito() {
  const lista = document.getElementById("lista-carrito");
  const badge = document.getElementById("badge-cart");
  const totalEl = document.getElementById("total-venta");

  lista.innerHTML = "";
  let total = 0;
  let itemsCount = 0;

  carrito.forEach((item, index) => {
    total += item.precio * item.cantidad;
    itemsCount += item.cantidad;

    lista.innerHTML += `
            <li class="collection-item avatar" style="min-height: auto; padding-left: 15px;">
                <div style="display:flex; justify-content:space-between; align-items:center; width:100%">
                    <div style="flex-grow:1">
                        <span class="title" style="font-weight:bold">${item.nombre}</span>
                        <p class="grey-text">$${item.precio.toLocaleString()} x ${item.cantidad} = <span class="indigo-text">$${(item.precio * item.cantidad).toLocaleString()}</span></p>
                    </div>
                    
                    <div class="secondary-content" style="display:flex; align-items:center; gap:10px; position:static">
                        <button class="btn-small btn-flat red-text" onclick="modificarCantidad(${index}, -1)"><i class="material-icons">remove_circle_outline</i></button>
                        <span style="font-size:1.2em; font-weight:bold">${item.cantidad}</span>
                        <button class="btn-small btn-flat green-text" onclick="modificarCantidad(${index}, 1)"><i class="material-icons">add_circle_outline</i></button>
                    </div>
                </div>
            </li>
        `;
  });

  if (carrito.length === 0) {
    lista.innerHTML =
      "<div class='center padding-20 grey-text'>Carrito vacío</div>";
  }

  totalEl.innerText = total.toLocaleString();
  badge.innerText = itemsCount;
  badge.style.display = itemsCount > 0 ? "block" : "none";
}

function modificarCantidad(index, delta) {
  const item = carrito[index];

  if (delta > 0) {
    if (item.cantidad < item.stockMax) {
      item.cantidad++;
    } else {
      M.toast({ html: "No hay más stock", classes: "orange" });
    }
  } else {
    item.cantidad--;
    if (item.cantidad === 0) {
      carrito.splice(index, 1);
    }
  }
  actualizarInterfazCarrito();
}

// --- FINALIZAR VENTA ---
async function confirmarVenta() {
  if (carrito.length === 0) return M.toast({ html: "El carrito está vacío" });

  // Verificar si se seleccionó la opción de personas
  const checkPersonas = document.getElementById("check-personas");
  const personasInput = document.getElementById("num-personas");
  let numPersonas = 0;

  // Solo leemos el valor si el checkbox existe y está marcado
  if (checkPersonas && checkPersonas.checked) {
    numPersonas = parseInt(personasInput.value) || 0;
  }

  // Obtenemos el nombre del usuario de la sesión (Seguro gracias a verificarSesionVentas)
  let vendedorNombre = "Vendedor";
  try {
    const sesion = JSON.parse(localStorage.getItem("usuarioNombre"));
    if (sesion && sesion.nombre) vendedorNombre = sesion.nombre;
  } catch (e) {
    vendedorNombre = localStorage.getItem("usuarioNombre") || "Vendedor";
  }

  const datosVenta = {
    carrito: carrito,
    vendedor: vendedorNombre,
    total: carrito.reduce((sum, i) => sum + i.precio * i.cantidad, 0),
    idVenta: "V-" + Date.now() + "-" + Math.random().toString(36).substr(2, 5),
    numPersonas: numPersonas,
  };

  try {
    const res = await fetch("/api/ventas/confirmar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datosVenta),
    });

    if (res.ok) {
      M.toast({
        html: "¡Venta Realizada con Éxito!",
        classes: "green darken-2 rounded",
      });

      // Limpieza
      carrito = [];
      actualizarInterfazCarrito();

      const modalPedido = document.getElementById("modal-pedido");
      if (modalPedido) M.Modal.getInstance(modalPedido).close();

      // Refrescar inventario
      cargarDatos();

      // Resetear personas
      if (checkPersonas) {
        checkPersonas.checked = false;
        togglePersonas();
      }
    } else {
      M.toast({ html: "Error al registrar venta", classes: "red" });
    }
  } catch (e) {
    console.error(e);
    M.toast({ html: "Error de conexión", classes: "red" });
  }
}

function togglePersonas() {
  const check = document.getElementById("check-personas");
  const div = document.getElementById("contenedor-personas");
  if (check && div) {
    div.style.display = check.checked ? "block" : "none";
  }
}
