// inventory.js - Las Trompetas (Versión Premium)

document.addEventListener("DOMContentLoaded", () => {
    verificarSeguridadInventario();
    if(typeof M !== 'undefined' && M.AutoInit) M.AutoInit();
    if(typeof M !== 'undefined' && M.FormSelect) M.FormSelect.init(document.querySelectorAll('select'));
    cargarInventario();
    
    // Iniciar Polling de Pedidos en Vivo
    cargarPedidos();
    setInterval(cargarPedidos, 5000); // Actualiza cada 5 segundos
});

// ── SEGURIDAD ─────────────────────────────────────────────
function verificarSeguridadInventario() {
    const sesionGuardada = localStorage.getItem("usuarioNombre") || localStorage.getItem("usuarioActual");
    if (!sesionGuardada) { window.location.href = "../index.html"; return; }

    let usuario = null;
    try {
        usuario = JSON.parse(sesionGuardada);
    } catch {
        usuario = { nombre: sesionGuardada, rol: "ADMIN" };
        localStorage.setItem("usuarioNombre", JSON.stringify(usuario));
    }

    if (!usuario) { window.location.href = "../index.html"; return; }
    if (!usuario.rol) usuario.rol = "ADMIN";

    const rol = usuario.rol.toUpperCase();
    const rolesPermitidos = ["ADMIN", "ADMINISTRADOR", "JEFE", "ENCARGADO"];

    if (!rolesPermitidos.includes(rol)) {
        alert("⛔ No tienes permisos para modificar el inventario.");
        window.location.href = "ventas.html";
    } else {
        document.body.style.display = "flex";
    }
}

// ── VISTA PREVIA IMAGEN ───────────────────────────────────
const inputImg = document.getElementById("input-imagen");
if (inputImg) {
    inputImg.addEventListener("change", function () {
        const reader = new FileReader();
        const preview = document.getElementById("preview-img");
        reader.onload = (e) => {
            if (preview) { preview.src = e.target.result; preview.style.display = "block"; }
        };
        if (this.files[0]) reader.readAsDataURL(this.files[0]);
    });
}

// ── CARGAR INVENTARIO ─────────────────────────────────────
let inventarioGlobal = [];

async function cargarInventario() {
    try {
        const res = await fetch("/api/inventario/ver");
        if (!res.ok) throw new Error("Error del servidor");
        const productos = await res.json();
        inventarioGlobal = productos;

        const tabla = document.getElementById("tabla-cuerpo");
        if (!tabla) return;
        tabla.innerHTML = "";

        // KPIs
        let totalProductos = productos.length;
        let stockBajo = 0;
        let valorInventario = 0;

        productos.forEach((p) => {
            const nombre   = p.nombre   || '';
            const categoria = p.categoria || 'Otros';
            const cantidad = Number(p.cantidad) || 0;
            const precio   = Number(p.precio)   || 0;
            const costo    = Number(p.costo)     || 0;

            // Acumular KPIs
            if (cantidad <= 5) stockBajo++;
            valorInventario += cantidad * costo;

            // Badge stock
            const stockBadge = cantidad <= 5
                ? `<span class="stock-badge low">⚠ ${cantidad}</span>`
                : `<span class="stock-badge ok">${cantidad}</span>`;

            // Escapar para onclick
            const nombreSafe = nombre.replace(/'/g, "\\'");
            const catSafe    = categoria.replace(/'/g, "\\'");

            tabla.innerHTML += `
                <tr>
                    <td style="padding-left:20px;font-weight:500;">${nombre}</td>
                    <td><span class="cat-chip">${categoria}</span></td>
                    <td class="center">${stockBadge}</td>
                    <td style="font-weight:600;color:var(--green-800);font-family:'DM Mono',monospace;">
                        $${precio.toLocaleString()}
                    </td>
                    <td style="color:var(--text-muted);font-family:'DM Mono',monospace;">
                        $${costo.toLocaleString()}
                    </td>
                    <td class="center" style="white-space:nowrap;">
                        <button class="btn-icon edit"
                                onclick="abrirModalEditar('${nombreSafe}','${catSafe}',${cantidad},${precio},${costo})"
                                title="Editar">
                            <i class="material-icons">edit</i>
                        </button>
                        <button class="btn-icon del" style="margin-left:4px;"
                                onclick="prepararEliminacion('${nombreSafe}')"
                                title="Eliminar">
                            <i class="material-icons">delete</i>
                        </button>
                    </td>
                </tr>`;
        });

        // Actualizar KPIs
        const fmt = v => new Intl.NumberFormat("es-CO", { style:"currency", currency:"COP", maximumFractionDigits:0 }).format(v);
        const setKpi = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };

        setKpi("kpi-total-productos", totalProductos);
        setKpi("kpi-stock-bajo",      stockBajo);
        setKpi("kpi-valor-inv",       fmt(valorInventario));

        // Color KPI stock bajo
        const kpiStockEl = document.getElementById("kpi-stock-bajo");
        if (kpiStockEl && stockBajo > 0) kpiStockEl.style.color = "var(--red-800)";

    } catch (e) {
        console.error("Error cargando inventario", e);
        M.toast({ html: "No se pudo cargar el inventario", classes: "red" });
    }
}

// ── MODALES INVENTARIO ────────────────────────────────────
function abrirModalEditar(nombre, categoria, cantidad, precio, costo) {
    document.getElementById("edit-nombre-original").value = nombre;
    document.getElementById("edit-nombre").value = nombre;

    const selectCat = document.getElementById("edit-categoria");
    if (selectCat) selectCat.value = categoria;

    document.getElementById("edit-cantidad").value = cantidad;
    document.getElementById("edit-precio").value   = precio;
    if (document.getElementById("edit-costo"))
        document.getElementById("edit-costo").value = costo || 0;

    M.updateTextFields();
    M.FormSelect.init(document.querySelectorAll('select'));
    M.Modal.getInstance(document.getElementById("modal-editar")).open();
}

function prepararEliminacion(nombre) {
    document.getElementById("nombre-eliminar-display").innerText = nombre;
    document.getElementById("nombre-eliminar-hidden").value = nombre;
    M.Modal.getInstance(document.getElementById("modal-eliminar")).open();
}

// ── ACTUALIZAR PRODUCTO ───────────────────────────────────
async function actualizarProducto() {
    const g = id => document.getElementById(id)?.value || "";
    const datos = {
        nombreOriginal: g("edit-nombre-original"),
        nombreNuevo:    g("edit-nombre"),
        categoria:      g("edit-categoria"),
        cantidad:       g("edit-cantidad"),
        precio:         g("edit-precio"),
        costo:          g("edit-costo"),
    };
    if (!datos.nombreNuevo || !datos.precio)
        return M.toast({ html:"Nombre y Precio requeridos", classes:"red" });

    try {
        const res = await fetch("/api/inventario/editar", {
            method:"PUT", headers:{"Content-Type":"application/json"},
            body: JSON.stringify(datos),
        });
        if (res.ok) {
            M.toast({ html:"Producto actualizado ✅", classes:"green rounded" });
            M.Modal.getInstance(document.getElementById("modal-editar")).close();
            cargarInventario();
        } else {
            M.toast({ html:"Error al actualizar", classes:"red rounded" });
        }
    } catch(e) { M.toast({ html:"Error de conexión", classes:"red" }); }
}

// ── GUARDAR NUEVO PRODUCTO ────────────────────────────────
async function guardarProducto() {
    const formData = new FormData();
    const nombre   = document.getElementById("nombre").value;
    const categoria = document.getElementById("categoria").value;
    const cantidad = document.getElementById("cantidad").value;
    const precio   = document.getElementById("precio").value;
    const costo    = document.getElementById("costo").value;
    const imagen   = document.getElementById("input-imagen").files[0];

    if (!nombre) return M.toast({ html:"Escribe un nombre", classes:"red" });

    formData.append("nombre",    nombre);
    formData.append("categoria", categoria || "Otros");
    formData.append("cantidad",  cantidad  || 0);
    formData.append("precio",    precio    || 0);
    formData.append("costo",     costo     || 0);
    if (imagen) formData.append("imagen", imagen);

    try {
        const res = await fetch("/api/inventario/agregar", { method:"POST", body:formData });
        if (res.ok) {
            M.toast({ html:"Producto guardado ✅", classes:"green rounded" });
            ["nombre","cantidad","precio","costo","input-imagen"].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = "";
            });
            const prev = document.getElementById("preview-img");
            if (prev) prev.style.display = "none";
            cargarInventario();
        } else {
            M.toast({ html:"Error al guardar", classes:"red" });
        }
    } catch(e) { console.error(e); }
}

// ── ELIMINAR PRODUCTO ─────────────────────────────────────
async function confirmarBorrado() {
    const nombre = document.getElementById("nombre-eliminar-hidden").value;
    try {
        const res = await fetch("/api/inventario/eliminar", {
            method:"DELETE", headers:{"Content-Type":"application/json"},
            body: JSON.stringify({ nombre }),
        });
        if (res.ok) {
            M.toast({ html:"Producto eliminado", classes:"orange rounded" });
            M.Modal.getInstance(document.getElementById("modal-eliminar")).close();
            cargarInventario();
        }
    } catch(e) { console.error(e); }
}

// ── PEDIDOS EN VIVO E HISTORIAL ────────────────────────────
let ventasHistorialGlobal = [];

async function cargarPedidos() {
    try {
        const res = await fetch("/api/ventas/historial?t=" + Date.now());
        if (!res.ok) return;
        let ventas = await res.json();
        ventasHistorialGlobal = ventas;
        
        // Ordenar más recientes primero
        ventas.reverse();

        // Separar pendientes de completados
        const pendientes = ventas.filter(v => v.estado !== "despachado" && v.estado !== "anulado");
        const completados = ventas.filter(v => v.estado === "despachado" || v.estado === "anulado");

        renderizarPedidosEnVivo(pendientes);
        renderizarHistorialStock(completados);
    } catch(e) {
        console.error("Error cargando pedidos:", e);
    }
}

function renderizarPedidosEnVivo(pendientes) {
    const tbody = document.getElementById("tabla-pedidos");
    if (!tbody) return;

    if (pendientes.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="px-6 py-8 text-center text-slate-400 font-medium">No hay pedidos pendientes en este momento.</td></tr>`;
        return;
    }

    let html = "";
    pendientes.forEach(v => {
        const fecha = new Date(v.fecha);
        const hora = fecha.toLocaleTimeString('es-CO', {hour: '2-digit', minute:'2-digit'});
        const total = new Intl.NumberFormat("es-CO", { style:"currency", currency:"COP", maximumFractionDigits:0 }).format(v.total);
        
        let detalleHtml = v.items.map(i => `<div class="text-sm"><b>${i.cantidad}x</b> ${i.nombre}</div>`).join("");

        html += `
            <tr class="hover:bg-slate-50 transition-colors">
                <td class="px-6 py-4 text-sm font-bold text-slate-700">${hora}</td>
                <td class="px-6 py-4 text-sm font-medium text-slate-600 flex items-center gap-2">
                    <div class="w-6 h-6 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[10px] font-bold">
                        ${v.vendedor.charAt(0).toUpperCase()}
                    </div>
                    ${v.vendedor}
                </td>
                <td class="px-6 py-4">${detalleHtml}</td>
                <td class="px-6 py-4 text-sm font-black text-rose-600 mono-text">${total}</td>
                <td class="px-6 py-4">
                    <span class="bg-amber-100 text-amber-800 border border-amber-200 px-3 py-1 rounded-full text-xs font-bold shadow-sm">
                        Pendiente
                    </span>
                </td>
                <td class="px-6 py-4 text-center">
                    <button onclick="cambiarEstadoPedido('${v.id}', 'despachado')" class="bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white border border-emerald-200 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-all flex items-center gap-1 mx-auto">
                        <i class="material-icons text-[16px]">check_circle</i> Despachar
                    </button>
                </td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

function renderizarHistorialStock(completados) {
    const tbody = document.getElementById("tabla-historial");
    if (!tbody) return;

    if (completados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-8 text-center text-slate-400 font-medium">No hay historial reciente.</td></tr>`;
        return;
    }

    let html = "";
    // Mostrar solo los últimos 20
    completados.slice(0, 20).forEach(v => {
        const fecha = new Date(v.fecha);
        const fechaStr = fecha.toLocaleString('es-CO', {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'});
        const total = new Intl.NumberFormat("es-CO", { style:"currency", currency:"COP", maximumFractionDigits:0 }).format(v.total);
        let detalleTxt = v.items.map(i => `${i.cantidad}x ${i.nombre}`).join(", ");
        if(detalleTxt.length > 40) detalleTxt = detalleTxt.substring(0, 40) + "...";

        html += `
            <tr class="hover:bg-slate-50 transition-colors">
                <td class="px-6 py-4 text-xs font-medium text-slate-500">${fechaStr}</td>
                <td class="px-6 py-4 text-sm font-medium text-slate-700">${v.vendedor}</td>
                <td class="px-6 py-4 text-xs text-slate-600">${detalleTxt}</td>
                <td class="px-6 py-4 text-sm font-black text-slate-800 mono-text">${total}</td>
                <td class="px-6 py-4 flex gap-2 justify-center items-center">
                    <span class="bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded text-[10px] font-bold uppercase hidden sm:inline-block">
                        ${v.estado}
                    </span>
                    <button onclick="abrirModalEditarVenta('${v.id}')" title="Editar" class="text-brand-600 hover:bg-brand-50 p-1.5 rounded-lg transition-colors">
                        <i class="material-icons text-[18px]">edit</i>
                    </button>
                    <button onclick="eliminarVenta('${v.id}')" title="Anular" class="text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition-colors">
                        <i class="material-icons text-[18px]">delete</i>
                    </button>
                </td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

async function cambiarEstadoPedido(idVenta, nuevoEstado) {
    try {
        const res = await fetch("/api/ventas/estado", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ idVenta, nuevoEstado })
        });
        if (res.ok) {
            if(typeof showToast === 'function') showToast("Pedido " + nuevoEstado, "success");
            else if(typeof M !== 'undefined') M.toast({html: "Pedido " + nuevoEstado, classes: "green"});
            cargarPedidos();
            cargarInventario(); // Refrescar stock
        }
    } catch(e) {
        console.error(e);
    }
}

async function eliminarVenta(idVenta) {
    if (!confirm("¿Estás seguro de anular/eliminar este pedido? El stock será devuelto.")) return;
    try {
        const res = await fetch("/api/ventas/" + encodeURIComponent(idVenta), { method: "DELETE" });
        if (res.ok) {
            if(typeof showToast === 'function') showToast("Venta eliminada", "success");
            cargarPedidos();
            cargarInventario();
        }
    } catch(e) {
        console.error(e);
    }
}

let itemsEdicionVenta = [];
function abrirModalEditarVenta(id) {
    const venta = ventasHistorialGlobal.find(v => v.id === id);
    if (!venta) return;
    
    document.getElementById("edit-venta-id").value = venta.id;
    document.getElementById("edit-venta-vendedor").value = venta.vendedor;
    
    if (venta.fecha) {
        const d = new Date(venta.fecha);
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        document.getElementById("edit-venta-fecha").value = d.toISOString().slice(0, 16);
    }
    
    itemsEdicionVenta = JSON.parse(JSON.stringify(venta.items || []));
    renderizarItemsEdicionVenta();
    
    if (typeof openModal === 'function') openModal("modal-editar-venta");
    else if (M.Modal) M.Modal.getInstance(document.getElementById("modal-editar-venta")).open();
}

function renderizarItemsEdicionVenta() {
    const tbody = document.getElementById("edit-items-tbody");
    if (!tbody) return;
    
    // Inyectar el datalist si no existe
    let datalist = document.getElementById("lista-productos-inventario");
    if (!datalist) {
        datalist = document.createElement("datalist");
        datalist.id = "lista-productos-inventario";
        document.body.appendChild(datalist);
    }
    
    // Poblar datalist
    datalist.innerHTML = "";
    inventarioGlobal.forEach(p => {
        const option = document.createElement("option");
        option.value = p.nombre;
        datalist.appendChild(option);
    });
    
    let html = "";
    let total = 0;
    
    itemsEdicionVenta.forEach((item, index) => {
        const subtotal = item.cantidad * item.precio;
        total += subtotal;
        
        html += `
            <tr>
                <td class="p-3">
                    <input type="text" list="lista-productos-inventario" class="w-full text-sm border-slate-200 rounded-lg p-2" value="${item.nombre}" onchange="actualizarItemEdicion(${index}, 'nombre', this.value)" placeholder="Buscar producto...">
                </td>
                <td class="p-3">
                    <input type="number" class="w-full text-sm border-slate-200 rounded-lg p-2 text-center" value="${item.cantidad}" onchange="actualizarItemEdicion(${index}, 'cantidad', this.value)">
                </td>
                <td class="p-3">
                    <input type="number" class="w-full text-sm border-slate-200 rounded-lg p-2 text-center" value="${item.precio}" onchange="actualizarItemEdicion(${index}, 'precio', this.value)">
                </td>
                <td class="p-3 text-center text-sm font-bold text-slate-700">
                    $${subtotal.toLocaleString()}
                </td>
                <td class="p-3 text-center">
                    <button onclick="eliminarItemEdicion(${index})" class="text-rose-500 hover:bg-rose-50 p-1 rounded-md">
                        <i class="material-icons text-[16px]">close</i>
                    </button>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
    document.getElementById("edit-venta-total-display").innerText = new Intl.NumberFormat("es-CO", { style:"currency", currency:"COP", maximumFractionDigits:0 }).format(total);
}

function actualizarItemEdicion(index, campo, valor) {
    if (campo === 'cantidad' || campo === 'precio') valor = Number(valor) || 0;
    itemsEdicionVenta[index][campo] = valor;
    
    // Autocompletar precio si se cambia el nombre
    if (campo === 'nombre') {
        const prod = inventarioGlobal.find(p => p.nombre.toLowerCase() === valor.toLowerCase());
        if (prod && prod.precio) {
            itemsEdicionVenta[index].precio = Number(prod.precio);
        }
    }
    
    renderizarItemsEdicionVenta();
}

function agregarFilaItem() {
    itemsEdicionVenta.push({ nombre: "", cantidad: 1, precio: 0 });
    renderizarItemsEdicionVenta();
}

function eliminarItemEdicion(index) {
    itemsEdicionVenta.splice(index, 1);
    renderizarItemsEdicionVenta();
}

async function guardarEdicionVenta() {
    const id = document.getElementById("edit-venta-id").value;
    const vendedor = document.getElementById("edit-venta-vendedor").value;
    const fecha = document.getElementById("edit-venta-fecha").value;
    
    if (!vendedor || !fecha || itemsEdicionVenta.length === 0) {
        if(typeof showToast === 'function') showToast("Faltan datos o items", "warning");
        return;
    }
    
    try {
        const res = await fetch("/api/ventas/" + encodeURIComponent(id), {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ vendedor, fecha, itemsNuevos: itemsEdicionVenta })
        });
        
        if (res.ok) {
            if(typeof showToast === 'function') showToast("Venta editada con éxito", "success");
            if (typeof closeModal === 'function') closeModal("modal-editar-venta");
            cargarPedidos();
            cargarInventario();
        }
    } catch(e) {
        console.error(e);
    }
}

// ── FILTRAR BÚSQUEDA ──────────────────────────────────────
function filtrarProductos() {
    const texto = document.getElementById('busqueda-venta').value.toLowerCase();
    document.querySelectorAll('#tabla-cuerpo tr').forEach(fila => {
        fila.style.display = fila.innerText.toLowerCase().includes(texto) ? "" : "none";
    });
}

function cerrarSesion() {
    if (confirm("¿Cerrar sesión?")) {
        localStorage.clear();
        window.location.replace("/");
    }
}

// ── FILTRO DE FECHAS — MOVIMIENTOS RECIENTES ──────────────
// Estas funciones son llamadas desde inventario.html (botones del encabezado de la tabla)
function aplicarFiltroFechas() {
    const desde = document.getElementById('filtro-desde')?.value;
    const hasta = document.getElementById('filtro-hasta')?.value;

    if (!desde && !hasta) return;

    // Mostrar botón de limpiar
    const btnLimpiar = document.getElementById('btn-limpiar-filtro');
    if (btnLimpiar) btnLimpiar.classList.remove('hidden');

    const tbody = document.getElementById('tabla-historial');
    if (!tbody) return;

    const desdeDate = desde ? new Date(desde + 'T00:00:00') : null;
    const hastaDate = hasta ? new Date(hasta + 'T23:59:59') : null;

    const filtrados = ventasHistorialGlobal.filter(v => {
        const estado = v.estado;
        if (estado !== 'despachado' && estado !== 'anulado') return false;
        const fv = new Date(v.fecha);
        if (desdeDate && fv < desdeDate) return false;
        if (hastaDate && fv > hastaDate) return false;
        return true;
    });

    // Reutilizar el renderer pero sin modificar la variable global
    const completados = filtrados.slice().reverse().slice(0, 20);
    renderizarHistorialStock(completados);
}

function limpiarFiltros() {
    const desde = document.getElementById('filtro-desde');
    const hasta  = document.getElementById('filtro-hasta');
    if (desde) desde.value = '';
    if (hasta)  hasta.value  = '';

    const btnLimpiar = document.getElementById('btn-limpiar-filtro');
    if (btnLimpiar) btnLimpiar.classList.add('hidden');

    // Volver a renderizar sin filtro
    cargarPedidos();
}