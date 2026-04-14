/**
 * product controller
 */

import { factories } from '@strapi/strapi';

/** Meta catalog columns (row 2 of their template; data rows only — no # comment row). */
const META_CATALOG_HEADERS = [
  'id',
  'title',
  'description',
  'availability',
  'condition',
  'price',
  'link',
  'image_link',
  'brand',
  'google_product_category',
  'fb_product_category',
  'quantity_to_sell_on_facebook',
  'sale_price',
  'sale_price_effective_date',
  'item_group_id',
  'gender',
  'color',
  'size',
  'age_group',
  'material',
  'pattern',
  'shipping',
  'shipping_weight',
  'offer_disclaimer',
  'offer_disclaimer_url',
  'video[0].url',
  'video[0].tag[0]',
  'gtin',
  'product_tags[0]',
  'product_tags[1]',
  'style[0]',
] as const;

function escapeCsvCell(val: unknown): string {
  if (val == null || val === '') return '';
  const s = String(val).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const normalized = s.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
  if (/[",\n]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }
  return normalized;
}

function csvRow(cells: string[]): string {
  return cells.map(escapeCsvCell).join(',');
}

function formatMoney(amount: number, currency: string): string {
  const n = Number.isFinite(amount) ? amount : 0;
  return `${n.toFixed(2)} ${currency}`;
}

function absoluteMediaUrl(baseUrl: string, url: string | undefined): string {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
}

export default factories.createCoreController('api::product.product', ({ strapi }) => ({
  async catalogCsv(ctx) {
    const storefrontUrl = (
      process.env.STOREFRONT_URL ||
      process.env.FRONTEND_URL ||
      process.env.NEXT_PUBLIC_BASE_URL ||
      'https://yugafarms.com'
    ).replace(/\/$/, '');
    const currency = (process.env.CATALOG_CURRENCY || 'INR').trim();
    const brand = (process.env.CATALOG_BRAND || 'Yuga Farms').trim();

    const protocol =
      (ctx.request as { protocol?: string }).protocol ||
      (ctx as { protocol?: string }).protocol ||
      'http';
    const host = ctx.request.host || ctx.get('host') || 'localhost:1337';
    const strapiPublic =
      (process.env.STRAPI_PUBLIC_URL || process.env.PUBLIC_URL || '').replace(/\/$/, '') ||
      `${protocol}://${host}`;

    const products = await strapi.entityService.findMany('api::product.product', {
      publicationState: 'live',
      populate: {
        Image: true,
        Variants: true,
        Tags: true,
      } as Record<string, boolean>,
    });

    const lines: string[] = [csvRow([...META_CATALOG_HEADERS])];

    for (const product of products as Array<{
      id: number;
      Title: string;
      Description: string;
      Type?: string;
      Image?: Array<{ url?: string }>;
      Variants?: Array<{
        id: number;
        Price?: number;
        Discount?: number;
        Weight?: number;
        Stock: number;
      }>;
      Tags?: Array<{ Value?: string }>;
    }>) {
      const variants = product.Variants || [];
      if (variants.length === 0) continue;

      const firstImage = product.Image?.[0];
      const imageLink = absoluteMediaUrl(strapiPublic, firstImage?.url);
      const productLink = `${storefrontUrl}/product/${product.id}`;
      const desc = product.Description || '';
      const itemGroupId = String(product.id);
      const tag0 = product.Tags?.[0]?.Value ?? '';
      const tag1 = product.Tags?.[1]?.Value ?? '';
      const googleCat =
        product.Type === 'Honey'
          ? 'Food, Beverages & Tobacco > Food Items > Cooking & Baking Ingredients > Honey'
          : 'Food, Beverages & Tobacco > Food Items > Cooking & Baking Ingredients > Oils & Vinegars';

      variants.forEach((variant, index) => {
        const listPrice = Number(variant.Price) || 0;
        const discount = Number(variant.Discount) || 0;
        const saleAmount = Math.max(0, listPrice - discount);
        const onSale = discount > 0 && saleAmount < listPrice;

        const availability = variant.Stock > 0 ? 'in stock' : 'out of stock';
        const rowId = `${product.id}-v${variant.id ?? index + 1}`;
        const weightLabel = variant.Weight != null ? `${variant.Weight} g` : '';

        const titleBase = product.Title || 'Product';
        const title =
          variants.length > 1 && weightLabel
            ? `${titleBase} (${weightLabel})`
            : titleBase;

        const priceField = formatMoney(listPrice, currency);
        const salePriceField = onSale ? formatMoney(saleAmount, currency) : '';
        const qty =
          variant.Stock > 0 ? String(Math.max(1, variant.Stock)) : '';

        const shippingWeight =
          variant.Weight != null && variant.Weight > 0
            ? `${variant.Weight} g`
            : '';

        lines.push(
          csvRow([
            rowId,
            title,
            desc,
            availability,
            'new',
            priceField,
            productLink,
            imageLink,
            brand,
            googleCat,
            '',
            qty,
            salePriceField,
            '',
            itemGroupId,
            '',
            '',
            weightLabel,
            '',
            '',
            '',
            '',
            '',
            shippingWeight,
            '',
            '',
            '',
            '',
            '',
            tag0,
            tag1,
            '',
          ])
        );
      });
    }

    const csv = `${lines.join('\n')}\n`;

    ctx.set('Content-Type', 'text/csv; charset=utf-8');
    ctx.set('Cache-Control', 'public, max-age=300');
    ctx.body = csv;
  },
}));
