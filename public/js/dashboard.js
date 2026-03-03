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
    document.body.style.display = "block";
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
  document.getElementById("filtro-hora-desde").value = String(hi).padStart(2,"0") + ":00";
  document.getElementById("filtro-hora-hasta").value = String(hf).padStart(2,"0") + ":59";
  cargarDashboard();
}
function limpiarFiltroHora() {
  document.getElementById("filtro-hora-desde").value = "00:00";
  document.getElementById("filtro-hora-hasta").value = "23:59";
  cargarDashboard();
}
function horaAMinutos(iso) {
  try { const d = new Date(iso); return d.getHours() * 60 + d.getMinutes(); }
  catch { return 0; }
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

    const desde = new Date(fDesde + "T00:00:00");
    const hasta = new Date(fHasta + "T23:59:59");

    const horaDesdeStr = document.getElementById("filtro-hora-desde")?.value || "00:00";
    const horaHastaStr = document.getElementById("filtro-hora-hasta")?.value || "23:59";
    const [hD, mD] = horaDesdeStr.split(":").map(Number);
    const [hH, mH] = horaHastaStr.split(":").map(Number);
    const minDesde = hD * 60 + mD;
    const minHasta = hH * 60 + mH;

    datosVentasActuales = ventas.filter(v => {
      const fv = parsearFecha(v.Fecha);
      if (fv < desde || fv > hasta) return false;
      if (v._raw?.fecha) {
        const min = horaAMinutos(v._raw.fecha);
        return min >= minDesde && min <= minHasta;
      }
      return minDesde === 0 && minHasta >= 1439;
    });

    datosGastosActuales = rawGastos.filter(g => {
      const fg = new Date(g.fecha + "T00:00:00");
      return fg >= desde && fg <= hasta;
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
            const prod   = inventarioGlobal.find(p => p.nombre?.trim() === nombre);
            totalCosto  += (prod?.costo ? Number(prod.costo) : 0) * cant;
            conteoProductos[nombre] = (conteoProductos[nombre] || 0) + cant;
          }
        });
      }
    });

    const totalGastos   = datosGastosActuales.reduce((s,g) => s + (Number(g.monto)||0), 0);
    const gananciaNeta  = totalIngresos - totalCosto - totalGastos;
    const ticketProm    = totalPersonas > 0 ? Math.round(totalIngresos / totalPersonas) : 0;

    const vendTop = mejorClave(conteoVendedores);
    const prodTop = mejorClave(conteoProductos);

    // ── Actualizar header de rango
    const optsF = { day:"numeric", month:"short" };
    const desdeLeg = desde.toLocaleDateString("es-CO", optsF);
    const hastaLeg = hasta.toLocaleDateString("es-CO", optsF);
    setText("txt-rango-header", `${desdeLeg} – ${hastaLeg}`);

    // ── KPIs
    setText("txt-ventas-totales", fmt(totalIngresos));
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

    // ── Top 5 productos
    renderizarTop5(conteoProductos);

    // ── Gráficas
    renderizarGrafico();
    renderizarGraficoCategorias();

  } catch (err) {
    console.error("Error Dashboard:", err);
    M.toast({ html: "Error cargando datos", classes: "red" });
  }
}

// ── TOP 5 PRODUCTOS ──
function renderizarTop5(conteo) {
  const lista = document.getElementById("lista-top5");
  if (!lista) return;

  const items = Object.entries(conteo)
    .sort((a,b) => b[1] - a[1])
    .slice(0, 5);

  if (items.length === 0) {
    lista.innerHTML = `<li style="color:var(--text-muted);font-size:0.85rem;text-align:center;padding:24px 0;">Sin datos en el período</li>`;
    return;
  }

  const maxVal = items[0][1];
  const rankClasses = ["r1","r2","r3","r4","r5"];
  const medallas    = ["🥇","🥈","🥉","4","5"];

  lista.innerHTML = items.map(([nombre, cant], i) => {
    const pct = Math.round((cant / maxVal) * 100);
    return `
      <li class="top5-item">
        <div class="top5-rank ${rankClasses[i]}">${medallas[i]}</div>
        <div class="top5-info">
          <div class="top5-name" title="${nombre}">${nombre}</div>
          <div class="top5-bar-wrap">
            <div class="top5-bar" style="width:${pct}%"></div>
          </div>
        </div>
        <div class="top5-qty">${cant} uds</div>
      </li>`;
  }).join("");
}

// ── GRÁFICO PRINCIPAL ──
function renderizarGrafico() {
  const canvas = document.getElementById("chart-ventas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (miGrafico) miGrafico.destroy();

  const gradient = ctx.createLinearGradient(0, 0, 0, 280);
  gradient.addColorStop(0, "rgba(26,35,126,0.35)");
  gradient.addColorStop(1, "rgba(26,35,126,0.0)");

  let labels = [], data = [], titulo = "";

  if (vistaActual === "vendedor") {
    titulo = "Ventas por Vendedor";
    const r = {};
    datosVentasActuales.forEach(v => r[v.Vendedor] = (r[v.Vendedor]||0) + (Number(v.Total)||0));
    labels = Object.keys(r);
    data   = Object.values(r);
  } else {
    titulo = "Ventas por Día";
    const r = {};
    datosVentasActuales.forEach(v => r[v.Fecha] = (r[v.Fecha]||0) + (Number(v.Total)||0));
    labels = Object.keys(r).sort((a,b) => parsearFecha(a) - parsearFecha(b));
    data   = labels.map(f => r[f]);
  }

  const esDia = vistaActual === "dia";

  miGrafico = new Chart(ctx, {
    type: esDia ? "line" : "bar",
    data: {
      labels,
      datasets: [{
        label: titulo,
        data,
        backgroundColor: esDia ? gradient : COLORS.chart,
        borderColor: esDia ? COLORS.indigo : "transparent",
        borderWidth: esDia ? 2 : 0,
        borderRadius: esDia ? 0 : 8,
        tension: 0.4,
        fill: true,
        pointBackgroundColor: COLORS.indigo,
        pointRadius: 4,
        pointHoverRadius: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#0d1547",
          titleColor: "#fff",
          bodyColor: "rgba(255,255,255,0.8)",
          padding: 12,
          cornerRadius: 8,
          callbacks: {
            label: ctx => " " + fmt(ctx.raw),
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: "rgba(0,0,0,0.05)" },
          ticks: {
            callback: v => "$" + (v >= 1000 ? (v/1000).toFixed(0)+"k" : v),
            font: { size: 11, family: "'Plus Jakarta Sans', sans-serif" },
            color: "#9ca3af",
          },
          border: { display: false },
        },
        x: {
          grid: { display: false },
          ticks: {
            maxRotation: 45, minRotation: 0,
            font: { size: 11, family: "'Plus Jakarta Sans', sans-serif" },
            color: "#9ca3af",
          },
          border: { display: false },
        },
      },
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
  datosVentasActuales.forEach(v => {
    if (v.Productos) {
      v.Productos.split(", ").forEach(itemStr => {
        const m = itemStr.match(/(.+) \(x(\d+)\)/);
        if (m) {
          const nombre = m[1].trim();
          const prod   = inventarioGlobal.find(p => p.nombre?.trim() === nombre);
          const cat    = prod?.categoria || "Otros";
          resumen[cat] = (resumen[cat] || 0) + parseInt(m[2]);
        }
      });
    }
  });

  miGraficoCategorias = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: Object.keys(resumen),
      datasets: [{
        data:            Object.values(resumen),
        backgroundColor: COLORS.chart,
        borderWidth:     3,
        borderColor:     "#fff",
        hoverOffset:     6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "65%",
      plugins: {
        legend: {
          position: window.innerWidth < 600 ? "bottom" : "right",
          labels: {
            boxWidth: 10, boxHeight: 10,
            borderRadius: 3,
            padding: 14,
            font: { size: 11, family: "'Plus Jakarta Sans', sans-serif", weight: "600" },
            color: "#374151",
          },
        },
        tooltip: {
          backgroundColor: "#0d1547",
          titleColor: "#fff",
          bodyColor: "rgba(255,255,255,0.8)",
          padding: 12,
          cornerRadius: 8,
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