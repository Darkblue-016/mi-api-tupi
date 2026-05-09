export default async function handler(req, res) {
  try {
    const { query = "", limit = "10" } = req.query;

    if (!query || query.trim().length < 2) {
      return res.status(400).json({
        error: "El parámetro query es obligatorio y debe tener al menos 2 caracteres."
      });
    }

    const maxResults = Math.min(parseInt(limit, 10) || 10, 20);
    const encodedQuery = encodeURIComponent(query.trim());

    const tupiUrl = `https://www.tupi.com.py/buscar_paginacion_p_group.php?query=${encodedQuery}`;

    const response = await fetch(tupiUrl, {
      method: "GET",
      headers: {
        "accept": "application/json, text/javascript, */*; q=0.01",
        "user-agent": "Mozilla/5.0"
      }
    });

    if (!response.ok) {
      return res.status(502).json({
        error: "No se pudo consultar Tupi en este momento.",
        status: response.status
      });
    }

    const text = await response.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return res.status(500).json({
        error: "La respuesta de Tupi no llegó en formato JSON válido.",
        raw_preview: text.slice(0, 500)
      });
    }

    const html = data.productos || "";

    const productBlocks = html
      .split('class=\\"product_unit')
      .slice(1)
      .slice(0, maxResults);

    const products = productBlocks.map((block) => {
      const cleanBlock = block
        .replace(/\\\//g, "/")
        .replace(/\\"/g, '"')
        .replace(/\\n/g, " ");

      const urlMatch = cleanBlock.match(/href="(https:\/\/www\.tupi\.com\.py\/producto\/[^"]+)"/);
      const imageMatch = cleanBlock.match(/src="(https:\/\/www\.tupi\.com\.py\/imagen_articulo\/[^"]+)"/);
      const codeMatch = cleanBlock.match(/COD:\s*<\/i>\s*([^<\s]+)/i);

      const titleFromUrl = urlMatch?.[1]
        ? decodeURIComponent(urlMatch[1].split("/").pop().replace(/-/g, " "))
        : null;

      const priceMatches = [...cleanBlock.matchAll(/Gs\.\s*([0-9.]+)/g)].map((m) => {
        return parseInt(m[1].replace(/\./g, ""), 10);
      });

      const cashPrice = priceMatches.length > 0 ? priceMatches[0] : null;

      const installmentTexts = [...cleanBlock.matchAll(/([0-9]+x\s*Gs\.\s*[0-9.]+)/g)].map((m) => m[1]);

      return {
        name: titleFromUrl || "No especificado",
        code: codeMatch?.[1] || "No especificado",
        url: urlMatch?.[1] || null,
        image_url: imageMatch?.[1] || null,
        cash_price: cashPrice,
        currency: "PYG",
        installment_prices: installmentTexts,
        availability: "No especificado",
        source: "Tupi Paraguay"
      };
    });

    return res.status(200).json({
      source: "Tupi Paraguay",
      query,
      consultation_date: new Date().toISOString().slice(0, 10),
      search_url: tupiUrl,
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
