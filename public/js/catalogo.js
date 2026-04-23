// public/js/catalogo.js — Las Trompetas · Menú Digital Público

let productosGlobal = [];
let categoriaActiva = "Todas";

document.addEventListener("DOMContentLoaded", () => {
    cargarCatalogo();
});

async function cargarCatalogo() {
    try {
        const res = await fetch("/api/inventario/ver");
        const rawData = await res.json();
        
        // Filtrar categorías que no deben ser públicas
        const excluidos = ["INGRESOS BARRA", "INGRESOS CAFETERIA"];
        productosGlobal = rawData.filter(p => {
            const cat = (p.categoria || "").toUpperCase().trim();
            return !excluidos.includes(cat);
        });
        
        generarCategorias();
        renderizarProductos();
    } catch (error) {
        console.error("Error cargando catálogo:", error);
    }
}

function generarCategorias() {
    const listado = document.getElementById("categorias-list");
    const cats = ["Todas", ...new Set(productosGlobal.map(p => p.categoria))];
    
    listado.innerHTML = cats.map(cat => `
        <button class="category-pill ${cat === 'Todas' ? 'active' : 'inactive'}" 
                onclick="filtrarCategoria('${cat}', this)">
            ${cat}
        </button>
    `).join('');
}

function filtrarCategoria(cat, btn) {
    categoriaActiva = cat;
    
    // UI Update
    document.querySelectorAll(".category-pill").forEach(b => {
        b.classList.remove("active");
        b.classList.add("inactive");
    });
    btn.classList.add("active");
    btn.classList.remove("inactive");
    
    renderizarProductos();
}

function filtrarProductos() {
    renderizarProductos();
}

function renderizarProductos() {
    const grid = document.getElementById("grid-productos");
    const busqueda = (document.getElementById("busqueda").value || document.getElementById("busqueda-mobile").value || "").toLowerCase();
    
    const filtrados = productosGlobal.filter(p => {
        const matchesCat = categoriaActiva === "Todas" || p.categoria === categoriaActiva;
        const matchesBus = p.nombre.toLowerCase().includes(busqueda);
        return matchesCat && matchesBus;
    });

    if (filtrados.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full py-20 text-center space-y-4">
                <i class="material-icons text-6xl text-slate-200">search_off</i>
                <p class="text-slate-400 font-medium">No encontramos lo que buscas...</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = filtrados.map(p => {
        const disponible = p.cantidad > 0;
        const imagenUrl = `/public/img/${limpiarNombre(p.nombre)}.jpg`;
        const fallbackImg = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=300";

        return `
            <div class="product-card ${!disponible ? 'opacity-75 grayscale-[0.5]' : ''}">
                <div class="stock-badge ${disponible ? 'bg-emerald-500/90 text-white' : 'bg-rose-500/90 text-white'}">
                    ${disponible ? 'Disponible' : 'Agotado'}
                </div>
                
                <div class="aspect-square overflow-hidden bg-slate-100">
                    <img src="${imagenUrl}" 
                         onerror="this.src='${fallbackImg}'"
                         class="w-full h-full object-cover transition-transform duration-700 hover:scale-110" 
                         alt="${p.nombre}">
                </div>
                
                <div class="p-4 flex-1 flex flex-col justify-between">
                    <div>
                        <p class="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mb-1">${p.categoria}</p>
                        <h3 class="font-bold text-slate-800 leading-tight mb-2">${p.nombre}</h3>
                    </div>
                    
                    <div class="flex items-center justify-between mt-4">
                        <span class="text-lg font-extrabold text-slate-900">${fmt(p.precio)}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function limpiarNombre(nombre) {
    return nombre.toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_|_$/g, "");
}

function fmt(val) {
    return new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        maximumFractionDigits: 0,
    }).format(val);
}
