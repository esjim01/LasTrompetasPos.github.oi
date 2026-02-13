// login.js - CORREGIDO Y DEFINITIVO

document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("login-form");

    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            // 1. Capturamos lo que escribió el usuario
            const usuarioVal = document.getElementById("usuario").value;
            const claveVal = document.getElementById("clave").value;

            try {
                // 2. Preguntamos al servidor (que lee el Excel)
                const response = await fetch("/api/index", { 
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ usuario: usuarioVal, clave: claveVal }),
                });

                const data = await response.json();

                if (response.ok && data.exito) {
                    
                    // --- AQUÍ ESTÁ LA MAGIA ---
                    // Creamos el "Carnet" digital completo
                    const objetoSesion = {
                        nombre: data.user,  // Nombre que vino del Excel
                        rol: data.rol       // Rol que vino del Excel (ej: 'ADMIN')
                    };

                    // Lo guardamos correctamente como JSON string
                    localStorage.setItem("usuarioNombre", JSON.stringify(objetoSesion));
                    
                    // (Opcional) Guardamos el rol suelto por seguridad extra
                    localStorage.setItem("usuarioRol", data.rol);

                    M.toast({ html: "✅ Bienvenido, " + data.user, classes: "green rounded" });

                    // 3. Redirección inteligente
                    setTimeout(() => {
                        // Verificamos si es ADMIN (asegurándonos de las mayúsculas)
                        if (data.rol === "ADMIN" || data.rol === "ADMINISTRADOR") {
                            window.location.href = "inventario.html"; 
                        } else {
                            window.location.href = "ventas.html";
                        }
                    }, 1000);

                } else {
                    M.toast({ html: "❌ Datos incorrectos", classes: "red rounded" });
                }

            } catch (error) {
                console.error("Error:", error);
                M.toast({ html: "Error de conexión", classes: "red rounded" });
            }
        });
    }
});