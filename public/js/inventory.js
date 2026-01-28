// inventory.js - Proyecto Las Trompetas (REPARADO)


(function () {
  function verificarSesion() {
    const rol = localStorage.getItem("usuarioRol");
    if (!rol) window.location.replace("login.html");
  }
  verificarSesion();
})();

document.addEventListener("DOMContentLoaded", function () {
  M.AutoInit();
  const rol = localStorage.getItem("usuarioRol");
  if (rol === "VENDEDOR") {
    const form = document.querySelector(".col.m4");
    if (form) form.style.display = "none";
    const tablaCol = document.querySelector(".col.m8");
    if (tablaCol) tablaCol.classList.replace("m8", "m12");
  }
  cargarInventario();
  cargarHistorial(); // También cargamos historial aquí si existe la tabla
});

// --- VISTA PREVIA DE IMAGEN ---
const inputImg = document.getElementById("input-imagen");
if (inputImg) {
  inputImg.addEventListener("change", function () {
    const reader = new FileReader();
    reader.onload = (e) => {
      const preview = document.getElementById("preview-img");
      if (preview) {
        preview.src = e.target.result;
        preview.style.display = "block";
      }
    };
    if (this.files[0]) reader.readAsDataURL(this.files[0]);
  });
}

document.getElementById('input-imagen').addEventListener('change', function(e) {
    const reader = new FileReader();
    const preview = document.getElementById('preview-img');
    
    reader.onload = function() {
        preview.src = reader.result;
        preview.style.display = 'block';
    }
    
    if (e.target.files[0]) {
        reader.readAsDataURL(e.target.files[0]);
    }
});

// --- CRUD INVENTARIO ---
async function cargarInventario() {
  try {
    const res = await fetch("/api/inventario/ver");
    const productos = await res.json();
    
    // Usamos tu ID real: tabla-cuerpo
    const tabla = document.getElementById("tabla-cuerpo");
    if (!tabla) return;
    
    tabla.innerHTML = "";

    productos.forEach((p) => {
      // Definimos valores seguros para evitar errores en el modal
      const nombre = p.nombre || '';
      const cantidad = Number(p.cantidad) || 0;
      const precio = Number(p.precio) || 0;
      const costo = Number(p.costo) || 0;
      
      const colorBadge = cantidad < 5 ? "red" : "indigo";

      // Insertamos la fila directamente
      tabla.innerHTML += `
                <tr>
                    <td>${nombre}</td>
                    <td class="indigo-text"><b>${p.categoria || 'Sin categoría'}</b></td>
                    <td><span class="new badge ${colorBadge}" data-badge-caption="und">${cantidad}</span></td>
                    <td>$${precio.toLocaleString()}</td>
                    <td>$${costo.toLocaleString()}</td>
                    <td>${p.fecha_registro || '-'}</td>
                    <td>
                        <button class="btn-floating btn-small blue" onclick="abrirModalEditar('${nombre}', ${cantidad}, ${precio}, ${costo})">
                            <i class="material-icons">edit</i>
                        </button>
                        <button class="btn-floating btn-small red" onclick="prepararEliminacion('${nombre}')">
                            <i class="material-icons">delete</i>
                        </button>
                    </td>
                </tr>`;
      
      // LA LÍNEA "tabla.innerHTML += fila;" FUE ELIMINADA PORQUE CAUSABA EL ERROR
    });
  } catch (e) {
    console.error("Error cargando inventario", e);
    M.toast({ html: "Error al conectar con el servidor", classes: "red" });
  }
}

// --- GUARDAR PRODUCTO CON REFRESCO AUTOMÁTICO ---
async function guardarProducto() {
  const formData = new FormData();
  const nombreInput = document.getElementById("nombre");
  const categoriaInput = document.getElementById("categoria");
  const cantidadInput = document.getElementById("cantidad");
  const precioInput = document.getElementById("precio");
  const inputImagen = document.getElementById("input-imagen");
  const costoInput = document.getElementById("costo");

  if (!nombreInput.value)
    return M.toast({ html: "El nombre es obligatorio", classes: "red" });

  formData.append("nombre", nombreInput.value);
  formData.append("categoria", categoriaInput.value);
  formData.append("cantidad", cantidadInput.value);
  formData.append("precio", precioInput.value);
  formData.append("costo", costoInput.value);

  if (inputImagen.files[0]) {
    formData.append("imagen", inputImagen.files[0]);
  }

  try {
    const res = await fetch("/api/inventario/agregar", {
      method: "POST",
      body: formData,
    });

    if (res.ok) {
      M.toast({ html: "✅ Producto guardado con éxito", classes: "green" });

      // 1. Limpiar el formulario
      nombreInput.value = "";
      cantidadInput.value = "";
      precioInput.value = "";
      if (inputImagen) inputImagen.value = "";
      const preview = document.getElementById("preview-img");
      if (preview) preview.style.display = "none";

      // 2. REFRESCAR LA TABLA SIN RECARGAR PÁGINA
      await cargarInventario();

      // 3. Re-inicializar etiquetas de Materialize (para que no se amontonen)
      M.updateTextFields();
    } else {
      M.toast({ html: "❌ Error al guardar", classes: "red" });
    }
  } catch (error) {
    console.error("Error:", error);
    M.toast({ html: "Error de conexión", classes: "red" });
  }
}
/* FILTRAR PRODUCTOS EN TIEMPO REAL */
function filtrarProductos() {
    const texto = document.getElementById('busqueda-venta').value.toLowerCase();
    const filas = document.querySelectorAll('#tabla-cuerpo tr');

    filas.forEach(fila => {
        // Obtenemos el texto de la columna Producto (index 0) y Categoría (index 1)
        const nombre = fila.cells[0].innerText.toLowerCase();
        const categoria = fila.cells[1].innerText.toLowerCase();

        if (nombre.includes(texto) || categoria.includes(texto)) {
            fila.style.display = ""; // Muestra la fila
        } else {
            fila.style.display = "none"; // Oculta la fila
        }
    });
}

async function actualizarProducto() {
  // Usamos una función auxiliar para capturar el valor o devolver vacío si no existe
  const getVal = (id) =>
    document.getElementById(id) ? document.getElementById(id).value : "";

  const datos = {
    nombreOriginal: getVal("edit-nombre-original"),
    nombreNuevo: getVal("edit-nombre"),
    cantidad: getVal("edit-cantidad"),
    precio: getVal("edit-precio"),
    costo: getVal("edit-costo"), // Ahora sí funcionará porque agregamos el HTML
  };

  // Validación simple antes de enviar
  if (!datos.nombreNuevo || !datos.precio) {
    return M.toast({
      html: "Nombre y Precio son obligatorios",
      classes: "red",
    });
  }

  const res = await fetch("/api/inventario/editar", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });

  if (res.ok) {
    M.toast({ html: "Actualizado correctamente", classes: "green" });
    M.Modal.getInstance(document.getElementById("modal-editar")).close();
    cargarInventario();
  } else {
    M.toast({ html: "Error al actualizar", classes: "red" });
  }
}

async function confirmarBorrado() {
  const nombre = document.getElementById("nombre-eliminar-hidden").value;
  const res = await fetch("/api/inventario/eliminar", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nombre }),
  });
  if (res.ok) {
    M.toast({ html: "Eliminado", classes: "green" });
    M.Modal.getInstance(document.getElementById("modal-eliminar")).close();
    cargarInventario();
  }
}

// --- HISTORIAL (SINCRONIZADO CON INDEX.JS) ---
async function cargarHistorial() {
  try {
    const res = await fetch("/api/ventas/historial?t=" + Date.now());
    const ventas = await res.json();
    const tabla = document.getElementById("tabla-historial");
    if (!tabla) return;
    tabla.innerHTML = "";

    ventas.reverse().forEach((v) => {
      tabla.innerHTML += `
                <tr>
                    <td><b>${v.Fecha}</b><br><small>${v.Hora}</small></td>
                    <td><span class="chip">${v.Vendedor}</span></td>
                    <td style="font-size:0.8rem">${v.Productos}</td>
                    <td><b>$${(v.Total || 0).toLocaleString()}</b></td>
                    <td>
                        <button class="btn-small red" onclick="anularVenta('${v["ID Venta"]}')">
                            <i class="material-icons">delete_sweep</i>
                        </button>
                    </td>
                </tr>`;
    });
  } catch (e) {
    console.error(e);
  }
}

async function anularVenta(id) {
  if (!confirm("¿Anular venta?")) return;
  const res = await fetch("/api/ventas/anular", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idVenta: id }),
  });
  if (res.ok) {
    M.toast({ html: "Venta anulada" });
    cargarHistorial();
    cargarInventario();
  }
}

function abrirModalEditar(nombre, cantidad, precio, costo) {
  document.getElementById("edit-nombre-original").value = nombre;
  document.getElementById("edit-nombre").value = nombre;
  document.getElementById("edit-cantidad").value = cantidad;
  document.getElementById("edit-precio").value = precio;
  if (document.getElementById("edit-costo")) {
    document.getElementById("edit-costo").value = costo || 0;
  }
  M.updateTextFields();
  M.Modal.getInstance(document.getElementById("modal-editar")).open();
}

function prepararEliminacion(nombre) {
  document.getElementById("nombre-eliminar-display").innerText = nombre;
  document.getElementById("nombre-eliminar-hidden").value = nombre;
  M.Modal.getInstance(document.getElementById("modal-eliminar")).open();
}

// --- FUNCIÓN SALIR CORREGIDA ---
function cerrarSesion() {
  console.log("Cerrando sesión...");
  localStorage.clear(); // Borra rol, nombre, etc.
  window.location.replace("login.html"); // Redirección forzada
}
