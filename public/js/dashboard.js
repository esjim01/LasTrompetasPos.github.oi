// public/js/dashboard.js - Versión Integrada y Responsive

let miGrafico;
let miGraficoCategorias;
let datosVentasActuales = [];
let datosGastosActuales = [];
let vistaActual = "vendedor";
let inventarioGlobal = [];

const COLORS = {
  indigo: "#1a237e",
  indigoLight: "rgba(26, 35, 126, 0.1)",
  success: "#2e7d32",
  warning: "#ef6c00",
  danger: "#c62828",
  chart: [
    "#1a237e",
    "#43a047",
    "#fb8c00",
    "#e53935",
    "#8e24aa",
    "#00acc1",
    "#3949ab",
  ],
};

document.addEventListener("DOMContentLoaded", () => {
  const hoy = new Date();
  const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

  if (document.getElementById("filtro-hasta"))
    document.getElementById("filtro-hasta").valueAsDate = hoy;
  if (document.getElementById("filtro-desde"))
    document.getElementById("filtro-desde").valueAsDate = primerDia;

  if (typeof M !== "undefined") M.updateTextFields();
  cargarDashboard();
});

// ==========================================
// 1. FUNCIÓN DE PROTECCIÓN (Mantenida intacta)
// ==========================================
(function protegerVista() {
  const sesionGuardada =
    localStorage.getItem("usuarioNombre") ||
    localStorage.getItem("usuarioActual");
  if (!sesionGuardada) {
    window.location.href = "index.html";
    return;
  }
  let usuario = null;
  try {
    usuario = JSON.parse(sesionGuardada);
  } catch (error) {
    usuario = { nombre: sesionGuardada, rol: "ADMIN" };
    localStorage.setItem("usuarioNombre", JSON.stringify(usuario));
  }

  if (!usuario || !usuario.rol) {
    alert("⚠️ Error: Sesión desactualizada.");
    localStorage.clear();
    window.location.href = "index.html";
    return;
  }

  const rol = usuario.rol.toUpperCase();
  if (rol !== "ADMIN" && rol !== "ADMINISTRADOR" && rol !== "JEFE") {
    window.location.href = "ventas.html";
  } else {
    document.body.style.display = "block";
  }
})();

// ==========================================
// 2. FUNCIÓN GENERAR EXCEL (Mantenida intacta)
// ==========================================
function generarReporteExcel() {
  if (!datosVentasActuales || datosVentasActuales.length === 0) {
    M.toast({ html: "⚠️ No hay datos para exportar", classes: "orange" });
    return;
  }
  if (typeof XLSX === "undefined") {
    alert("Error: La librería SheetJS no cargó.");
    return;
  }
  try {
    const datosParaExcel = datosVentasActuales.map((venta) => ({
      Fecha: venta.Fecha,
      Vendedor: venta.Vendedor,
      Personas: Number(venta.Personas),
      Total: Number(venta.Total),
      Items: venta.Productos,
    }));
    const ws = XLSX.utils.json_to_sheet(datosParaExcel);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reporte Ventas");
    const hoy = new Date().toISOString().split("T")[0];
    XLSX.writeFile(wb, `Reporte_Ventas_${hoy}.xlsx`);
    M.toast({ html: "✅ Reporte descargado", classes: "green" });
  } catch (e) {
    console.error("Error exportando:", e);
  }
}

// --- FILTROS DE TURNO RÁPIDO ---
function aplicarTurno(horaInicio, horaFin) {
  document.getElementById("filtro-hora-desde").value =
    String(horaInicio).padStart(2, "0") + ":00";
  document.getElementById("filtro-hora-hasta").value =
    String(horaFin).padStart(2, "0") + ":59";
  cargarDashboard();
}

function limpiarFiltroHora() {
  document.getElementById("filtro-hora-desde").value = "00:00";
  document.getElementById("filtro-hora-hasta").value = "23:59";
  cargarDashboard();
}

// Extrae solo HH:MM de una fecha ISO y lo convierte a minutos para comparar
function horaAMinutos(fechaISO) {
  try {
    const d = new Date(fechaISO);
    return d.getHours() * 60 + d.getMinutes();
  } catch (e) {
    return 0;
  }
}

async function cargarDashboard() {
  try {
    const [resVentas, resInv, resGastos] = await Promise.all([
      fetch("/api/ventas/historial"),
      fetch("/api/inventario/ver"),
      fetch("/api/gastos"),
    ]);

    const rawVentas = await resVentas.json();
    const inventario = await resInv.json();
    const rawGastos = await resGastos.json();

    inventarioGlobal = inventario;

    const ventas = rawVentas.map((v) => {
      let fechaStr = v.Fecha || "";
      if (!fechaStr && v.fecha) {
        const d = new Date(v.fecha);
        fechaStr = `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getFullYear()}`;
      }
      let prodStr = v.Productos || "";
      if (!prodStr && v.items && Array.isArray(v.items)) {
        prodStr = v.items.map((i) => `${i.nombre} (x${i.cantidad})`).join(", ");
      }
      let vendedorNombre = v.Vendedor || v.vendedor || "Admin";
      if (
        typeof vendedorNombre === "string" &&
        vendedorNombre.startsWith("{")
      ) {
        try {
          const parsed = JSON.parse(vendedorNombre);
          vendedorNombre = parsed.nombre || "Vendedor";
        } catch (e) {}
      }
      return {
        Fecha: fechaStr,
        Total: v.Total !== undefined ? v.Total : v.total || 0,
        Personas: v.Personas !== undefined ? v.Personas : v.numPersonas || 0,
        Vendedor: vendedorNombre,
        Productos: prodStr,
      };
    });

    // ✅ DESPUÉS
    const fDesde = document.getElementById("filtro-desde").value;
    const fHasta = document.getElementById("filtro-hasta").value;
    if (!fDesde || !fHasta) return;

    const desde = new Date(fDesde + "T00:00:00");
    const hasta = new Date(fHasta + "T23:59:59");

    // Leer filtro de hora
    const horaDesdeStr =
      document.getElementById("filtro-hora-desde")?.value || "00:00";
    const horaHastaStr =
      document.getElementById("filtro-hora-hasta")?.value || "23:59";
    const [hD, mD] = horaDesdeStr.split(":").map(Number);
    const [hH, mH] = horaHastaStr.split(":").map(Number);
    const minDesde = hD * 60 + mD;
    const minHasta = hH * 60 + mH;

    // Filtramos por fecha Y hora
    datosVentasActuales = ventas.filter((v) => {
      const fechaVenta = parsearFecha(v.Fecha);
      if (fechaVenta < desde || fechaVenta > hasta) return false;

      // Si la venta tiene fecha ISO (JSON), aplicamos filtro de hora
      const ventaOriginal = rawVentas.find((r) => {
        const d = new Date(r.fecha || 0);
        const dStr = `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getFullYear()}`;
        return dStr === v.Fecha && (r.vendedor || r.Vendedor) === v.Vendedor;
      });

      if (ventaOriginal && ventaOriginal.fecha) {
        const minVenta = horaAMinutos(ventaOriginal.fecha);
        return minVenta >= minDesde && minVenta <= minHasta;
      }

      // Ventas del Excel (sin hora) — pasan el filtro solo si el rango cubre todo el día
      return minDesde === 0 && minHasta >= 1439;
    });

    datosGastosActuales = rawGastos.filter((g) => {
      const fechaGasto = new Date(g.fecha + "T00:00:00");
      return fechaGasto >= desde && fechaGasto <= hasta;
    });

    let totalIngresos = 0,
      totalCostoInsumos = 0,
      totalPersonas = 0;
    let conteoProductos = {},
      conteoVendedores = {};

    datosVentasActuales.forEach((v) => {
      totalIngresos += Number(v.Total) || 0;
      totalPersonas += Number(v.Personas) || 0;
      conteoVendedores[v.Vendedor] =
        (conteoVendedores[v.Vendedor] || 0) + (Number(v.Total) || 0);

      if (v.Productos) {
        v.Productos.split(", ").forEach((itemStr) => {
          const match = itemStr.match(/(.+) \(x(\d+)\)/);
          if (match) {
            const nombre = match[1].trim();
            const cant = parseInt(match[2]);
            const prodInv = inventarioGlobal.find(
              (p) => p.nombre.trim() === nombre,
            );
            let costoUnitario =
              prodInv && prodInv.costo ? Number(prodInv.costo) : 0;
            totalCostoInsumos += costoUnitario * cant;
            conteoProductos[nombre] = (conteoProductos[nombre] || 0) + cant;
          }
        });
      }
    });

    const totalGastosOperativos = datosGastosActuales.reduce(
      (sum, g) => sum + (Number(g.monto) || 0),
      0,
    );
    const gananciaNeta =
      totalIngresos - totalCostoInsumos - totalGastosOperativos;

    actualizarTexto("txt-ventas-totales", formatearDinero(totalIngresos));
    actualizarTexto("txt-ganancia", formatearDinero(gananciaNeta));
    actualizarTexto(
      "txt-gastos-totales",
      formatearDinero(totalGastosOperativos),
    );
    actualizarTexto("txt-total-personas", totalPersonas.toLocaleString());

    const ticketProm = totalPersonas > 0 ? totalIngresos / totalPersonas : 0;
    actualizarTexto(
      "txt-ticket-promedio",
      formatearDinero(Math.round(ticketProm)),
    );

    const prodTop =
      Object.keys(conteoProductos).length > 0
        ? Object.keys(conteoProductos).reduce((a, b) =>
            conteoProductos[a] > conteoProductos[b] ? a : b,
          )
        : "N/A";
    const vendTop =
      Object.keys(conteoVendedores).length > 0
        ? Object.keys(conteoVendedores).reduce((a, b) =>
            conteoVendedores[a] > conteoVendedores[b] ? a : b,
          )
        : "N/A";

    actualizarTexto("txt-vendedor-top", vendTop);

    // KPI Producto más vendido
    const productoTopNombre =
      Object.keys(conteoProductos).length > 0
        ? Object.keys(conteoProductos).reduce((a, b) =>
            conteoProductos[a] > conteoProductos[b] ? a : b,
          )
        : "Sin datos";
    const productoTopCantidad = conteoProductos[productoTopNombre] || 0;

    actualizarTexto(
      "txt-producto-top",
      productoTopNombre !== "Sin datos"
        ? `${productoTopNombre} (${productoTopCantidad} uds)`
        : "Sin datos",
    );
    
    actualizarColorTarjetaGanancia(gananciaNeta);

    renderizarGrafico();
    renderizarGraficoCategorias();
  } catch (error) {
    console.error("Error Dashboard:", error);
  }
}

// --- UTILIDADES ---
function formatearDinero(valor) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(valor);
}

function parsearFecha(fechaStr) {
  if (!fechaStr) return new Date(0);
  const partes = fechaStr.split("/");
  return new Date(partes[2], partes[1] - 1, partes[0]);
}

function actualizarTexto(id, valor) {
  const el = document.getElementById(id);
  if (el) el.innerText = valor;
}

function actualizarColorTarjetaGanancia(valor) {
  const card =
    document.querySelector(".kpi-success") ||
    document.querySelector(".kpi-danger");
  if (card) {
    card.style.borderLeft =
      valor < 0 ? "5px solid #c62828" : "5px solid #2e7d32";
  }
}

function cambiarVistaGrafico(nuevaVista) {
  vistaActual = nuevaVista;
  renderizarGrafico();
}

// --- GRÁFICOS RESPONSIVE ---

function renderizarGrafico() {
  const canvas = document.getElementById("chart-ventas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (miGrafico) miGrafico.destroy();

  // Gradiente dinámico (se ajusta a la altura del canvas actual)
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "rgba(26, 35, 126, 0.4)");
  gradient.addColorStop(1, "rgba(26, 35, 126, 0.0)");

  let etiquetas = [],
    valores = [],
    tituloDataset = "";

  if (vistaActual === "vendedor") {
    tituloDataset = "Ventas por Vendedor";
    const resumen = {};
    datosVentasActuales.forEach(
      (v) =>
        (resumen[v.Vendedor] =
          (resumen[v.Vendedor] || 0) + (Number(v.Total) || 0)),
    );
    etiquetas = Object.keys(resumen);
    valores = Object.values(resumen);
  } else {
    tituloDataset = "Ventas por Día";
    const resumen = {};
    datosVentasActuales.forEach(
      (v) =>
        (resumen[v.Fecha] = (resumen[v.Fecha] || 0) + (Number(v.Total) || 0)),
    );
    etiquetas = Object.keys(resumen).sort(
      (a, b) => parsearFecha(a) - parsearFecha(b),
    );
    valores = etiquetas.map((f) => resumen[f]);
  }

  miGrafico = new Chart(ctx, {
    type: vistaActual === "dia" ? "line" : "bar",
    data: {
      labels: etiquetas,
      datasets: [
        {
          label: tituloDataset,
          data: valores,
          backgroundColor: vistaActual === "dia" ? gradient : COLORS.indigo,
          borderColor: COLORS.indigo,
          borderWidth: 2,
          tension: 0.4,
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: (v) => "$" + v.toLocaleString(),
            font: { size: window.innerWidth < 600 ? 10 : 12 }, // Fuente más pequeña en móvil
          },
        },
        x: {
          ticks: {
            maxRotation: 45,
            minRotation: 45,
            font: { size: window.innerWidth < 600 ? 10 : 12 },
          },
        },
      },
    },
  });
}

function renderizarGraficoCategorias() {
  const canvasCat = document.getElementById("chart-categorias");
  if (!canvasCat) return;
  const ctxCat = canvasCat.getContext("2d");
  if (miGraficoCategorias) miGraficoCategorias.destroy();

  const resumenCat = {};
  datosVentasActuales.forEach((v) => {
    if (v.Productos) {
      v.Productos.split(", ").forEach((itemStr) => {
        const match = itemStr.match(/(.+) \(x(\d+)\)/);
        if (match) {
          const nombre = match[1].trim();
          const prodInv = inventarioGlobal.find(
            (p) => p.nombre.trim() === nombre,
          );
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
      datasets: [
        {
          data: Object.values(resumenCat),
          backgroundColor: COLORS.chart,
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "60%",
      plugins: {
        legend: {
          position: window.innerWidth < 600 ? "bottom" : "right", // Leyenda abajo en móvil, derecha en PC
          labels: { boxWidth: 12, font: { size: 11 } },
        },
      },
    },
  });
}

// Redibujar gráficos si se cambia el tamaño de la pantalla
window.addEventListener("resize", () => {
  if (miGrafico) miGrafico.update();
  if (miGraficoCategorias) miGraficoCategorias.update();
});
