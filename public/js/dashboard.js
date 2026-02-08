
// dashboard.js - Versión Alta Categoría (Adaptada a JSON)

let miGrafico;
let miGraficoCategorias;
let datosVentasActuales = [];
let vistaActual = "vendedor";
let inventarioGlobal = [];

// Paleta de colores Premium
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
    document.getElementById("filtro-hasta").valueAsDate = hoy;
    hoy.setDate(hoy.getDate() - 30);
    document.getElementById("filtro-desde").valueAsDate = hoy;

    cargarDashboard();
});

async function cargarDashboard() {
    try {
        const resVentas = await fetch("/api/ventas/historial");
        const rawVentas = await resVentas.json(); // Datos crudos (pueden venir en JSON o Excel)

        // --- ADAPTADOR DE DATOS (El puente entre lo nuevo y tu código actual) ---
        // Esto convierte el formato nuevo (items array, fecha ISO) al formato antiguo (string, DD/MM/AAAA)
        // para que tu lógica original funcione sin tocar nada más.
        const ventas = rawVentas.map(v => {
            // 1. Normalizar Fecha
            let fechaStr = v.Fecha || ""; // Intenta leer formato antiguo
            if (!fechaStr && v.fecha) {
                // Si es formato nuevo (ISO), convertir a DD/MM/AAAA
                const d = new Date(v.fecha);
                fechaStr = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth()+1).toString().padStart(2, '0')}/${d.getFullYear()}`;
            }

            // 2. Normalizar Productos (Array a String "Producto (xCant)")
            let prodStr = v.Productos || "";
            if (!prodStr && v.items && Array.isArray(v.items)) {
                // Reconstruimos el string para que tu regex de abajo funcione
                prodStr = v.items.map(i => `${i.nombre} (x${i.cantidad})`).join(", ");
            }

            // Devolvemos el objeto con las Mayúsculas que tu código espera
            return {
                Fecha: fechaStr,
                Total: v.Total !== undefined ? v.Total : (v.total || 0),
                Personas: v.Personas !== undefined ? v.Personas : (v.numPersonas || 0),
                Vendedor: v.Vendedor || v.vendedor || "Admin",
                Productos: prodStr
            };
        });
        // --- FIN DEL ADAPTADOR ---

        const resInv = await fetch("/api/inventario/ver");
        const inventario = await resInv.json();
        inventarioGlobal = inventario;

        const fDesde = document.getElementById("filtro-desde").value;
        const fHasta = document.getElementById("filtro-hasta").value;

        if (!fDesde || !fHasta) return;

        const desde = new Date(fDesde + "T00:00:00");
        const hasta = new Date(fHasta + "T23:59:59");

        datosVentasActuales = ventas.filter((v) => {
            const fechaVenta = parsearFecha(v.Fecha);
            return fechaVenta >= desde && fechaVenta <= hasta;
        });

        let totalIngresos = 0;
        let totalCosto = 0;
        let totalPersonas = 0;
        let conteoProductos = {};
        let conteoVendedores = {};

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
                        totalCosto += costoUnitario * cant;
                        conteoProductos[nombre] = (conteoProductos[nombre] || 0) + cant;
                    }
                });
            }
        });

        // Actualización de UI con formato
        actualizarTexto("txt-ventas-totales", `$${totalIngresos.toLocaleString()}`);
        actualizarTexto("txt-ganancia", `$${(totalIngresos - totalCosto).toLocaleString()}`);
        actualizarTexto("txt-total-personas", totalPersonas.toLocaleString());

        const ticketProm = totalPersonas > 0 ? totalIngresos / totalPersonas : 0;
        actualizarTexto("txt-ticket-promedio", `$${Math.round(ticketProm).toLocaleString()}`);

        const prodTop = Object.keys(conteoProductos).length > 0 
            ? Object.keys(conteoProductos).reduce((a, b) => conteoProductos[a] > conteoProductos[b] ? a : b) : "N/A";
        const vendTop = Object.keys(conteoVendedores).length > 0 
            ? Object.keys(conteoVendedores).reduce((a, b) => conteoVendedores[a] > conteoVendedores[b] ? a : b) : "N/A";

        actualizarTexto("txt-producto-top", prodTop);
        actualizarTexto("txt-vendedor-top", vendTop);

        renderizarGrafico();
        renderizarGraficoCategorias();

    } catch (error) {
        console.error("Error Dashboard:", error);
    }
}

function cambiarVistaGrafico(nuevaVista) {
    vistaActual = nuevaVista;
    renderizarGrafico();
}

function renderizarGrafico() {
    const canvas = document.getElementById("chart-ventas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (miGrafico) miGrafico.destroy();

    // Creación de Gradiente Premium
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
                borderRadius: 5 // Bordes redondeados para barras
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false } // Limpieza visual
            },
            scales: {
                y: { 
                    beginAtZero: true,
                    grid: { display: false },
                    ticks: { callback: value => '$' + value.toLocaleString() }
                },
                x: { grid: { display: false } }
            }
        }
    });
}

function renderizarGraficoCategorias() {
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
                borderWidth: 0 // Sin bordes para un look más flat/moderno
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%', // Dona más delgada = más elegante
            plugins: {
                legend: { position: "bottom", labels: { usePointStyle: true, padding: 20 } }
            }
        }
    });
}

function parsearFecha(fechaStr) {
    if (!fechaStr) return new Date(0);
    const partes = fechaStr.split("/");
    return new Date(partes[2], partes[1] - 1, partes[0]);
}

function actualizarTexto(id, valor) {
    const el = document.getElementById(id);
    if (el) {
        el.style.opacity = 0; // Efecto de transición simple
        setTimeout(() => {
            el.innerText = valor;
            el.style.opacity = 1;
            el.style.transition = "opacity 0.5s";
        }, 200);
    }
}