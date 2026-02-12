document.addEventListener("DOMContentLoaded", function() {
    M.AutoInit();
    cargarUsuarios();
});


// --- SEGURIDAD: VERIFICACIÓN DE ROL ---
(function protegerVista() {
    // 1. Recuperar la sesión guardada
    const sesionGuardada = localStorage.getItem('usuarioNombre'); // Ojo: Revisa si usas 'usuario', 'user' o 'session'

    // 2. Si no hay sesión, mandar al Login
    if (!sesionGuardada) {
        alert("Debes iniciar sesión primero.");
        window.location.href = '/index.html'; // O tu ruta de login
        return;
    }

    const usuario = JSON.parse(sesionGuardada);

    // 3. REGLA DE ORO: Si no es Admin, ¡FUERA!
    // Cambia 'admin' por como tengas escrito el rol en tu base de datos (ej: 'administrador', 'jefe', etc.)
    if (usuario.rol !== 'ADMIN' && usuario.rol !== 'administrador' && usuario.rol !== 'admin') {
        alert("⛔ Acceso Restringido: Solo personal autorizado.");
        
        // Lo redirigimos a donde SÍ puede estar (Ventas)
        window.location.href = '/public/ventas.html'; 
    }
})();
// --- FIN SEGURIDAD ---

// --- CARGAR LISTA ---
async function cargarUsuarios() {
    try {
        const res = await fetch("/api/usuarios/ver");
        const usuarios = await res.json();
        const tabla = document.getElementById("tabla-usuarios");
        tabla.innerHTML = "";

        usuarios.forEach(u => {
            tabla.innerHTML += `
                <tr>
                    <td>${u.usuario}</td>
                    <td><span class="chip ${u.rol === 'ADMIN' ? 'orange white-text' : 'blue white-text'}">${u.rol}</span></td>
                    <td class="center-align">
                        <button class="btn-floating btn-small blue" onclick="prepararEdicion('${u.usuario}', '${u.rol}')">
                            <i class="material-icons">edit</i>
                        </button>
                        <button class="btn-floating btn-small red" onclick="eliminarUsuario('${u.usuario}')">
                            <i class="material-icons">delete</i>
                        </button>
                    </td>
                </tr>`;
        });
    } catch (error) {
        M.toast({html: 'Error cargando usuarios'});
    }
}

// --- GUARDAR O ACTUALIZAR ---
async function guardarUsuario() {
    const usuarioOriginal = document.getElementById("user-id-original").value; // Si tiene valor, es edición
    const usuario = document.getElementById("user-nombre").value;
    const clave = document.getElementById("user-clave").value;
    const rol = document.getElementById("user-rol").value;

    if(!usuario) return M.toast({html: "El nombre es obligatorio"});
    
    // Si es nuevo, la clave es obligatoria. Si es edición, puede ir vacía (para no cambiarla)
    if(!usuarioOriginal && !clave) return M.toast({html: "La contraseña es obligatoria para nuevos usuarios"});

    const url = usuarioOriginal ? "/api/usuarios/editar" : "/api/usuarios/guardar";
    const method = usuarioOriginal ? "PUT" : "POST";

    const res = await fetch(url, {
        method: method,
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ usuarioOriginal, usuario, clave, rol })
    });

    if(res.ok) {
        M.toast({html: usuarioOriginal ? "Usuario actualizado" : "Usuario creado"});
        limpiarFormulario();
        cargarUsuarios();
    } else {
        M.toast({html: "Error al guardar (tal vez el usuario ya existe)"});
    }
}

// --- PREPARAR EL FORMULARIO PARA EDITAR ---
function prepararEdicion(nombre, rol) {
    document.getElementById("form-titulo").innerText = "Editar Usuario";
    document.getElementById("btn-guardar").innerHTML = "Actualizar <i class='material-icons right'>update</i>";
    
    // Llenamos datos
    document.getElementById("user-id-original").value = nombre; // Guardamos el nombre original
    document.getElementById("user-nombre").value = nombre;
    document.getElementById("user-rol").value = rol;
    
    // La clave la dejamos vacía para seguridad
    document.getElementById("user-clave").value = "";
    document.getElementById("helper-clave").innerText = "(Deja vacío para mantener la actual)";

    // Mostrar botón cancelar
    document.getElementById("btn-cancelar").style.display = "block";

    // Actualizar estilos de Materialize
    M.updateTextFields();
    M.FormSelect.init(document.getElementById("user-rol"));
}

// --- LIMPIAR / CANCELAR ---
function limpiarFormulario() {
    document.getElementById("form-titulo").innerText = "Nuevo Usuario";
    document.getElementById("btn-guardar").innerHTML = "Guardar <i class='material-icons right'>save</i>";
    document.getElementById("btn-cancelar").style.display = "none";
    document.getElementById("helper-clave").innerText = "";

    document.getElementById("user-id-original").value = "";
    document.getElementById("user-nombre").value = "";
    document.getElementById("user-clave").value = "";
    document.getElementById("user-rol").value = "VENDEDOR";

    M.updateTextFields();
    M.FormSelect.init(document.getElementById("user-rol"));
}

// --- ELIMINAR ---
async function eliminarUsuario(nombre) {
    if(!confirm(`¿Seguro que deseas eliminar a ${nombre}?`)) return;

    const res = await fetch("/api/usuarios/eliminar", {
        method: "DELETE",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ nombre })
    });

    if(res.ok) {
        M.toast({html: "Usuario eliminado"});
        cargarUsuarios();
    } else {
        M.toast({html: "Error al eliminar"});
    }
}