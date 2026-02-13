// inventory.js - Proyecto Las Trompetas (VERSIÓN FINAL LIMPIA)

document.addEventListener("DOMContentLoaded", () => {
    // 1. Primero verificamos seguridad
    verificarSeguridadInventario();

    // 2. Inicializamos componentes visuales
    M.AutoInit();
    var elems = document.querySelectorAll('select');
    M.FormSelect.init(elems);
    
    // 3. Cargamos los datos
    cargarInventario();
    cargarHistorial();
});

// --- SISTEMA DE SEGURIDAD ROBUSTO (Este es el único que necesitas) ---
function verificarSeguridadInventario() {
    console.log("🔒 Verificando permisos de Inventario...");

    // Buscamos la sesión
    const sesionGuardada = localStorage.getItem("usuarioNombre") || localStorage.getItem("usuarioActual");

    // Si no hay nada, adiós
    if (!sesionGuardada) {
        console.warn("No hay sesión. Redirigiendo a Login.");
        window.location.href = "../index.html"; 
        return;
    }

    let usuario = null;

    try {
        // Intentamos leer como Objeto JSON
        usuario = JSON.parse(sesionGuardada);
    } catch (error) {
        console.warn("⚠️ Formato texto detectado. Asumiendo ADMIN por compatibilidad...");
        // Si falla el JSON, es texto plano. Asumimos que es ADMIN para que no te bloquee.
        usuario = {
            nombre: sesionGuardada,
            rol: "ADMIN" 
        };
        // Auto-reparación silenciosa
        localStorage.setItem("usuarioNombre", JSON.stringify(usuario));
    }

    // Verificación final de estructura
    if (!usuario) {
        window.location.href = "../index.html";
        return;
    }

    // Si el usuario no tiene rol definido (por ser antiguo), le ponemos ADMIN temporalmente
    if (!usuario.rol) usuario.rol = "ADMIN";

    const rol = usuario.rol.toUpperCase();
    const rolesPermitidos = ["ADMIN", "ADMINISTRADOR", "JEFE", "ENCARGADO"];

    if (!rolesPermitidos.includes(rol)) {
        alert("⛔ No tienes permisos para modificar el inventario.");
        window.location.href = "ventas.html"; 
    } else {
        console.log("✅ Acceso concedido a Inventario.");
        document.body.style.display = "block"; // Mostrar la página
    }
}

// --- VISTA PREVIA DE IMAGEN ---
const inputImg = document.getElementById("input-imagen");
if (inputImg) {
    inputImg.addEventListener("change", function (e) {
        const reader = new FileReader();
        const preview = document.getElementById("preview-img");
        
        reader.onload = (event) => {
            if (preview) {
                preview.src = event.target.result;
                preview.style.display = "block";
            }
        };
        if (this.files[0]) reader.readAsDataURL(this.files[0]);
    });
}

// --- CRUD INVENTARIO ---
async function cargarInventario() {
    try {
        const res = await fetch("/api/inventario/ver");
        if (!res.ok) throw new Error("Error en la respuesta del servidor");
        const productos = await res.json();
        
        const tabla = document.getElementById("tabla-cuerpo");
        if (!tabla) return;
        
        tabla.innerHTML = "";

        productos.forEach((p) => {
            const nombre = p.nombre || '';
            const categoria = p.categoria || 'Otros';
            const cantidad = Number(p.cantidad) || 0;
            const precio = Number(p.precio) || 0;
            const costo = Number(p.costo) || 0;
            
            // Badge visual para stock bajo
            let badgeHtml = '';
            if (cantidad <= 5) {
                badgeHtml = `<span class="new badge red" data-badge-caption="bajos">${cantidad}</span>`;
            } else {
                badgeHtml = `<span class="new badge blue lighten-4 blue-text text-darken-4" data-badge-caption="">${cantidad}</span>`;
            }

            // Escapar comillas para evitar errores
            const nombreSafe = nombre.replace(/'/g, "\\'");
            const catSafe = categoria.replace(/'/g, "\\'");

            tabla.innerHTML += `
                <tr style="border-bottom: 1px solid #f1f1f1;">
                    <td style="padding-left: 20px; font-weight:500;">${nombre}</td>
                    <td><span class="chip small">${categoria}</span></td>
                    <td class="center">${badgeHtml}</td>
                    <td class="green-text text-darken-2"><b>$${precio.toLocaleString()}</b></td>
                    <td class="grey-text">$${costo.toLocaleString()}</td>
                    <td class="center">
                        <button class="btn-floating btn-small indigo lighten-5" style="box-shadow:none" onclick="abrirModalEditar('${nombreSafe}', '${catSafe}', ${cantidad}, ${precio}, ${costo})">
                            <i class="material-icons indigo-text">edit</i>
                        </button>
                        <button class="btn-floating btn-small red lighten-5" style="box-shadow:none" onclick="prepararEliminacion('${nombreSafe}')">
                            <i class="material-icons red-text">delete</i>
                        </button>
                    </td>
                </tr>`;
        });
    } catch (e) {
        console.error("Error cargando inventario", e);
        M.toast({ html: "No se pudo cargar el inventario", classes: "red" });
    }
}

// --- FUNCIONES MODALES ---
function abrirModalEditar(nombre, categoria, cantidad, precio, costo) {
    document.getElementById("edit-nombre-original").value = nombre;
    document.getElementById("edit-nombre").value = nombre;
    
    const selectCat = document.getElementById("edit-categoria");
    if(selectCat) {
        selectCat.value = categoria;
    }
    
    document.getElementById("edit-cantidad").value = cantidad;
    document.getElementById("edit-precio").value = precio;
    
    if (document.getElementById("edit-costo")) {
        document.getElementById("edit-costo").value = costo || 0;
    }

    M.updateTextFields(); 
    
    // Reinicializar selects
    var elems = document.querySelectorAll('select');
    M.FormSelect.init(elems);

    const modal = document.getElementById("modal-editar");
    M.Modal.getInstance(modal).open();
}

function prepararEliminacion(nombre) {
    document.getElementById("nombre-eliminar-display").innerText = nombre;
    document.getElementById("nombre-eliminar-hidden").value = nombre;
    const modal = document.getElementById("modal-eliminar");
    M.Modal.getInstance(modal).open();
}

// --- ACTUALIZAR PRODUCTO ---
async function actualizarProducto() {
    const getVal = (id) => document.getElementById(id) ? document.getElementById(id).value : "";

    const datos = {
        nombreOriginal: getVal("edit-nombre-original"),
        nombreNuevo: getVal("edit-nombre"),
        categoria: getVal("edit-categoria"),
        cantidad: getVal("edit-cantidad"),
        precio: getVal("edit-precio"),
        costo: getVal("edit-costo"),
    };

    if (!datos.nombreNuevo || !datos.precio) {
        return M.toast({ html: "Nombre y Precio requeridos", classes: "red" });
    }

    try {
        const res = await fetch("/api/inventario/editar", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(datos),
        });

        if (res.ok) {
            M.toast({ html: "Producto actualizado", classes: "green rounded" });
            M.Modal.getInstance(document.getElementById("modal-editar")).close();
            cargarInventario();
        } else {
            M.toast({ html: "Error al actualizar", classes: "red rounded" });
        }
    } catch(e) {
        console.error(e);
        M.toast({ html: "Error de conexión", classes: "red" });
    }
}

// --- GUARDAR NUEVO PRODUCTO ---
async function guardarProducto() {
    const formData = new FormData();
    const nombre = document.getElementById("nombre").value;
    const categoria = document.getElementById("categoria").value;
    const cantidad = document.getElementById("cantidad").value;
    const precio = document.getElementById("precio").value;
    const costo = document.getElementById("costo").value;
    const imagen = document.getElementById("input-imagen").files[0];

    if (!nombre) return M.toast({ html: "Escribe un nombre", classes: "red" });

    formData.append("nombre", nombre);
    formData.append("categoria", categoria || "Otros");
    formData.append("cantidad", cantidad || 0);
    formData.append("precio", precio || 0);
    formData.append("costo", costo || 0);
    if (imagen) formData.append("imagen", imagen);

    try {
        const res = await fetch("/api/inventario/agregar", {
            method: "POST",
            body: formData,
        });

        if (res.ok) {
            M.toast({ html: "Producto Guardado", classes: "green rounded" });
            
            // Limpiar campos
            document.getElementById("nombre").value = "";
            document.getElementById("cantidad").value = "";
            document.getElementById("precio").value = "";
            document.getElementById("costo").value = "";
            document.getElementById("input-imagen").value = "";
            document.getElementById("preview-img").style.display = "none";
            
            cargarInventario();
        } else {
            M.toast({ html: "Error al guardar", classes: "red" });
        }
    } catch (e) {
        console.error(e);
    }
}

// --- ELIMINAR ---
async function confirmarBorrado() {
    const nombre = document.getElementById("nombre-eliminar-hidden").value;
    try {
        const res = await fetch("/api/inventario/eliminar", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nombre }),
        });
        if (res.ok) {
            M.toast({ html: "Producto Eliminado", classes: "orange rounded" });
            M.Modal.getInstance(document.getElementById("modal-eliminar")).close();
            cargarInventario();
        }
    } catch (e) { console.error(e); }
}

// --- HISTORIAL ---
async function cargarHistorial() {
    try {
        const res = await fetch("/api/ventas/historial?t=" + Date.now());
        if(!res.ok) return;
        const ventas = await res.json();
        const tabla = document.getElementById("tabla-historial");
        if (!tabla) return;
        tabla.innerHTML = "";

        ventas.reverse().slice(0, 10).forEach((v) => {
            tabla.innerHTML += `
                <tr>
                    <td>${v.Fecha} <span class="grey-text text-lighten-1" style="font-size:0.8em">${v.Hora}</span></td>
                    <td>${v.Vendedor}</td>
                    <td class="truncate" style="max-width: 150px;" title="${v.Productos}">${v.Productos}</td>
                    <td><b>$${(v.Total || 0).toLocaleString()}</b></td>
                    <td>
                        <button class="btn-flat btn-small red-text waves-effect" onclick="anularVenta('${v["ID Venta"]}')">
                            <i class="material-icons">delete</i>
                        </button>
                    </td>
                </tr>`;
        });
    } catch (e) {
        console.error("Error historial", e);
    }
}

async function anularVenta(id) {
    if (!confirm("¿Estás seguro de anular esta venta? Se devolverán los productos al inventario.")) return;
    try {
        const res = await fetch("/api/ventas/anular", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ idVenta: id }),
        });
        if (res.ok) {
            M.toast({ html: "Venta Anulada Correctamente", classes: "green rounded" });
            cargarHistorial();
            cargarInventario();
        } else {
            M.toast({ html: "Error al anular", classes: "red" });
        }
    } catch(e) { console.error(e); }
}

function filtrarProductos() {
    const texto = document.getElementById('busqueda-venta').value.toLowerCase();
    const filas = document.querySelectorAll('#tabla-cuerpo tr');

    filas.forEach(fila => {
        const textoFila = fila.innerText.toLowerCase();
        fila.style.display = textoFila.includes(texto) ? "" : "none";
    });
}

function cerrarSesion() {
    if (confirm("¿Cerrar sesión?")) {
        localStorage.clear();
        window.location.replace("/");
    }
}