// login.js - Proyecto Las Trompetas

document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("login-form");

    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            // Capturamos los valores de los inputs
            const usuarioVal = document.getElementById("usuario").value;
            const claveVal = document.getElementById("clave").value;

            try {
                const response = await fetch("/api/login", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    // ENVIAMOS LAS LLAVES EXACTAS: usuario y clave
                    body: JSON.stringify({ 
                        usuario: usuarioVal, 
                        clave: claveVal 
                    }),
                });

                const data = await response.json();

                if (response.ok && data.exito) {
                    // GUARDADO DE SESIÓN
                    // Es vital guardar el rol para que inventory.js y ventas.js den acceso
                    localStorage.setItem("usuarioRol", data.rol);
                    localStorage.setItem("usuarioNombre", data.user);

                    M.toast({ html: "✅ Bienvenido, " + data.user, classes: "green" });

                    // Redirección según el rol
                    setTimeout(() => {
                        if (data.rol === "ADMIN") {
                            window.location.href = "index.html"; // Panel de Inventario
                        } else {
                            window.location.href = "ventas.html"; // Panel de POS
                        }
                    }, 1000);
                } else {
                    M.toast({ html: "❌ Usuario o clave incorrectos", classes: "red" });
                }
            } catch (error) {
                console.error("Error en login:", error);
                M.toast({ html: "Error de conexión con el servidor", classes: "red" });
            }
        });
    }
});