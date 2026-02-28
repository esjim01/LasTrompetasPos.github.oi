// public/js/gastos.js

// Variable global para guardar todos los gastos
let gastosGlobal = [];
let categoriaActiva = "Todas";

document.addEventListener('DOMContentLoaded', function() {
    M.AutoInit();
    document.getElementById('fecha-gasto').valueAsDate = new Date();
    cargarGastos();
});

// --- SEGURIDAD ---
(function protegerVista() {
    const sesionGuardada = localStorage.getItem('usuarioNombre');
    if (!sesionGuardada) {
        alert("Debes iniciar sesión primero.");
        window.location.href = '/index.html';
        return;
    }
    const usuario = JSON.parse(sesionGuardada);
    if (usuario.rol !== 'ADMIN' && usuario.rol !== 'administrador' && usuario.rol !== 'admin') {
        alert("⛔ Acceso Restringido.");
        window.location.href = '/public/ventas.html';
    }
})();

// --- CARGAR GASTOS ---
async function cargarGastos() {
    try {
        const res = await fetch('/api/gastos');
        const gastos = await res.json();
        gastos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        gastosGlobal = gastos;

        renderizarTabla(gastos);
        calcularResumen(gastos);
    } catch (error) {
        console.error(error);
        M.toast({html: 'Error al cargar gastos', classes: 'red'});
    }
}

// --- FILTRO POR CATEGORÍA ---
function filtrarCategoria(categoria) {
    categoriaActiva = categoria;

    // Actualizar chips visualmente
    document.querySelectorAll('.chip').forEach(chip => {
        chip.classList.remove('indigo', 'white-text');
    });
    event.target.classList.add('indigo', 'white-text');

    const filtrados = categoria === "Todas"
        ? gastosGlobal
        : gastosGlobal.filter(g => g.categoria === categoria);

    renderizarTabla(filtrados);
}

// --- RENDERIZAR TABLA ---
function renderizarTabla(lista) {
    const tbody = document.getElementById('tabla-gastos');
    tbody.innerHTML = '';

    if (lista.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="center-align grey-text" style="padding:30px;">
            No hay gastos en esta categoría.
        </td></tr>`;
        return;
    }

    lista.forEach(g => {
        const montoFormato = new Intl.NumberFormat('es-CO', {
            style: 'currency', currency: 'COP', maximumFractionDigits: 0
        }).format(g.monto);

        const iconos = {
            Insumos: '🛒', Servicios: '💡', Nomina: '👷',
            Mantenimiento: '🔧', Arriendo: '🏠', Cafeteria: '☕', Otros: '📦'
        };
        const icono = iconos[g.categoria] || '📦';

        tbody.innerHTML += `
            <tr>
                <td style="font-size:0.9rem;">${g.fecha}</td>
                <td style="font-weight:500; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" 
                    title="${g.descripcion}">${g.descripcion}</td>
                <td>
                    <span class="chip" style="font-size:0.8rem; margin:0;">
                        ${icono} ${g.categoria}
                    </span>
                </td>
                <td class="red-text" style="font-weight:bold; text-align:right;">${montoFormato}</td>
                <td class="center">
                    <button class="btn-flat btn-small red-text" onclick="eliminarGasto(${g.id})">
                        <i class="material-icons">delete</i>
                    </button>
                </td>
            </tr>
        `;
    });
}

// --- GUARDAR GASTO ---
async function guardarGasto() {
    const fecha       = document.getElementById('fecha-gasto').value;
    const categoria   = document.getElementById('categoria-gasto').value;
    const descripcion = document.getElementById('desc-gasto').value;
    const monto       = document.getElementById('monto-gasto').value;

    if (!fecha || !categoria || !descripcion || !monto) {
        return M.toast({html: 'Completa todos los campos', classes: 'orange'});
    }

    try {
        const res = await fetch('/api/gastos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fecha, categoria, descripcion, monto,
                responsable: localStorage.getItem('usuarioNombre') || 'Admin' })
        });

        if (res.ok) {
            M.toast({html: '✅ Gasto registrado', classes: 'green'});
            document.getElementById('desc-gasto').value = '';
            document.getElementById('monto-gasto').value = '';
            cargarGastos();
        } else {
            M.toast({html: 'Error al guardar', classes: 'red'});
        }
    } catch (error) {
        M.toast({html: 'Error de conexión', classes: 'red'});
    }
}

// --- ELIMINAR GASTO ---
async function eliminarGasto(id) {
    if (!confirm('¿Seguro que quieres borrar este registro?')) return;
    try {
        const res = await fetch(`/api/gastos/${id}`, { method: 'DELETE' });
        if (res.ok) {
            M.toast({html: 'Eliminado', classes: 'grey darken-3'});
            cargarGastos();
        }
    } catch (error) { console.error(error); }
}

// --- RESUMEN Y TOP 3 CATEGORÍAS ---
function calcularResumen(gastos) {
    const hoy = new Date();
    const mesActual = hoy.getMonth();
    const anioActual = hoy.getFullYear();

    const gastosMes = gastos.filter(g =>
        g.fecha.startsWith(`${anioActual}-${String(mesActual + 1).padStart(2, '0')}`)
    );

    // Total del mes
    const total = gastosMes.reduce((sum, g) => sum + Number(g.monto), 0);
    document.getElementById('total-mes').innerText = new Intl.NumberFormat('es-CO', {
        style: 'currency', currency: 'COP', maximumFractionDigits: 0
    }).format(total);

    // Top 3 categorías
    const conteo = {};
    gastosMes.forEach(g => {
        conteo[g.categoria] = (conteo[g.categoria] || 0) + Number(g.monto);
    });

    const top3 = Object.entries(conteo)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);

    const iconos = {
        Insumos: '🛒', Servicios: '💡', Nomina: '👷',
        Mantenimiento: '🔧', Arriendo: '🏠', Cafeteria: '☕', Otros: '📦'
    };

    const colores = ['red-text', 'orange-text', 'amber-text text-darken-2'];
    const medallas = ['🥇', '🥈', '🥉'];

    const tbodyTop = document.getElementById('tabla-top-categorias');

    if (top3.length === 0) {
        tbodyTop.innerHTML = `<tr><td colspan="3" class="grey-text">Sin gastos este mes</td></tr>`;
        return;
    }

    tbodyTop.innerHTML = top3.map(([cat, monto], i) => `
        <tr>
            <td style="padding: 4px 0; width:10%;">${medallas[i]}</td>
            <td style="padding: 4px 0; font-weight:600;">
                ${iconos[cat] || '📦'} ${cat}
            </td>
            <td style="padding: 4px 0; text-align:right;" class="${colores[i]}">
                <b>${new Intl.NumberFormat('es-CO', {
                    style: 'currency', currency: 'COP', maximumFractionDigits: 0
                }).format(monto)}</b>
            </td>
        </tr>
    `).join('');
}