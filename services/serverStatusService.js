const fetch = require('node-fetch');
const config = require('../jobs.config');

/**
 * Checks the status of backend services for a specific environment.
 * @param {string} env - The environment name (e.g., 'stg3', 'uat1').
 */
const checkServerStatus = async (env) => {
    if (!env || env === 'all') return [];

    const monitoringTasks = config.SERVICES_CONFIG.map(async (service) => {
        const start = Date.now();
        let status = 'DOWN';
        let responseTime = '0ms';
        let branch = null;

        // Generate URL based on service type and environment
        let url = '';
        const lowerEnv = env.toLowerCase();

        if (service.type === 'template') {
            url = service.template.replace('{env}', lowerEnv).replace('{path}', service.path);
        } else if (service.type === 'ip_based') {
            const ip = config.ENV_IPS[lowerEnv];
            if (ip) {
                url = `http://${ip}:${service.port}${service.path}`;
            } else {
                return { service: service.name, environment: env.toUpperCase(), status: 'UNKNOWN', responseTime: '0ms', branch: null, lastChecked: new Date().toISOString(), error: 'No IP for env' };
            }
        } else if (service.type === 'orion') {
            const host = config.ORION_HOST_TEMPLATE.replace('{env}', lowerEnv);
            url = `https://${host}${service.path}`;
        } else if (service.type === 'orion_fs') {
            const host = config.ORION_FS_HOST_TEMPLATE.replace('{env}', lowerEnv);
            url = `https://${host}${service.path}`;
        }

        try {
            const res = await fetch(url, {
                headers: {
                    'Accept': 'application/json',
                    ...(service.headers || {})
                },
                timeout: 5000
            });

            const end = Date.now();
            const diff = end - start;
            responseTime = `${diff}ms`;

            if (res.ok) {
                status = 'UP';
                try {
                    const data = await res.json();
                    branch = data.branch || data.release || data.version || null;
                } catch (e) {
                    // Not a JSON response or no branch info
                }

                if (diff > 2000) {
                    status = 'UP_SLOW';
                }
            }
        } catch (err) {
            console.error(`[ServerStatus] Error checking ${service.name} for ${env} at ${url}: ${err.message}`);
            status = 'DOWN';
        }

        return {
            service: service.name,
            environment: env.toUpperCase(),
            status: status,
            responseTime: responseTime,
            branch: branch,
            lastChecked: new Date().toISOString()
        };
    });

    return Promise.all(monitoringTasks);
};

module.exports = { checkServerStatus };
