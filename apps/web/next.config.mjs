const apiOrigin = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api").replace(/\/api\/?$/, "");

const { protocol, hostname, port } = new URL(apiOrigin);

const nextConfig = {
  typedRoutes: true,

  async rewrites() {
    return [
      {
        source: "/uploads/:path*",
        destination: `${apiOrigin}/uploads/:path*`
      }
    ];
  },

  images: {
    remotePatterns: [
      {
        protocol: protocol.replace(":", ""),
        hostname,
        ...(port ? { port } : {}),
        pathname: "/uploads/**"
      }
    ]
  }
};

export default nextConfig;
