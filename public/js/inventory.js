// inventory.js - Las Trompetas (Versión Premium)

document.addEventListener("DOMContentLoaded", () => {
    verificarSeguridadInventario();
    M.AutoInit();
    M.FormSelect.init(document.querySelectorAll('select'));
    cargarInventario();
    cargarHistorial();
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
        document.body.style.display = "block";
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
async function cargarInventario() {
    try {
        const res = await fetch("/api/inventario/ver");
        if (!res.ok) throw new Error("Error del servidor");
        const productos = await res.json();

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

// ── HISTORIAL (backup — también lo maneja el HTML) ────────
async function cargarHistorial() {
    // Esta función es backup por si se carga la página sin el polling activo.
    // El polling principal está en inventario.html (cargarPedidos cada 5s).
    // Solo se usa si tabla-historial existe y pedidosCargados está vacío.
    try {
        const res = await fetch("/api/ventas/historial?t=" + Date.now());
        if (!res.ok) return;
        const ventas = await res.json();
        const tabla = document.getElementById("tabla-historial");
        if (!tabla || tabla.innerHTML.trim() !== "") return; // ya tiene datos del polling
        // Si llegamos aquí, renderizamos con los datos del API directamente
        if (typeof renderizarHistorialStock === "function") {
            renderizarHistorialStock(ventas.reverse ? ventas.reverse() : ventas);
        }
    } catch(e) { console.error("Error historial backup:", e); }
}

// ── FILTRAR BÚSQUEDA ──────────────────────────────────────
function filtrarProductos() {
    const texto = document.getElementById('busqueda-venta').value.toLowerCase();
    document.querySelectorAll('#tabla-cuerpo tr').forEach(fila => {
        fila.style.display = fila.innerText.toLowerCase().includes(texto) ? "" : "none";
    });
}

// ── CERRAR SESIÓN (fallback si Swal no carga) ─────────────
function cerrarSesion() {
    if (confirm("¿Cerrar sesión?")) {
        localStorage.clear();
        window.location.replace("/");
    }
}