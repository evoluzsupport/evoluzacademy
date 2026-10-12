import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Evoluz Academy · Training Hub',
    short_name: 'Evoluz Academy',
    description: 'Training management for Evoluz.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f7f9fc',
    theme_color: '#253f9b',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' }],
  };
}
