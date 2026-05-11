export default async function handler(req, res) {
  try {
    const { query = "notebook", page = "1", limit = "10" } = req.query;

    const maxResults = Math.min(parseInt(limit, 10) || 10, 20);
    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);

    let nisseiUrl;

    // Por ahora usamos la categoría de notebooks de Nissei.
    // Más adelante podemos agregar más categorías.
    nisseiUrl = `https://nissei.com/py/informatica/notebooks/todas-las-notebooks?is_scroll=1&p=${pageNumber}`;

    const response = await fetch(nisseiUrl, {
      method: "GET",
      headers: {
        "accept": "application/json, text/javascript, */*; q=0.01",
        "accept-language": "es-ES,es;q=0.9,en;q=0.8",
        "x-requested-with": "XMLHttpRequest",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });

    if (!response.ok) {
      return res.status(502).json({
        error: "No se pudo consultar Nissei en este momento.",
        status: response.status
      });
    }

    const text = await response.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return res.status(500).json({
        error: "La respuesta de Nissei no llegó en formato JSON válido.",
        raw_preview: text.slice(0, 500)
      });
    }

    const html = data.categoryProducts || "";

    const normalizedHtml = html
      .replace(/\\\//g, "/")
      .replace(/\\"/g, '"')
      .replace(/\\n/g, " ")
      .replace(/&quot;/g, '"')
      .replace(/&#x20;/g, " ")
      .replace(/&#x2F;/g, "/")
      .replace(/\u00a0/g, " ");

    const productBlocks = normalizedHtml
      .split('<li class="item product product-item')
      .slice(1)
      .slice(0, maxResults);

    const products = productBlocks.map((block) => {
      const cleanBlock = block;

      const urlMatch = cleanBlock.match(/<a class="product-item-link"\s+href="([^"]+)"/);
      const titleMatch = cleanBlock.match(/<a class="product-item-link"[^>]*title="([^"]+)"/);
      const imageMatch = cleanBlock.match(/<img class="product-image-photo"[^>]*src="([^"]+)"/);
      const imageAltMatch = cleanBlock.match(/<img class="product-image-photo"[^>]*alt="([^"]+)"/);
      const skuMatch = cleanBlock.match(/data-product-sku="([^"]+)"/);
      const productIdMatch = cleanBlock.match(/data-product-id="([^"]+)"/);
      const priceAmountMatch = cleanBlock.match(/data-price-amount="([^"]+)"/);
      const visiblePriceMatch = cleanBlock.match(/<span class="price">([^<]+)<\/span>/);

      const rawPrice = priceAmountMatch?.[1]
        ? Number.parseFloat(priceAmountMatch[1])
        : null;

      const roundedPrice = rawPrice !== null
        ? Math.round(rawPrice)
        : null;

      const name = decodeHtml(titleMatch?.[1] || imageAltMatch?.[1] || "No especificado");

      return {
        name,
        sku: skuMatch?.[1] || "No especificado",
        product_id: productIdMatch?.[1] || "No especificado",
        url: urlMatch?.[1] || null,
        image_url: imageMatch?.[1] || null,
        cash_price: roundedPrice,
        visible_price: visiblePriceMatch?.[1]?.replace(/\s+/g, " ").trim() || null,
        currency: "PYG",
        availability: "No especificado",
        source: "Nissei Paraguay"
      };
    });

    return res.status(200).json({
      source: "Nissei Paraguay",
      query,
      category: "notebooks",
      consultation_date: new Date().toISOString().slice(0, 10),
      search_url: nisseiUrl,
      current_page: data.currentPage || pageNumber,
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

function decodeHtml(text) {
  return String(text)
    .replace(/&quot;/g, '"')
    .replace(/&#x20;/g, " ")
    .replace(/&#x2F;/g, "/")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}
