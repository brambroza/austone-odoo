/**
 * Site-wide SEO constants and JSON-LD builders for the public landing page.
 * Everything here is static so the landing can be fully pre-rendered.
 */

/**
 * Company identity, taken from the Austone Thailand website (austone-thailand-coltd.odoo.com).
 * TODO(customer): registered address and business hours are not published on that site; fill them in
 * once Austone confirms. An empty `address` hides the address block and leaves it out of the JSON-LD.
 */
export const SITE = {
  name: 'Austone Dealer',
  legalName: 'บริษัท ออสโตน (ไทยแลนด์) จำกัด',
  legalNameEn: 'AUSTONE (THAILAND) CO.,LTD.',
  address: '',
  postalAddress: { streetAddress: '', addressLocality: '', addressRegion: '', postalCode: '', addressCountry: 'TH' },
  emails: ['austonecheck@gmail.com'],
  businessHours: 'จ-ศ 09:00-18:00',
  description:
    'ระบบสั่งซื้อยาง AUSTONE สำหรับดีลเลอร์ ยางรถยนต์ ยางรถบรรทุก และกระทะล้อ จากบริษัท ออสโตน (ไทยแลนด์) จำกัด ตัวแทนจำหน่ายยาง AUSTONE เพียงรายเดียวในประเทศไทย ค้นหาด้วยขนาด เห็นราคาของร้านทันที รับประกันยางรถยนต์ 120 วัน ยางรถบรรทุก 100 วัน',
  locale: 'th_TH',
  lineId: '@agu2477n',
  phone: '02-711-5656',
  facebook: 'https://www.facebook.com/profile.php?id=100064109706066',
  keywords: [
    'ยาง AUSTONE',
    'Austone Thailand',
    'ออสโตน',
    'ยางออสโตน',
    'ดีลเลอร์ยาง AUSTONE',
    'ตัวแทนจำหน่ายยาง AUSTONE',
    'ยางรถยนต์ AUSTONE',
    'ยางรถบรรทุก AUSTONE',
    'ยาง TBR AUSTONE',
    'กระทะล้อ',
    'ยางรถยนต์ราคาส่ง',
    'ยางรถบรรทุกราคาส่ง',
    'สั่งยางออนไลน์',
    'ดีลเลอร์ยาง',
    'ระบบสั่งซื้อดีลเลอร์',
    'รับประกันยาง 120 วัน',
    'เคลมยางทันที',
    'รับสมัครดีลเลอร์ยาง',
  ],
} as const;

/**
 * Canonical site origin. Reads `NEXT_PUBLIC_SITE_URL` and falls back to localhost
 * so builds never fail when the variable is missing.
 */
export function siteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) return 'http://localhost:3000';
  return raw.replace(/\/+$/, '');
}

/** Builds an absolute URL from a path, normalising duplicate slashes. */
export function absoluteUrl(path = '/'): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `${siteUrl()}${clean}`;
}

/** schema.org FAQPage node from question/answer pairs. */
export function faqJsonLd(items: readonly { q: string; a: string }[]): Record<string, unknown> {
  return {
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({ '@type': 'Question', name: item.q, acceptedAnswer: { '@type': 'Answer', text: item.a } })),
  };
}

/** schema.org BreadcrumbList from ordered `{ name, path }` crumbs. */
export function breadcrumbJsonLd(crumbs: readonly { name: string; path: string }[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, i) => ({ '@type': 'ListItem', position: i + 1, name: crumb.name, item: absoluteUrl(crumb.path) })),
  };
}

/** schema.org Organization + WebSite graph for the landing page, plus FAQ and brand list when supplied. */
export function landingJsonLd(extras: { faq?: readonly { q: string; a: string }[]; brands?: readonly string[] } = {}): Record<string, unknown> {
  const url = absoluteUrl('/');
  const graph: Record<string, unknown>[] = [
      {
        '@type': 'Organization',
        '@id': `${url}#organization`,
        name: SITE.legalName,
        url,
        logo: absoluteUrl('/opengraph-image'),
        ...(SITE.postalAddress.streetAddress ? { address: { '@type': 'PostalAddress', ...SITE.postalAddress } } : {}),
        sameAs: [SITE.facebook],
        email: SITE.emails[0],
        contactPoint: [{ '@type': 'ContactPoint', contactType: 'sales', telephone: SITE.phone, email: SITE.emails[0], availableLanguage: ['th'] }],
      },
      {
        '@type': 'WebSite',
        '@id': `${url}#website`,
        name: SITE.name,
        url,
        inLanguage: 'th',
        publisher: { '@id': `${url}#organization` },
      },
      {
        '@type': 'WebApplication',
        name: SITE.name,
        url,
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        description: SITE.description,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'THB', description: 'สมัครเป็นดีลเลอร์ฟรี' },
      },
  ];
  if (extras.faq?.length) graph.push(faqJsonLd(extras.faq));
  if (extras.brands?.length) {
    graph.push({
      '@type': 'ItemList',
      name: 'แบรนด์ที่จำหน่าย',
      itemListElement: extras.brands.map((name, i) => ({ '@type': 'ListItem', position: i + 1, name })),
    });
  }
  return { '@context': 'https://schema.org', '@graph': graph };
}
