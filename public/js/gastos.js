// public/js/gastos.js

let gastosGlobal = [];
let categoriaActiva = "Todas";
let fechaDesde = null;
let fechaHasta = null;

// --- SEGURIDAD ---
(function protegerVista() {
    const sesionGuardada = localStorage.getItem('usuarioNombre');
    if (!sesionGuardada) {
        alert("Debes iniciar sesión primero.");
        window.location.href = '/index.html';
        return;
    }
    try {
        const usuario = JSON.parse(sesionGuardada);
        const rolNorm = (usuario.rol || '').toUpperCase();
        const rolesPermitidos = ['ADMIN', 'ADMINISTRADOR', 'ADMINISTRADOR', 'JEFE', 'ENCARGADO'];
        if (!rolesPermitidos.includes(rolNorm)) {
            alert('⛔ Acceso Restringido.');
            window.location.href = '/public/ventas.html';
        }
    } catch (e) {
        alert("Sesión inválida. Inicia sesión nuevamente.");
        window.location.href = '/index.html';
    }
})();

document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('fecha-gasto').valueAsDate = new Date();
    cargarGastos();
});

// --- CARGAR GASTOS ---
async function cargarGastos() {
    const tbody = document.getElementById('tabla-gastos');
    tbody.innerHTML = `<tr><td colspan="5" class="center-align grey-text" style="padding:30px;">
        <i class="material-icons" style="font-size:2rem; display:block;">hourglass_empty</i>Cargando gastos...
    </td></tr>`;

    try {
        const res = await fetch('/api/gastos');
        const gastos = await res.json();
        gastos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        gastosGlobal = gastos;
        aplicarFiltros();    // → renderiza tabla + actualiza KPI total
        calcularResumen(gastos); // → solo Top 3 categorías del mes
    } catch (error) {
        console.error(error);
        M.toast({ html: 'Error al cargar gastos', classes: 'red' });
        tbody.innerHTML = `<tr><td colspan="5" class="center-align red-text" style="padding:30px;">
            Error de conexión al cargar gastos.
        </td></tr>`;
    }
}

// --- FILTRO POR CATEGORÍA ---
const CHIP_ACTIVE   = ['bg-slate-800', 'text-white', 'border-slate-800'];
const CHIP_INACTIVE = ['bg-white', 'text-slate-600', 'border-slate-200'];

function filtrarCategoria(categoria, chipEl) {
    categoriaActiva = categoria;

    // Restablecer todos los chips al estado inactivo
    document.querySelectorAll('.chip').forEach(chip => {
        chip.classList.remove(...CHIP_ACTIVE);
        chip.classList.add(...CHIP_INACTIVE);
    });

    // Marcar el chip seleccionado como activo
    if (chipEl) {
        chipEl.classList.remove(...CHIP_INACTIVE);
        chipEl.classList.add(...CHIP_ACTIVE);
    }

    aplicarFiltros();
}

// --- APLICAR TODOS LOS FILTROS (fecha + categoría) ---
function aplicarFiltros() {
    const desde = document.getElementById('fecha-desde').value;
    const hasta = document.getElementById('fecha-hasta').value;
    fechaDesde = desde || null;
    fechaHasta = hasta || null;

    // Mostrar/ocultar badge de rango activo
    const badge = document.getElementById('rango-badge');
    const badgeTexto = document.getElementById('rango-badge-texto');
    if (fechaDesde || fechaHasta) {
        badge.style.display = 'inline-flex';
        const d = fechaDesde ? formatearFecha(fechaDesde) : '...';
        const h = fechaHasta ? formatearFecha(fechaHasta) : '...';
        badgeTexto.textContent = `${d} → ${h}`;
    } else {
        badge.style.display = 'none';
    }

    let filtrados = gastosGlobal;

    // Filtro categoría
    if (categoriaActiva !== "Todas") {
        filtrados = filtrados.filter(g => g.categoria === categoriaActiva);
    }

    // Filtro por fecha
    if (fechaDesde) {
        filtrados = filtrados.filter(g => g.fecha >= fechaDesde);
    }
    if (fechaHasta) {
        filtrados = filtrados.filter(g => g.fecha <= fechaHasta);
    }

    renderizarTabla(filtrados);
    actualizarKpiTotal(filtrados);
}

// --- ACTUALIZAR KPI TOTAL según filtro activo ---
function actualizarKpiTotal(gastos) {
    const hayFiltroFecha = fechaDesde || fechaHasta;

    // Cambia el título del KPI según si hay rango activo o no
    const kpiTitulo = document.getElementById('total-mes-titulo');
    if (kpiTitulo) {
        kpiTitulo.textContent = hayFiltroFecha ? 'Total Gastos (Rango)' : 'Total Gastos (Mes)';
    }

    // Si no hay filtro de fecha, mostrar solo el mes actual (inicio -> fin del mes)
    let gastosParaSumar = gastos;
    if (!hayFiltroFecha) {
        const now = new Date();
        const y = now.getFullYear();
        const m = now.getMonth(); // 0-based
        const inicio = new Date(y, m, 1).toISOString().slice(0, 10);
        const fin = new Date(y, m + 1, 0).toISOString().slice(0, 10);
        gastosParaSumar = gastos.filter(g => g.fecha >= inicio && g.fecha <= fin);
    }

    const total = gastosParaSumar.reduce((sum, g) => sum + Number(g.monto), 0);
    document.getElementById('total-mes').innerText = new Intl.NumberFormat('es-CO', {
        style: 'currency', currency: 'COP', maximumFractionDigits: 0
    }).format(total);
}

// --- LIMPIAR FECHAS ---
function limpiarFechas() {
    document.getElementById('fecha-desde').value = '';
    document.getElementById('fecha-hasta').value = '';
    fechaDesde = null;
    fechaHasta = null;
    aplicarFiltros();
}

// --- FORMATEAR FECHA legible ---
function formatearFecha(fechaStr) {
    if (!fechaStr) return '';
    const [anio, mes, dia] = fechaStr.split('-');
    const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun',
                   'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    return `${parseInt(dia)} ${meses[parseInt(mes) - 1]} ${anio}`;
}

// --- RENDERIZAR TABLA (eficiente: una sola asignación de innerHTML) ---
function renderizarTabla(lista) {
    const tbody = document.getElementById('tabla-gastos');

    if (lista.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="center-align grey-text" style="padding:30px;">
            No hay gastos para los filtros seleccionados.
        </td></tr>`;
        return;
    }

    const iconos = {
        Insumos: '🛒', Servicios: '💡', Nomina: '👷',
        Mantenimiento: '🔧', Arriendo: '🏠', Cafeteria: '☕', Otros: '📦'
    };

    const filas = lista.map(g => {
        const montoFormato = new Intl.NumberFormat('es-CO', {
            style: 'currency', currency: 'COP', maximumFractionDigits: 0
        }).format(g.monto);
        const icono = iconos[g.categoria] || '📦';
        const fechaLegible = formatearFecha(g.fecha);

        return `<tr>
            <td style="font-size:0.9rem;">${fechaLegible}</td>
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
        </tr>`;
    }).join('');

    tbody.innerHTML = filas;
}

// --- GUARDAR GASTO ---
async function guardarGasto() {
    const fecha       = document.getElementById('fecha-gasto').value;
    const categoria   = document.getElementById('categoria-gasto').value;
    const descripcion = document.getElementById('desc-gasto').value.trim();
    const monto       = document.getElementById('monto-gasto').value;

    if (!fecha || !categoria || !descripcion || !monto) {
        return M.toast({ html: 'Completa todos los campos', classes: 'orange' });
    }

    // Obtener nombre del responsable correctamente
    let responsable = 'Admin';
    try {
        const sesion = localStorage.getItem('usuarioNombre');
        if (sesion) {
            const usuario = JSON.parse(sesion);
            responsable = usuario.nombre || usuario.email || 'Admin';
        }
    } catch (e) { /* usa default */ }

    try {
        const res = await fetch('/api/gastos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fecha, categoria, descripcion, monto, responsable })
        });

        if (res.ok) {
            M.toast({ html: '✅ Gasto registrado', classes: 'green' });
            // Reset del formulario: descripción, monto Y categoría
            document.getElementById('desc-gasto').value = '';
            document.getElementById('monto-gasto').value = '';
            document.getElementById('categoria-gasto').value = '';

            // Reset del label de Materialize si aplica
            const labelDesc = document.querySelector('label[for="desc-gasto"]');
            if (labelDesc) labelDesc.classList.remove('active');
            const labelMonto = document.querySelector('label[for="monto-gasto"]');
            if (labelMonto) labelMonto.classList.remove('active');

            cargarGastos();
        } else {
            M.toast({ html: 'Error al guardar', classes: 'red' });
        }
    } catch (error) {
        console.error(error);
        M.toast({ html: 'Error de conexión', classes: 'red' });
    }
}

// --- ELIMINAR GASTO (modal Materialize en lugar de confirm nativo) ---
async function eliminarGasto(id) {
    if (!confirm('¿Seguro que quieres borrar este registro?')) return;
    try {
        const res = await fetch(`/api/gastos/${id}`, { method: 'DELETE' });
        if (res.ok) {
            M.toast({ html: 'Eliminado', classes: 'grey darken-3' });
            cargarGastos();
        }
    } catch (error) {
        console.error(error);
    }
}

// --- EXPORTAR EXCEL con SheetJS ---
// Exporta únicamente los gastos que cumplan el rango de fechas seleccionado
function descargarExcel() {
    // Determinar qué gastos exportar (solo filtro de fechas, ignora categoría activa)
    let gastosExportar = gastosGlobal;

    if (fechaDesde) {
        gastosExportar = gastosExportar.filter(g => g.fecha >= fechaDesde);
    }
    if (fechaHasta) {
        gastosExportar = gastosExportar.filter(g => g.fecha <= fechaHasta);
    }

    if (gastosExportar.length === 0) {
        M.toast({ html: 'No hay gastos en el rango seleccionado', classes: 'orange' });
        return;
    }

    // Construir filas para la hoja de datos
    const filasDatos = gastosExportar.map(g => ({
        'Fecha':       g.fecha,
        'Categoría':   g.categoria,
        'Detalle':     g.descripcion,
        'Monto (COP)': Number(g.monto),
        'Responsable': g.responsable || ''
    }));

    // Hoja 1: Detalle de gastos
    const wsDetalle = XLSX.utils.json_to_sheet(filasDatos);
    wsDetalle['!cols'] = [
        { wch: 12 }, { wch: 16 }, { wch: 35 }, { wch: 16 }, { wch: 20 }
    ];

    // Hoja 2: Resumen por categoría
    const totalPorCategoria = {};
    gastosExportar.forEach(g => {
        totalPorCategoria[g.categoria] = (totalPorCategoria[g.categoria] || 0) + Number(g.monto);
    });
    const totalGeneral = Object.values(totalPorCategoria).reduce((s, v) => s + v, 0);

    const filasResumen = Object.entries(totalPorCategoria)
        .sort((a, b) => b[1] - a[1])
        .map(([cat, monto]) => ({
            'Categoría':    cat,
            'Total (COP)':  monto,
            '% del Total':  totalGeneral > 0 ? parseFloat(((monto / totalGeneral) * 100).toFixed(2)) : 0
        }));
    filasResumen.push({ 'Categoría': 'TOTAL', 'Total (COP)': totalGeneral, '% del Total': 100 });

    const wsResumen = XLSX.utils.json_to_sheet(filasResumen);
    wsResumen['!cols'] = [{ wch: 18 }, { wch: 16 }, { wch: 14 }];

    // Armar libro y descargar
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsDetalle, 'Gastos');
    XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen por Categoría');

    // Nombre del archivo con rango de fechas
    const rangoNombre = (fechaDesde || fechaHasta)
        ? `_${fechaDesde || 'inicio'}_a_${fechaHasta || 'hoy'}`
        : `_todos`;
    XLSX.writeFile(wb, `Gastos_LasTrampas${rangoNombre}.xlsx`);

    M.toast({ html: '📥 Excel descargado', classes: 'green darken-2' });
}

// --- RESUMEN Y TOP 3 CATEGORÍAS ---
function calcularResumen(gastos) {
    const hoy = new Date();
    const mesActual = hoy.getMonth();
    const anioActual = hoy.getFullYear();

    const gastosMes = gastos.filter(g =>
        g.fecha.startsWith(`${anioActual}-${String(mesActual + 1).padStart(2, '0')}`)
    );

    // El KPI de total lo gestiona actualizarKpiTotal() — aquí solo el Top 3
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
            <td style="padding: 4px 0; font-weight:600;">${iconos[cat] || '📦'} ${cat}</td>
            <td style="padding: 4px 0; text-align:right;" class="${colores[i]}">
                <b>${new Intl.NumberFormat('es-CO', {
                    style: 'currency', currency: 'COP', maximumFractionDigits: 0
                }).format(monto)}</b>
            </td>
        </tr>
    `).join('');
}