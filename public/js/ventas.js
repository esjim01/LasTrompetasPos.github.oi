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
  "Ingresos Barra",
  "Ingresos Cafeteria",
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
    "Ingresos Barra": "attach_money",
    "Ingresos Cafeteria": "coffee",
    Otros: "more_horiz",
  };

  let htmlDesktop = `<div class="bg-slate-900 text-white p-4 font-bold rounded-xl mb-4 shadow-md flex items-center gap-2 uppercase tracking-wider text-xs"><i class="material-icons text-[18px]">category</i> CATEGORÍAS</div>`;
  let htmlMobile = ``;

  CATEGORIAS_DEFINIDAS.forEach((cat) => {
    const icon = iconos[cat] || "label";
    const isActive = cat === "Todas" ? "bg-brand-600 text-white shadow-lg shadow-brand-500/30" : "text-slate-500 hover:bg-slate-100 hover:text-slate-800";
    const isMobileActive = cat === "Todas" ? "bg-brand-600 text-white border-brand-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50";

    htmlDesktop += `
            <div class="cat-item flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold cursor-pointer transition-all duration-200 ${isActive} mb-1" onclick="filtrarPorCategoria('${cat}', this, false)">
                <i class="material-icons text-[20px]">${icon}</i> ${cat}
            </div>`;

    htmlMobile += `
            <div class="px-4 py-2 rounded-full text-sm font-bold border cursor-pointer whitespace-nowrap transition-all shadow-sm flex items-center gap-2 ${isMobileActive}" onclick="filtrarPorCategoria('${cat}', this, true)">
                <i class="material-icons text-[16px]">${icon}</i> ${cat}
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

    let badgeColor = "bg-emerald-100 text-emerald-700 border-emerald-200";
    let disabled = "";

    if (stock <= 0) {
      badgeColor = "bg-slate-100 text-slate-500 border-slate-200";
      disabled = "style='pointer-events:none; filter:grayscale(1); opacity:0.6'";
    } else if (stock < 5) {
      badgeColor = "bg-rose-100 text-rose-700 border-rose-200";
    }

    const imgUrl = `img/${formatearNombreImagen(p.nombre)}`;
    const imagenError = "https://via.placeholder.com/150?text=Sin+Foto";

    contenedor.innerHTML += `
            <div class="group bg-white rounded-2xl p-3 sm:p-4 shadow-sm border border-slate-200 hover:shadow-xl hover:border-brand-300 transition-all duration-300 flex flex-col h-full relative cursor-pointer overflow-hidden" ${disabled} onclick="agregarAlCarrito('${nombreSafe}', ${precio}, ${stock})">
                <!-- Hover effect background -->
                <div class="absolute inset-0 bg-gradient-to-b from-transparent to-brand-50/50 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                
                <!-- Image Container -->
                <div class="h-32 sm:h-40 bg-slate-50 rounded-xl mb-3 sm:mb-4 p-2 sm:p-3 flex items-center justify-center border border-slate-100 relative group-hover:scale-[1.02] transition-transform duration-300">
                    <img src="${imgUrl}" class="max-h-full max-w-full object-contain drop-shadow-md" onerror="this.onerror=null; this.src='${imagenError}'" alt="${p.nombre}">
                    
                    <!-- Add Button Overlay -->
                    <div class="absolute bottom-2 right-2 w-8 h-8 bg-brand-600 text-white rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg shadow-brand-500/30">
                        <i class="material-icons text-[18px]">add_shopping_cart</i>
                    </div>
                </div>

                <!-- Content -->
                <div class="flex-1 flex flex-col justify-between relative z-10">
                    <div>
                        <h3 class="font-bold text-slate-800 text-sm sm:text-base leading-tight mb-2 group-hover:text-brand-600 transition-colors line-clamp-2">${p.nombre}</h3>
                    </div>
                    
                    <div class="flex items-end justify-between mt-2 pt-3 border-t border-slate-100">
                        <div>
                            <p class="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Precio</p>
                            <p class="text-base sm:text-lg font-black text-slate-900 leading-none">$${precio.toLocaleString()}</p>
                        </div>
                        <div class="flex flex-col items-end">
                            <span class="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Stock</span>
                            <span class="px-2 py-0.5 rounded-md text-[10px] sm:text-xs font-bold border ${badgeColor}">${stock}</span>
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
      contenedorMovil.querySelectorAll("div").forEach((chip) => {
        chip.className = "px-4 py-2 rounded-full text-sm font-bold border cursor-pointer whitespace-nowrap transition-all shadow-sm flex items-center gap-2 bg-white text-slate-600 border-slate-200 hover:bg-slate-50";
      });
    }
    if (elementoDOM) {
      elementoDOM.className = "px-4 py-2 rounded-full text-sm font-bold border cursor-pointer whitespace-nowrap transition-all shadow-sm flex items-center gap-2 bg-brand-600 text-white border-brand-600";
    }
  } else {
    document.querySelectorAll(".cat-item").forEach((el) => {
        el.className = "cat-item flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold cursor-pointer transition-all duration-200 text-slate-500 hover:bg-slate-100 hover:text-slate-800 mb-1";
    });
    if (elementoDOM) {
        elementoDOM.className = "cat-item flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold cursor-pointer transition-all duration-200 bg-brand-600 text-white shadow-lg shadow-brand-500/30 mb-1";
    }
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
            <li class="bg-white border border-slate-100 p-3 sm:p-4 rounded-2xl shadow-sm flex items-center gap-3 sm:gap-4 transition-all hover:shadow-md">
                <div class="w-10 h-10 sm:w-12 sm:h-12 bg-slate-50 rounded-xl flex items-center justify-center flex-shrink-0 border border-slate-200">
                    <img src="img/${formatearNombreImagen(item.nombre)}" class="max-h-6 sm:max-h-8 max-w-6 sm:max-w-8 object-contain" onerror="this.onerror=null; this.src='https://via.placeholder.com/150?text=NA'">
                </div>
                
                <div class="flex-1 min-w-0">
                    <h4 class="font-bold text-slate-800 text-sm truncate">${item.nombre}</h4>
                    <p class="text-xs font-medium text-slate-500 mt-0.5">$${item.precio.toLocaleString()} c/u</p>
                </div>
                
                <div class="flex items-center gap-1 sm:gap-2 bg-slate-50 p-1 sm:p-1.5 rounded-lg border border-slate-200 flex-shrink-0">
                    <button class="w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center text-slate-500 hover:bg-white hover:text-rose-500 hover:shadow-sm rounded-md transition-all" onclick="modificarCantidad(${index}, -1)">
                        <i class="material-icons text-[16px] sm:text-[18px]">remove</i>
                    </button>
                    <span class="text-xs sm:text-sm font-black text-slate-800 min-w-[1.2rem] sm:min-w-[1.5rem] text-center">${item.cantidad}</span>
                    <button class="w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center text-slate-500 hover:bg-white hover:text-emerald-500 hover:shadow-sm rounded-md transition-all" onclick="modificarCantidad(${index}, 1)">
                        <i class="material-icons text-[16px] sm:text-[18px]">add</i>
                    </button>
                </div>
                
                <div class="text-right ml-1 sm:ml-2 min-w-[60px] sm:min-w-[70px] flex-shrink-0">
                    <p class="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Subtotal</p>
                    <p class="text-sm font-black text-brand-600">$${(item.precio * item.cantidad).toLocaleString()}</p>
                </div>
            </li>
        `;
  });

  if (carrito.length === 0) {
    lista.innerHTML = `
        <div class="text-center py-10 flex flex-col items-center">
            <div class="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
                <i class="material-icons text-slate-300 text-4xl">remove_shopping_cart</i>
            </div>
            <h4 class="font-bold text-slate-500">Tu carrito está vacío</h4>
            <p class="text-sm text-slate-400 mt-1">Agrega productos del catálogo para continuar.</p>
        </div>`;
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
