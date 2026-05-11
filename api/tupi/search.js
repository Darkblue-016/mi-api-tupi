export default async function handler(req, res) {
  try {
    const { query = "", page = "1", limit = "10" } = req.query;

    if (!query || query.trim().length < 2) {
      return res.status(400).json({
        error: "El parámetro query es obligatorio y debe tener al menos 2 caracteres."
      });
    }

    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const maxResults = Math.min(parseInt(limit, 10) || 10, 20);
    const encodedQuery = encodeURIComponent(query.trim()).replace(/%20/g, "+");

    const herimarcUrl =
      `https://www.herimarc.com.py/get-productos?page=${pageNumber}` +
      `&ordenar_por=0&marcas=&categorias=&categorias_top=&query_string=${encodedQuery}`;

    const response = await fetch(herimarcUrl, {
      method: "GET",
      headers: {
        "accept": "application/json, text/plain, */*",
        "accept-language": "es-ES,es;q=0.9,en;q=0.8",
        "referer": `https://www.herimarc.com.py/buscador?buscar=&q=${encodedQuery}`,
        "x-requested-with": "XMLHttpRequest",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });

    if (!response.ok) {
      return res.status(502).json({
        error: "No se pudo consultar Herimarc en este momento.",
        status: response.status
      });
    }

    const data = await response.json();

    const items = data?.paginacion?.data || [];

    const products = items.slice(0, maxResults).map((item) => {
      const effectivePrice =
        item.precio_oferta && item.precio_oferta > 0
          ? item.precio_oferta
          : item.getPrecio || item.precio_retail || null;

      return {
        name: item.nombre || item.producto?.nombre || "No especificado",
        sku_id: item.id || null,
        product_id: item.producto_id || item.producto?.id || null,
        code: item.codigo_articulo || item.producto?.codigo || null,
        price: effectivePrice,
        retail_price: item.precio_retail || null,
        offer_price: item.precio_oferta || null,
        currency: "PYG",
        stock: item.existencia ?? null,
        availability:
          item.existencia > 0 ? "Disponible" : "Sin stock o no especificado",
        unit: item.unidad_medida || null,
        image_url: item.primera_imagen || item.primera_imagen_thumb || null,
        url: item.url_ver || null,
        category: item.producto?.categoria?.nombre || item.producto?.categoria_ws || null,
        subcategory: item.producto?.subcategoria_ws || null,
        summary: stripHtml(item.producto?.resumen || ""),
        description: stripHtml(item.producto?.descripcion || ""),
        source: "Herimarc Paraguay"
      };
    });

    return res.status(200).json({
      source: "Herimarc Paraguay",
      query,
      consultation_date: new Date().toISOString().slice(0, 10),
      search_url: herimarcUrl,
      current_page: data?.paginacion?.current_page || pageNumber,
      total: data?.paginacion?.total ?? products.length,
      last_page: data?.paginacion?.last_page ?? null,
      results_count: products.length,
      results: products
    });
  } catch (error) {
    return res.status(500).json({
      error: "Error interno procesando la búsqueda.",
      detail: error.message
    });
  }
}

function stripHtml(html) {
  return String(html)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}
