export function GET({ site }) {
  const host = site.host;
  return new Response(`User-agent: *\nDisallow: /api/\nDisallow: /_/\n\nHost: https://${host}\nSitemap: https://${host}/sitemap.xml\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
