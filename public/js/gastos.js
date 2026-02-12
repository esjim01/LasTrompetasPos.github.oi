// public/js/gastos.js

document.addEventListener('DOMContentLoaded', function() {
    // 1. Inicializar componentes de Materialize (Selects, Modals, etc.)
    M.AutoInit();
    
    // 2. Poner la fecha de hoy por defecto en el formulario
    document.getElementById('fecha-gasto').valueAsDate = new Date();

    // 3. Cargar los datos
    cargarGastos();
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
    if (usuario.rol !== 'ADMIN' && usuario.rol !== 'administrador'&& usuario.rol !== 'admin') {
        alert("⛔ Acceso Restringido: Solo personal autorizado.");
        
        // Lo redirigimos a donde SÍ puede estar (Ventas)
        window.location.href = '/public/ventas.html'; 
    }
})();
// --- FIN SEGURIDAD ---

// --- FUNCIÓN PRINCIPAL: CARGAR Y MOSTRAR ---
async function cargarGastos() {
    try {
        const res = await fetch('/api/gastos');
        const gastos = await res.json();

        // Ordenar: El más reciente primero
        gastos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

        renderizarTabla(gastos);
        calcularResumen(gastos);

    } catch (error) {
        console.error(error);
        M.toast({html: 'Error al cargar gastos', classes: 'red'});
    }
}

// --- RENDERIZAR TABLA ---
function renderizarTabla(lista) {
    const tbody = document.getElementById('tabla-gastos');
    tbody.innerHTML = '';

    lista.forEach(g => {
        // Formato de moneda
        const montoFormato = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(g.monto);
        
        // Icono según categoría
        let icono = 'attach_money';
        if (g.categoria === 'Insumos') icono = 'shopping_cart';
        if (g.categoria === 'Servicios') icono = 'lightbulb';
        if (g.categoria === 'Nomina') icono = 'groups';

        tbody.innerHTML += `
            <tr>
                <td>${g.fecha}</td>
                <td>
                    <span style="font-weight:500">${g.descripcion}</span>
                </td>
                <td>
                    <span class="chip text-darken-2">${g.categoria}</span>
                </td>
                <td class="red-text" style="font-weight:bold">${montoFormato}</td>
                <td>
                    <button class="btn-flat btn-small red-text" onclick="eliminarGasto(${g.id})">
                        <i class="material-icons">delete</i>
                    </button>
                </td>
            </tr>
        `;
    });
}

// --- GUARDAR NUEVO GASTO ---
async function guardarGasto() {
    const fecha = document.getElementById('fecha-gasto').value;
    const categoria = document.getElementById('categoria-gasto').value;
    const descripcion = document.getElementById('desc-gasto').value;
    const monto = document.getElementById('monto-gasto').value;

    // Validaciones
    if (!fecha || !categoria || !descripcion || !monto) {
        return M.toast({html: 'Completa todos los campos', classes: 'orange'});
    }

    const nuevoGasto = {
        fecha,
        categoria,
        descripcion,
        monto,
        responsable: localStorage.getItem('usuarioNombre') || 'Admin'
    };

    try {
        const res = await fetch('/api/gastos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(nuevoGasto)
        });

        if (res.ok) {
            M.toast({html: 'Gasto registrado', classes: 'green'});
            // Limpiar formulario
            document.getElementById('desc-gasto').value = '';
            document.getElementById('monto-gasto').value = '';
            // Recargar tabla
            cargarGastos();
        } else {
            M.toast({html: 'Error al guardar', classes: 'red'});
        }
    } catch (error) {
        console.error(error);
        M.toast({html: 'Error de conexión', classes: 'red'});
    }
}

// --- ELIMINAR GASTO ---
async function eliminarGasto(id) {
    if(!confirm('¿Seguro que quieres borrar este registro?')) return;

    try {
        const res = await fetch(`/api/gastos/${id}`, { method: 'DELETE' });
        if (res.ok) {
            M.toast({html: 'Eliminado', classes: 'grey darken-3'});
            cargarGastos();
        }
    } catch (error) {
        console.error(error);
    }
}

// --- CÁLCULOS PARA LAS TARJETAS ---
function calcularResumen(gastos) {
    // 1. Filtrar solo gastos de ESTE MES
    const hoy = new Date();
    const mesActual = hoy.getMonth(); 
    const anioActual = hoy.getFullYear();

    const gastosMes = gastos.filter(g => {
        const fechaGasto = new Date(g.fecha);
        // Ojo: en JS los meses van de 0 a 11, pero al venir de input date (YYYY-MM-DD) funciona bien con new Date()
        // Sin embargo, new Date('2024-02-01') en UTC puede dar problemas de zona horaria.
        // Truco rápido: comparamos strings 'YYYY-MM'
        return g.fecha.startsWith(`${anioActual}-${String(mesActual + 1).padStart(2, '0')}`);
    });

    // 2. Sumar Total
    const total = gastosMes.reduce((sum, g) => sum + Number(g.monto), 0);
    document.getElementById('total-mes').innerText = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(total);

    // 3. Encontrar Categoría Mayor
    if (gastosMes.length === 0) {
        document.getElementById('cat-mayor').innerText = "N/A";
        return;
    }

    const conteo = {};
    gastosMes.forEach(g => {
        conteo[g.categoria] = (conteo[g.categoria] || 0) + Number(g.monto);
    });

    // Ordenar y sacar la mayor
    const categoriaGanadora = Object.keys(conteo).reduce((a, b) => conteo[a] > conteo[b] ? a : b);
    document.getElementById('cat-mayor').innerText = `${categoriaGanadora}`;
}