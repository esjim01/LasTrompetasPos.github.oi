// public/js/dashboard.js — Las Trompetas · Versión Premium

let miGrafico;
let miGraficoCategorias;
let datosVentasActuales = [];
let datosGastosActuales = [];
let vistaActual = "dia";
let inventarioGlobal = [];

const COLORS = {
  indigo:  "#1a237e",
  success: "#2e7d32",
  danger:  "#c62828",
  warning: "#e65100",
  cyan:    "#00838f",
  chart: ["#1a237e","#43a047","#fb8c00","#e53935","#8e24aa","#00acc1","#3949ab","#00695c"],
};

// ── INIT ──
document.addEventListener("DOMContentLoaded", () => {
  const hoy      = new Date();
  const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const elHasta  = document.getElementById("filtro-hasta");
  const elDesde  = document.getElementById("filtro-desde");
  if (elHasta) elHasta.valueAsDate = hoy;
  if (elDesde) elDesde.valueAsDate = primerDia;
  establecerHorasPorDefecto();
  cargarDashboard();
});

// ── PROTECCIÓN ──
(function protegerVista() {
  const sesion = localStorage.getItem("usuarioNombre") || localStorage.getItem("usuarioActual");
  if (!sesion) { window.location.href = "index.html"; return; }
  let usuario;
  try { usuario = JSON.parse(sesion); }
  catch { usuario = { nombre: sesion, rol: "ADMIN" }; localStorage.setItem("usuarioNombre", JSON.stringify(usuario)); }
  if (!usuario?.rol) { localStorage.clear(); window.location.href = "index.html"; return; }
  const rol = usuario.rol.toUpperCase();
  if (!["ADMIN","ADMINISTRADOR","JEFE"].includes(rol)) {
    window.location.href = "ventas.html";
  } else {
    document.body.style.display = "flex";
  }
})();

// ── EXCEL ──
function generarReporteExcel() {
  if (!datosVentasActuales?.length) { M.toast({ html: "⚠️ No hay datos para exportar", classes: "orange" }); return; }
  if (typeof XLSX === "undefined") { alert("Error: librería XLSX no cargó."); return; }
  try {
    const ws = XLSX.utils.json_to_sheet(datosVentasActuales.map(v => ({
      Fecha: v.Fecha, Vendedor: v.Vendedor,
      Personas: Number(v.Personas), Total: Number(v.Total), Items: v.Productos,
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reporte Ventas");
    XLSX.writeFile(wb, `Reporte_Ventas_${new Date().toISOString().split("T")[0]}.xlsx`);
    M.toast({ html: "✅ Reporte descargado", classes: "green" });
  } catch (e) { console.error(e); }
}

// ── FILTROS DE TURNO ──
function aplicarTurno(hi, hf) {
  const horaInicio = String(hi).padStart(2, "0") + ":00";
  const horaFin = String(hf).padStart(2, "0") + ":59";
  document.getElementById("filtro-desde-hora-inicio").value = horaInicio;
  document.getElementById("filtro-desde-hora-fin").value = horaFin;
  document.getElementById("filtro-hasta-hora-inicio").value = horaInicio;
  document.getElementById("filtro-hasta-hora-fin").value = horaFin;
  cargarDashboard();
}
function limpiarFiltroHora() {
  establecerHorasPorDefecto();
  cargarDashboard();
}
function horaAMinutos(iso) {
  try { const d = new Date(iso); return d.getHours() * 60 + d.getMinutes(); }
  catch { return 0; }
}

function establecerHorasPorDefecto() {
  const campos = [
    ["filtro-desde-hora-inicio", "00:00"],
    ["filtro-desde-hora-fin", "23:59"],
    ["filtro-hasta-hora-inicio", "00:00"],
    ["filtro-hasta-hora-fin", "23:59"],
  ];

  campos.forEach(([id, valor]) => {
    const input = document.getElementById(id);
    if (input) input.value = valor;
  });
}

function crearFechaHora(fechaStr, horaStr, extremo = "inicio") {
  if (!fechaStr) return null;
  const [anio, mes, dia] = fechaStr.split("-").map(Number);
  const [hora = 0, minuto = 0] = (horaStr || "00:00").split(":").map(Number);
  const fecha = new Date(anio, mes - 1, dia, hora, minuto, extremo === "fin" ? 59 : 0, extremo === "fin" ? 999 : 0);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

// ── DASHBOARD PRINCIPAL ──
async function cargarDashboard() {
  try {
    const [resVentas, resInv, resGastos] = await Promise.all([
      fetch("/api/ventas/historial"),
      fetch("/api/inventario/ver"),
      fetch("/api/gastos"),
    ]);
    const rawVentas  = await resVentas.json();
    const inventario = await resInv.json();
    const rawGastos  = await resGastos.json();
    inventarioGlobal = inventario;

    // Normalizar ventas
    const ventas = rawVentas.map(v => {
      let fechaStr = v.Fecha || "";
      if (!fechaStr && v.fecha) {
        const d = new Date(v.fecha);
        fechaStr = `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
      }
      let prodStr = v.Productos || "";
      if (!prodStr && Array.isArray(v.items)) {
        prodStr = v.items.map(i => `${i.nombre} (x${i.cantidad})`).join(", ");
      }
      let vendedor = v.Vendedor || v.vendedor || "Admin";
      if (typeof vendedor === "string" && vendedor.startsWith("{")) {
        try { vendedor = JSON.parse(vendedor).nombre || "Vendedor"; } catch {}
      }
      return {
        Fecha: fechaStr,
        Total: v.Total ?? v.total ?? 0,
        Personas: v.Personas ?? v.numPersonas ?? 0,
        Vendedor: vendedor,
        Productos: prodStr,
        _raw: v,
      };
    });

    // Filtros
    const fDesde = document.getElementById("filtro-desde").value;
    const fHasta = document.getElementById("filtro-hasta").value;
    if (!fDesde || !fHasta) return;

    const desdeInicio = crearFechaHora(
      fDesde,
      document.getElementById("filtro-desde-hora-inicio")?.value || "00:00",
      "inicio",
    );
    const desdeFin = crearFechaHora(
      fDesde,
      document.getElementById("filtro-desde-hora-fin")?.value || "23:59",
      "fin",
    );
    const hastaInicio = crearFechaHora(
      fHasta,
      document.getElementById("filtro-hasta-hora-inicio")?.value || "00:00",
      "inicio",
    );
    const hastaFin = crearFechaHora(
      fHasta,
      document.getElementById("filtro-hasta-hora-fin")?.value || "23:59",
      "fin",
    );

    if (!desdeInicio || !desdeFin || !hastaInicio || !hastaFin) {
      M.toast({ html: "⚠️ Revisa las fechas y horas del filtro", classes: "orange" });
      return;
    }

    if (desdeInicio > desdeFin) {
      M.toast({ html: "⚠️ La hora inicio de 'Desde' no puede ser mayor que la hora final", classes: "orange" });
      return;
    }

    if (hastaInicio > hastaFin) {
      M.toast({ html: "⚠️ La hora inicio de 'Hasta' no puede ser mayor que la hora final", classes: "orange" });
      return;
    }

    const inicioFiltro = desdeInicio;
    const finFiltro = hastaFin;

    if (inicioFiltro > finFiltro) {
      M.toast({ html: "⚠️ El rango final no puede ser menor que el rango inicial", classes: "orange" });
      return;
    }

    datosVentasActuales = ventas.filter(v => {
      const fechaVenta = obtenerFechaVenta(v);
      if (!fechaVenta) return false;
      return fechaVenta >= inicioFiltro && fechaVenta <= finFiltro;
    });

    datosGastosActuales = rawGastos.filter(g => {
      const fg = obtenerFechaGasto(g);
      return fg && fg >= inicioFiltro && fg <= finFiltro;
    });

    // Cálculos
    let totalIngresos = 0, totalCosto = 0, totalPersonas = 0;
    const conteoProductos  = {};
    const conteoVendedores = {};

    datosVentasActuales.forEach(v => {
      totalIngresos += Number(v.Total) || 0;
      totalPersonas += Number(v.Personas) || 0;
      conteoVendedores[v.Vendedor] = (conteoVendedores[v.Vendedor] || 0) + (Number(v.Total) || 0);

      if (v.Productos) {
        v.Productos.split(", ").forEach(itemStr => {
          const m = itemStr.match(/(.+) \(x(\d+)\)/);
          if (m) {
            const nombre = m[1].trim();
            const cant   = parseInt(m[2]);
            // Buscar producto en inventario con normalización flexible
            const normalize = (s) => String(s || "").normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
            const target = normalize(nombre);
            let prod = inventarioGlobal.find(p => normalize(p.nombre) === target);
            if (!prod) {
              // intentos de coincidencia más flexibles
              prod = inventarioGlobal.find(p => normalize(p.nombre).includes(target))
                  || inventarioGlobal.find(p => target.includes(normalize(p.nombre)));
            }

            const costoUnit = prod && !Number.isNaN(Number(prod.costo)) ? Number(prod.costo) : null;
            if (costoUnit !== null) {
              totalCosto += costoUnit * cant;
            } else {
              // Si no encontramos costo en inventario, intentar usar precio del item (estimación)
              const ventaItem = (v._raw && v._raw.items) ? v._raw.items.find(it => String(it.nombre || '').trim() === nombre) : null;
              const precioItem = ventaItem ? Number(ventaItem.precio) || null : null;
              if (precioItem !== null) {
                // No conocemos el costo real: no lo sumamos al costo real pero lo registramos para depuración
                console.warn('Costo no hallado para', nombre, '- usando precio de venta como referencia:', precioItem);
              } else {
                console.warn('Costo no hallado para', nombre, '- producto no encontrado en inventario');
              }
            }

            conteoProductos[nombre] = (conteoProductos[nombre] || 0) + cant;
          }
        });
      }
    });

    const totalGastos   = datosGastosActuales.reduce((s,g) => s + (Number(g.monto)||0), 0);
    const gananciaNeta  = totalIngresos - totalCosto - totalGastos;
    // Ventas netas: ingresos menos gastos del período (visualización adicional)
    const ventasNetas   = totalIngresos - totalGastos;
    const ticketProm    = totalPersonas > 0 ? Math.round(totalIngresos / totalPersonas) : 0;

    const vendTop = mejorClave(conteoVendedores);
    const prodTop = mejorClave(conteoProductos);

    // ── Actualizar header de rango
    const optsF = { day: "numeric", month: "short" };
    const desdeLeg = inicioFiltro.toLocaleDateString("es-CO", optsF);
    const hastaLeg = finFiltro.toLocaleDateString("es-CO", optsF);
    setText("txt-rango-header", `${desdeLeg} – ${hastaLeg}`);

    // ── KPIs
    setText("txt-ventas-totales", fmt(totalIngresos));
    setText("txt-ventas-netas",   fmt(ventasNetas));
    setText("txt-ganancia",       fmt(gananciaNeta));
    setText("txt-gastos-totales", fmt(totalGastos));
    setText("txt-total-personas", totalPersonas.toLocaleString("es-CO"));
    setText("txt-ticket-promedio", fmt(ticketProm));
    setText("txt-vendedor-top", vendTop || "—");
    if (vendTop) setText("sub-vendedor", fmt(conteoVendedores[vendTop]) + " en ventas");
    setText("txt-producto-top", prodTop || "—");
    if (prodTop) setText("sub-producto", `${conteoProductos[prodTop]} unidades`);

    // ── Badges de ganancia
    setBadge("badge-ganancia", gananciaNeta, totalIngresos);
    setBadge("badge-ventas",   totalIngresos, null, datosVentasActuales.length + " ventas");
    setBadge("badge-ventas-netas", ventasNetas, totalIngresos);
    setBadge("badge-gastos",   -totalGastos,  null, null, true);

    // ── Color tarjeta ganancia
    const cardGanancia = document.querySelector(".c-green");
    if (cardGanancia) {
      cardGanancia.querySelector("::before"); // solo referencia
      cardGanancia.style.setProperty("--accent", gananciaNeta < 0 ? "#e53935" : "#43a047");
      const barre = cardGanancia.querySelector(".kpi-card::before");
    }
    actualizarColorGanancia(gananciaNeta);

    // ── Estado de salud
    const margenPct = totalIngresos > 0 ? (gananciaNeta / totalIngresos) * 100 : 0;
    const estadoEl  = document.getElementById("txt-estado");
    if (estadoEl) {
      if (gananciaNeta < 0) {
        estadoEl.innerHTML = `<span class="health-badge bad"><i class="material-icons">warning</i>En pérdida</span>`;
      } else if (margenPct < 10) {
        estadoEl.innerHTML = `<span class="health-badge" style="background:#fff3e0;color:#e65100;"><i class="material-icons">info</i>Margen bajo</span>`;
      } else {
        estadoEl.innerHTML = `<span class="health-badge good"><i class="material-icons">check_circle</i>Saludable</span>`;
      }
    }

    // ── Top 10 productos
    renderizarTop10(conteoProductos);

    // ── Gráficas
    renderizarGrafico();
    renderizarGraficoCategorias();

  } catch (err) {
    console.error("Error Dashboard:", err);
    M.toast({ html: "Error cargando datos", classes: "red" });
  }
}

// ── TOP 10 PRODUCTOS (Tabla) ──
function renderizarTop10(conteo) {
  const tabla = document.getElementById("tabla-top10");
  if (!tabla) return;

  const items = Object.entries(conteo)
    .sort((a,b) => b[1] - a[1])
    .slice(0, 10);

  if (items.length === 0) {
    tabla.innerHTML = `<tr><td colspan="3" class="p-8 text-center text-slate-400 font-medium">Sin datos en el período</td></tr>`;
    return;
  }

  const medallas = ["🥇", "🥈", "🥉"];

  tabla.innerHTML = items.map(([nombre, cant], i) => {
    const pos = i + 1;
    const posDecorated = i < 3 ? medallas[i] : pos;
    const rowClass = i % 2 === 0 ? "bg-white" : "bg-slate-50/30";
    
    return `
      <tr class="${rowClass} hover:bg-slate-50 transition-colors">
        <td class="px-5 py-3 text-center font-bold text-slate-400">${posDecorated}</td>
        <td class="px-5 py-3">
          <div class="font-bold text-slate-700 truncate max-w-[200px]" title="${nombre}">${nombre}</div>
        </td>
        <td class="px-5 py-3 text-right">
          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-brand-50 text-brand-700 border border-brand-100">
            ${cant} uds
          </span>
        </td>
      </tr>`;
  }).join("");
}

// ── GRÁFICO PRINCIPAL (Rendimiento Comercial) ──
function renderizarGrafico() {
    const canvas = document.getElementById("chart-ventas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (miGrafico) miGrafico.destroy();

    // Degradados Premium
    const gradient = ctx.createLinearGradient(0, 0, 0, 350);
    gradient.addColorStop(0, "rgba(99, 102, 241, 0.25)"); // Indigo-500
    gradient.addColorStop(1, "rgba(99, 102, 241, 0.0)");

    let labels = [], data = [], titulo = "";

    if (vistaActual === "vendedor") {
        titulo = "Ventas por Vendedor";
        const r = {};
        datosVentasActuales.forEach(v => r[v.Vendedor] = (r[v.Vendedor] || 0) + (Number(v.Total) || 0));
        // Ordenar por volumen
        const sorted = Object.entries(r).sort((a, b) => b[1] - a[1]);
        labels = sorted.map(i => i[0]);
        data = sorted.map(i => i[1]);
    } else {
        titulo = "Ventas por Día";
        const r = {};
        datosVentasActuales.forEach(v => r[v.Fecha] = (r[v.Fecha] || 0) + (Number(v.Total) || 0));
        labels = Object.keys(r).sort((a, b) => parsearFecha(a) - parsearFecha(b));
        data = labels.map(f => r[f]);
    }

    const esDia = vistaActual === "dia";

    miGrafico = new Chart(ctx, {
        type: esDia ? "line" : "bar",
        data: {
            labels,
            datasets: [{
                label: titulo,
                data,
                backgroundColor: esDia ? gradient : "#6366f1",
                borderColor: "#6366f1",
                borderWidth: esDia ? 3 : 0,
                borderRadius: esDia ? 0 : 12,
                tension: 0.45,
                fill: true,
                pointBackgroundColor: "#fff",
                pointBorderColor: "#6366f1",
                pointBorderWidth: 2,
                pointRadius: esDia ? 4 : 0,
                pointHoverRadius: esDia ? 7 : 0,
                pointHoverBackgroundColor: "#6366f1",
                pointHoverBorderColor: "#fff",
                pointHoverBorderWidth: 2,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index',
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: "rgba(15, 23, 42, 0.95)",
                    titleFont: { size: 13, weight: '700', family: "'Outfit', sans-serif" },
                    bodyFont: { size: 12, family: "'Outfit', sans-serif" },
                    padding: 12,
                    cornerRadius: 12,
                    displayColors: false,
                    callbacks: {
                        label: (context) => ` Total: ${fmt(context.raw)}`,
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { 
                        color: "rgba(226, 232, 240, 0.5)",
                        drawBorder: false
                    },
                    ticks: {
                        callback: v => v >= 1000 ? (v / 1000).toFixed(0) + "k" : v,
                        font: { size: 10, family: "'Outfit', sans-serif", weight: '500' },
                        color: "#94a3b8",
                        padding: 10
                    }
                },
                x: {
                    grid: { display: false },
                    ticks: {
                        font: { size: 10, family: "'Outfit', sans-serif", weight: '500' },
                        color: "#94a3b8",
                        padding: 10
                    }
                }
            }
        },
    });
}

// ── GRÁFICO CATEGORÍAS ──
function renderizarGraficoCategorias() {
    const canvas = document.getElementById("chart-categorias");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (miGraficoCategorias) miGraficoCategorias.destroy();

    const resumen = {};
    let totalUnidades = 0;

    datosVentasActuales.forEach(v => {
        if (v.Productos) {
            v.Productos.split(", ").forEach(itemStr => {
                const m = itemStr.match(/(.+) \(x(\d+)\)/);
                if (m) {
                    const nombre = m[1].trim();
                    const cant = parseInt(m[2]);
                    const prod = inventarioGlobal.find(p => p.nombre?.trim() === nombre);
                    const cat = prod?.categoria || "Otros";
                    resumen[cat] = (resumen[cat] || 0) + cant;
                    totalUnidades += cant;
                }
            });
        }
    });

    const labels = Object.keys(resumen);
    const data = Object.values(resumen);

    // Plugin para texto central
    const centerTextPlugin = {
        id: 'centerText',
        afterDraw: (chart) => {
            const { ctx, chartArea: { left, top, right, bottom } } = chart;
            ctx.save();
            const centerX = (left + right) / 2;
            const centerY = (top + bottom) / 2;

            // Dibujar número grande
            ctx.font = 'bold 24px Outfit';
            ctx.fillStyle = '#1e293b';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(totalUnidades, centerX, centerY - 5);

            // Dibujar etiqueta pequeña
            ctx.font = 'bold 10px Outfit';
            ctx.fillStyle = '#94a3b8';
            ctx.fillText('UNIDADES', centerX, centerY + 15);
            ctx.restore();
        }
    };

    miGraficoCategorias = new Chart(ctx, {
        type: "doughnut",
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: [
                    "#6366f1", // Indigo
                    "#10b981", // Emerald
                    "#f59e0b", // Amber
                    "#ef4444", // Rose
                    "#8b5cf6", // Violet
                    "#06b6d4", // Cyan
                    "#f472b6", // Pink
                    "#94a3b8"  // Slate
                ],
                borderWidth: 4,
                borderColor: "#fff",
                hoverOffset: 12,
                borderRadius: 4
            }],
        },
        plugins: [centerTextPlugin],
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: "75%",
            plugins: {
                legend: {
                    position: "bottom",
                    labels: {
                        boxWidth: 8,
                        boxHeight: 8,
                        usePointStyle: true,
                        pointStyle: 'circle',
                        padding: 15,
                        font: { size: 11, family: "'Outfit', sans-serif", weight: '600' },
                        color: "#64748b",
                    },
                },
                tooltip: {
                    backgroundColor: "rgba(15, 23, 42, 0.95)",
                    padding: 12,
                    cornerRadius: 12,
                    titleFont: { family: "'Outfit', sans-serif" },
                    bodyFont: { family: "'Outfit', sans-serif" },
                    callbacks: {
                        label: (context) => {
                            const val = context.raw;
                            const pct = ((val / totalUnidades) * 100).toFixed(1);
                            return ` ${context.label}: ${val} uds (${pct}%)`;
                        }
                    }
                },
            },
        },
    });
}

// ── UTILIDADES ──
function fmt(val) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency", currency: "COP", maximumFractionDigits: 0,
  }).format(val);
}

function parsearFecha(str) {
  if (!str) return new Date(0);
  const p = str.split("/");
  return new Date(p[2], p[1]-1, p[0]);
}

function obtenerFechaVenta(venta) {
  if (venta?._raw?.fecha) {
    const fecha = new Date(venta._raw.fecha);
    return Number.isNaN(fecha.getTime()) ? null : fecha;
  }

  if (venta?.Fecha) {
    const fecha = parsearFecha(venta.Fecha);
    return Number.isNaN(fecha.getTime()) ? null : fecha;
  }

  return null;
}

function obtenerFechaGasto(gasto) {
  if (!gasto?.fecha) return null;
  const fecha = new Date(gasto.fecha + "T00:00:00");
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.innerText = val;
}

function mejorClave(obj) {
  const keys = Object.keys(obj);
  if (!keys.length) return null;
  return keys.reduce((a,b) => obj[a] > obj[b] ? a : b);
}

function setBadge(id, valor, total, textoFijo, invertir = false) {
  const el = document.getElementById(id);
  if (!el) return;
  if (textoFijo) { el.textContent = textoFijo; return; }
  if (total && total > 0) {
    const pct = Math.round((valor / total) * 100);
    const dir = invertir ? pct < 0 : pct >= 0;
    el.className = "kpi-badge " + (dir ? "up" : "down");
    el.innerHTML = `<i class="material-icons">${dir ? "arrow_upward" : "arrow_downward"}</i>${Math.abs(pct)}%`;
  }
}

function actualizarColorGanancia(val) {
  const card = document.querySelector(".c-green");
  if (!card) return;
  const before = card.style;
  // Cambiamos el color del accent bar via un helper class
  if (val < 0) {
    card.classList.remove("c-green");
    card.classList.add("c-red-ganancia");
  } else {
    card.classList.remove("c-red-ganancia");
    if (!card.classList.contains("c-green")) card.classList.add("c-green");
  }
}

function cambiarVistaGrafico(vista) {
  vistaActual = vista;
  renderizarGrafico();
}

window.addEventListener("resize", () => {
  if (miGrafico) miGrafico.update();
  if (miGraficoCategorias) miGraficoCategorias.update();
});