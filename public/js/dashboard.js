// public/js/dashboard.js - Versión Integrada (Ventas + Inventario + Gastos)

let miGrafico;
let miGraficoCategorias;
let datosVentasActuales = [];
let datosGastosActuales = []; // --- NUEVO: Array para gastos filtrados
let vistaActual = "vendedor";
let inventarioGlobal = [];

const COLORS = {
    indigo: '#1a237e',
    indigoLight: 'rgba(26, 35, 126, 0.1)',
    success: '#2e7d32',
    warning: '#ef6c00',
    danger: '#c62828',
    chart: ['#1a237e', '#43a047', '#fb8c00', '#e53935', '#8e24aa', '#00acc1', '#3949ab']
};


document.addEventListener("DOMContentLoaded", () => {
    const hoy = new Date();
    const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    
    document.getElementById("filtro-hasta").valueAsDate = hoy;
    document.getElementById("filtro-desde").valueAsDate = primerDia;

    M.updateTextFields();
    cargarDashboard();
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

    const usuario = JSON.parse(sesionGuardada);//

    // 3. REGLA DE ORO: Si no es Admin, ¡FUERA!
    // Cambia 'admin' por como tengas escrito el rol en tu base de datos (ej: 'administrador', 'jefe', etc.)
    if (usuario.rol !== 'ADMIN' && usuario.rol !== 'administrador' && usuario.rol !== 'admin') {
        alert("⛔ Acceso Restringido: Solo personal autorizado.");
        
        // Lo redirigimos a donde SÍ puede estar (Ventas)
        window.location.href = '/public/ventas.html'; 
    }
})();
// --- FIN SEGURIDAD ---

// ... Aquí sigue tu código normal del dashboard ...

async function cargarDashboard() {
    try {
        // --- 1. CARGA DE DATOS EN PARALELO (Ventas, Inventario y GASTOS) ---
        const [resVentas, resInv, resGastos] = await Promise.all([
            fetch("/api/ventas/historial"),
            fetch("/api/inventario/ver"),
            fetch("/api/gastos") // --- NUEVO: Endpoint de gastos
        ]);

        const rawVentas = await resVentas.json();
        const inventario = await resInv.json();
        const rawGastos = await resGastos.json(); // --- NUEVO

        inventarioGlobal = inventario;

        // --- ADAPTADOR DE VENTAS ---
        const ventas = rawVentas.map(v => {
            let fechaStr = v.Fecha || "";
            if (!fechaStr && v.fecha) {
                const d = new Date(v.fecha);
                fechaStr = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth()+1).toString().padStart(2, '0')}/${d.getFullYear()}`;
            }
            let prodStr = v.Productos || "";
            if (!prodStr && v.items && Array.isArray(v.items)) {
                prodStr = v.items.map(i => `${i.nombre} (x${i.cantidad})`).join(", ");
            }
            return {
                Fecha: fechaStr,
                Total: v.Total !== undefined ? v.Total : (v.total || 0),
                Personas: v.Personas !== undefined ? v.Personas : (v.numPersonas || 0),
                Vendedor: v.Vendedor || v.vendedor || "Admin",
                Productos: prodStr
            };
        });

        // --- FILTRADO POR FECHAS ---
        const fDesde = document.getElementById("filtro-desde").value;
        const fHasta = document.getElementById("filtro-hasta").value;

        if (!fDesde || !fHasta) return;

        const desde = new Date(fDesde + "T00:00:00");
        const hasta = new Date(fHasta + "T23:59:59");

        // Filtrar Ventas
        datosVentasActuales = ventas.filter((v) => {
            const fechaVenta = parsearFecha(v.Fecha);
            return fechaVenta >= desde && fechaVenta <= hasta;
        });

        // --- NUEVO: Filtrar Gastos ---
        // Asumiendo que gastos.xlsx tiene fecha formato YYYY-MM-DD
        datosGastosActuales = rawGastos.filter(g => {
            // Ajustar esto si tu fecha de gastos viene diferente
            const fechaGasto = new Date(g.fecha + "T00:00:00"); 
            return fechaGasto >= desde && fechaGasto <= hasta;
        });

        // --- CÁLCULOS ---
        let totalIngresos = 0;
        let totalCostoInsumos = 0; // Costo de lo vendido (Inventario)
        let totalGastosOperativos = 0; // Luz, Agua, Nómina, etc.
        let totalPersonas = 0;
        let conteoProductos = {};
        let conteoVendedores = {};

        // 1. Sumar Ventas y Costos de Insumos
        datosVentasActuales.forEach((v) => {
            totalIngresos += Number(v.Total) || 0;
            totalPersonas += Number(v.Personas) || 0;
            conteoVendedores[v.Vendedor] = (conteoVendedores[v.Vendedor] || 0) + (Number(v.Total) || 0);

            if (v.Productos) {
                const items = v.Productos.split(", ");
                items.forEach((itemStr) => {
                    const match = itemStr.match(/(.+) \(x(\d+)\)/);
                    if (match) {
                        const nombre = match[1].trim();
                        const cant = parseInt(match[2]);
                        const prodInv = inventarioGlobal.find((p) => p.nombre.trim() === nombre);
                        let costoUnitario = prodInv && prodInv.costo ? Number(prodInv.costo) : 0;
                        
                        totalCostoInsumos += costoUnitario * cant;
                        conteoProductos[nombre] = (conteoProductos[nombre] || 0) + cant;
                    }
                });
            }
        });

        // 2. Sumar Gastos Operativos (NUEVO)
        totalGastosOperativos = datosGastosActuales.reduce((sum, g) => sum + (Number(g.monto) || 0), 0);

        // 3. Calcular Utilidad Real
        // Utilidad = Ventas - (Costo Mercancía + Gastos Operativos)
        const gananciaNeta = totalIngresos - totalCostoInsumos - totalGastosOperativos;

        // --- ACTUALIZACIÓN UI ---
        actualizarTexto("txt-ventas-totales", formatearDinero(totalIngresos));
        
        // Actualizamos Ganancia Neta
        actualizarTexto("txt-ganancia", formatearDinero(gananciaNeta));
        
        // Si quieres mostrar los gastos en algún lado, puedes agregar un elemento ID 'txt-gastos-totales'
        if(document.getElementById("txt-gastos-totales")) {
            actualizarTexto("txt-gastos-totales", formatearDinero(totalGastosOperativos));
        }

        actualizarTexto("txt-total-personas", totalPersonas.toLocaleString());

        const ticketProm = totalPersonas > 0 ? totalIngresos / totalPersonas : 0;
        actualizarTexto("txt-ticket-promedio", formatearDinero(Math.round(ticketProm)));

        const prodTop = Object.keys(conteoProductos).length > 0 
            ? Object.keys(conteoProductos).reduce((a, b) => conteoProductos[a] > conteoProductos[b] ? a : b) : "N/A";
        const vendTop = Object.keys(conteoVendedores).length > 0 
            ? Object.keys(conteoVendedores).reduce((a, b) => conteoVendedores[a] > conteoVendedores[b] ? a : b) : "N/A";

        actualizarTexto("txt-producto-top", prodTop);
        actualizarTexto("txt-vendedor-top", vendTop);

        // Actualizar color de la tarjeta de Ganancia según si es positiva o negativa
        actualizarColorTarjetaGanancia(gananciaNeta);

        renderizarGrafico();
        renderizarGraficoCategorias();

    } catch (error) {
        console.error("Error Dashboard:", error);
        M.toast({html: 'Error cargando datos', classes: 'red'});
    }
}

function cambiarVistaGrafico(nuevaVista) {
    vistaActual = nuevaVista;
    renderizarGrafico();
}

// --- UTILIDADES ---
function formatearDinero(valor) {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(valor);
}

function parsearFecha(fechaStr) {
    if (!fechaStr) return new Date(0);
    const partes = fechaStr.split("/");
    return new Date(partes[2], partes[1] - 1, partes[0]);
}

function actualizarTexto(id, valor) {
    const el = document.getElementById(id);
    if (el) {
        el.style.opacity = 0;
        setTimeout(() => {
            el.innerText = valor;
            el.style.opacity = 1;
            el.style.transition = "opacity 0.5s";
        }, 200);
    }
}

function actualizarColorTarjetaGanancia(valor) {
    const card = document.querySelector('.kpi-success'); // La tarjeta de ganancia
    if(card) {
        if(valor < 0) {
            card.classList.remove('kpi-success');
            card.classList.add('kpi-danger'); // Necesitas definir estilo rojo en CSS o usar style inline
            card.style.borderLeft = "5px solid #c62828";
        } else {
            card.classList.remove('kpi-danger');
            card.classList.add('kpi-success');
            card.style.borderLeft = "5px solid #2e7d32";
        }
    }
}

// --- GRÁFICOS (Mantenemos tu lógica visual intacta) ---

function renderizarGrafico() {
    const canvas = document.getElementById("chart-ventas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (miGrafico) miGrafico.destroy();

    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(26, 35, 126, 0.4)');
    gradient.addColorStop(1, 'rgba(26, 35, 126, 0.0)');

    let etiquetas = [], valores = [], tituloDataset = "";

    if (vistaActual === "vendedor") {
        tituloDataset = "Ventas por Vendedor";
        const resumen = {};
        datosVentasActuales.forEach(v => {
            resumen[v.Vendedor] = (resumen[v.Vendedor] || 0) + (Number(v.Total) || 0);
        });
        etiquetas = Object.keys(resumen);
        valores = Object.values(resumen);
    } else {
        tituloDataset = "Ventas por Día";
        const resumen = {};
        datosVentasActuales.forEach(v => {
            resumen[v.Fecha] = (resumen[v.Fecha] || 0) + (Number(v.Total) || 0);
        });
        etiquetas = Object.keys(resumen).sort((a, b) => parsearFecha(a) - parsearFecha(b));
        valores = etiquetas.map(f => resumen[f]);
    }

    miGrafico = new Chart(ctx, {
        type: vistaActual === "dia" ? "line" : "bar",
        data: {
            labels: etiquetas,
            datasets: [{
                label: tituloDataset,
                data: valores,
                backgroundColor: vistaActual === "dia" ? gradient : COLORS.indigo,
                borderColor: COLORS.indigo,
                borderWidth: 3,
                tension: 0.4,
                fill: true,
                borderRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { display: false }, ticks: { callback: value => '$' + value.toLocaleString() } },
                x: { grid: { display: false } }
            }
        }
    });
}

function renderizarGraficoCategorias() {
    // Aquí podrías cambiar para mostrar categorías de Venta O categorías de Gastos
    // Por ahora mantenemos Categorías de Productos Vendidos
    const canvasCat = document.getElementById("chart-categorias");
    if (!canvasCat) return;
    const ctxCat = canvasCat.getContext("2d");
    if (miGraficoCategorias) miGraficoCategorias.destroy();

    const resumenCat = {};
    datosVentasActuales.forEach(v => {
        if (v.Productos) {
            v.Productos.split(", ").forEach(itemStr => {
                const match = itemStr.match(/(.+) \(x(\d+)\)/);
                if (match) {
                    const nombre = match[1].trim();
                    const prodInv = inventarioGlobal.find(p => p.nombre.trim() === nombre);
                    const cat = prodInv ? prodInv.categoria : "Otros";
                    resumenCat[cat] = (resumenCat[cat] || 0) + parseInt(match[2]);
                }
            });
        }
    });

    miGraficoCategorias = new Chart(ctxCat, {
        type: "doughnut",
        data: {
            labels: Object.keys(resumenCat),
            datasets: [{
                data: Object.values(resumenCat),
                backgroundColor: COLORS.chart,
                hoverOffset: 15,
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: { position: "bottom", labels: { usePointStyle: true, padding: 20 } }
            }
        }
    });
}