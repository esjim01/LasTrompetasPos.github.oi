// ventas.js - Proyecto Las Trompetas (OPTIMIZADO)

// --- VARIABLES GLOBALES ---
let carrito = [];
let todosLosProductos = [];
const CATEGORIAS_DEFINIDAS = ["Todas", "Cervezas", "Rones", "Aguardientes", "Whisky", "Comida", "Otros"];

// --- VERIFICACIÓN DE SESIÓN ---
(function () {
    const rol = localStorage.getItem("usuarioRol");
    if (!rol) window.location.replace("/");

    document.addEventListener("DOMContentLoaded", () => {
        const liInventario = document.getElementById("li-inventario");
        // Solo ADMIN puede ver el botón de inventario en el nav
        if (liInventario && rol !== "ADMIN") {
            liInventario.style.display = "none";
        }
    });
})();

function cerrarSesion() {
    if(confirm("¿Cerrar sesión?")) {
        localStorage.clear();
        window.location.replace("/");
    }
}

// --- INICIO ---
document.addEventListener("DOMContentLoaded", function () {
    M.AutoInit();
    cargarDatos();
});

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

// --- GENERACIÓN DE MENÚS (Escritorio y Móvil) ---
function generarMenuCategorias() {
    const menuDesktop = document.getElementById("menu-categorias");
    const menuMobile = document.getElementById("menu-categorias-movil");
    
    if (!menuDesktop) return;

    const iconos = {
        Todas: "grid_view", Cervezas: "sports_bar", Rones: "liquor",
        Aguardientes: "local_bar", Whisky: "wine_bar", Comida: "restaurant", Otros: "more_horiz"
    };

    // HTML para escritorio (Lista vertical)
    let htmlDesktop = `<div class="indigo lighten-5" style="padding:15px; font-weight:bold; color:#1a237e">CATEGORÍAS</div>`;
    
    // HTML para móvil (Chips horizontales)
    let htmlMobile = ``;

    CATEGORIAS_DEFINIDAS.forEach(cat => {
        const icon = iconos[cat] || "label";
        const isActive = cat === "Todas" ? "active" : "";
        
        // Desktop
        htmlDesktop += `
            <div class="cat-item ${isActive}" onclick="filtrarPorCategoria('${cat}', this)">
                <i class="material-icons">${icon}</i> ${cat}
            </div>`;

        // Mobile
        htmlMobile += `
            <div class="chip ${isActive ? 'indigo white-text' : ''}" onclick="filtrarPorCategoria('${cat}', null, true)">
                ${cat}
            </div>`;
    });

    menuDesktop.innerHTML = htmlDesktop;
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

    lista.forEach(p => {
        const stock = Number(p.cantidad);
        const precio = Number(p.precio);
        const nombreSafe = p.nombre.replace(/'/g, "\\'"); // Escapar comillas simples
        
        // Lógica visual de Stock
        let badgeColor = "green";
        let disabled = "";
        let opacity = "1";
        
        if (stock <= 0) {
            badgeColor = "grey";
            disabled = "style='pointer-events:none; filter:grayscale(1); opacity:0.6'";
        } else if (stock < 5) {
            badgeColor = "red";
        }

        // Si la imagen falla, ponemos una genérica elegante
        const imgUrl = `img/${p.nombre.replace(/\s+/g, '_').toLowerCase()}.jpg`; 
        // Nota: En producción idealmente validas si existe la imagen, si no, usas placeholder.

        contenedor.innerHTML += `
            <div class="col s6 m4 l3">
                <div class="card product-card hoverable" ${disabled} onclick="agregarAlCarrito('${nombreSafe}', ${precio}, ${stock})">
                    <div class="card-image">
                        <img src="${imgUrl}" onerror="this.onerror=null; this.src='https://via.placeholder.com/150?text=Sin+Foto'">
                    </div>
                    <div class="card-content">
                        <span class="truncate" style="font-weight:500; font-size:1.1em" title="${p.nombre}">${p.nombre}</span>
                        <div class="product-price">$${precio.toLocaleString()}</div>
                        <span class="new badge ${badgeColor}" data-badge-caption="stock" style="float:none; margin:0 auto; padding: 2px 8px; border-radius:4px;">${stock}</span>
                    </div>
                </div>
            </div>
        `;
    });
}

// --- FILTROS Y BÚSQUEDA ---
function filtrarPorCategoria(categoria, elementoDOM, esMovil = false) {
    // Actualizar visualmente la selección
    if (!esMovil) {
        document.querySelectorAll('.cat-item').forEach(el => el.classList.remove('active'));
        if(elementoDOM) elementoDOM.classList.add('active');
    }

    const filtrados = categoria === "Todas" 
        ? todosLosProductos 
        : todosLosProductos.filter(p => p.categoria === categoria);
        
    renderizarCatalogo(filtrados, categoria);
}

function buscarProductoVenta() {
    const texto = document.getElementById("busqueda-venta").value.toLowerCase();
    const filtrados = todosLosProductos.filter(p => 
        p.nombre.toLowerCase().includes(texto) || 
        (p.categoria && p.categoria.toLowerCase().includes(texto))
    );
    renderizarCatalogo(filtrados);
}

// --- LÓGICA DEL CARRITO ---
function agregarAlCarrito(nombre, precio, stockMax) {
    const item = carrito.find(i => i.nombre === nombre);

    if (item) {
        if (item.cantidad < stockMax) {
            item.cantidad++;
            M.toast({ html: 'Agregado +1', classes: 'green rounded', displayLength: 1000 });
        } else {
            M.toast({ html: '¡Stock máximo alcanzado!', classes: 'orange rounded' });
        }
    } else {
        carrito.push({ nombre, precio, cantidad: 1, stockMax });
        M.toast({ html: 'Producto agregado', classes: 'green rounded', displayLength: 1000 });
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

    if(carrito.length === 0) {
        lista.innerHTML = "<div class='center padding-20 grey-text'>Carrito vacío</div>";
    }

    totalEl.innerText = total.toLocaleString();
    badge.innerText = itemsCount;
    
    // Ocultar badge si es 0
    badge.style.display = itemsCount > 0 ? 'block' : 'none';
}

function modificarCantidad(index, delta) {
    const item = carrito[index];
    
    if (delta > 0) {
        if (item.cantidad < item.stockMax) {
            item.cantidad++;
        } else {
            M.toast({html: 'No hay más stock', classes:'orange'});
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

    // Lógica de Personas
    const checkPersonas = document.getElementById("check-personas").checked;
    let numPersonas = 0;
    if (checkPersonas) {
        numPersonas = parseInt(document.getElementById("num-personas").value) || 0;
    }

    const datosVenta = {
        carrito: carrito,
        vendedor: localStorage.getItem("usuarioNombre") || "Vendedor",
        total: carrito.reduce((sum, i) => sum + (i.precio * i.cantidad), 0),
        idVenta: "V-" + Date.now(),
        numPersonas: numPersonas
    };

    try {
        const res = await fetch("/api/ventas/confirmar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(datosVenta),
        });

        if (res.ok) {
            M.toast({ html: "¡Venta Realizada con Éxito!", classes: "green darken-2 rounded" });
            
            // Limpieza
            carrito = [];
            actualizarInterfazCarrito();
            M.Modal.getInstance(document.getElementById("modal-pedido")).close();
            
            // Refrescar inventario (Stocks han cambiado)
            cargarDatos(); 
            
            // Opcional: Resetear personas
            document.getElementById("check-personas").checked = false;
            togglePersonas();

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
    div.style.display = check.checked ? "block" : "none";
}