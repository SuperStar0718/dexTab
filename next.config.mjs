/** @type {import('next').NextConfig} */
const nextConfig = {
    webpack: (config) => {
        config.externals = [
            ...(config.externals || []),
            'bigint',
            'node-gyp-build',
        ];
        return config;
    },
};

export default nextConfig;
