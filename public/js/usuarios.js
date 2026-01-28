document.addEventListener("DOMContentLoaded", function() {
    M.AutoInit();
    cargarUsuarios();
});

async function cargarUsuarios() {
    const res = await fetch("/api/usuarios/ver");
    const usuarios = await res.json();
    const tabla = document.getElementById("tabla-usuarios");
    tabla.innerHTML = "";

    usuarios.forEach(u => {
        tabla.innerHTML += `
            <tr>
                <td>${u.usuario}</td>
                <td><span class="chip ${u.rol === 'ADMIN' ? 'orange white-text' : 'blue white-text'}">${u.rol}</span></td>
                <td>
                    <button class="btn-flat" onclick="prepararEdicion('${u.usuario}', '${u.clave}', '${u.rol}')">
                        <i class="material-icons blue-text">edit</i>
                    </button>
                </tr>`;
    });
}

async function guardarUsuario() {
    const usuario = document.getElementById("user-nombre").value;
    const clave = document.getElementById("user-clave").value;
    const rol = document.getElementById("user-rol").value;

    if(!usuario || !clave) return M.toast({html: "Completa todos los campos"});

    const res = await fetch("/api/usuarios/guardar", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ usuario, clave, rol })
    });

    if(res.ok) {
        M.toast({html: "Usuario guardado"});
        document.getElementById("user-nombre").value = "";
        document.getElementById("user-clave").value = "";
        cargarUsuarios();
    }
}

function prepararEdicion(u, c, r) {
    document.getElementById("user-nombre").value = u;
    document.getElementById("user-clave").value = c;
    document.getElementById("user-rol").value = r;
    M.updateTextFields();
    M.FormSelect.init(document.getElementById("user-rol"));
}