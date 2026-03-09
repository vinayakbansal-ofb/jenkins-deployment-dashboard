/**
 * OASYS Jenkins Dashboard Configuration
 * ─────────────────────────────────────
 * Edit this file to add/remove Jenkins jobs from the dashboard.
 */

module.exports = {
    // Jenkins base URL (no trailing slash)
    JENKINS_BASE_URL: 'https://stg-jenkins.ofbusiness.co.in',

    // Jenkins credentials — set via environment variables for security.
    // Generate a token: Jenkins → User → Configure → API Token → Add new token
    // Then run: JENKINS_USER=myuser JENKINS_TOKEN=mytoken node index.js
    JENKINS_USER: process.env.JENKINS_USER || '',
    JENKINS_TOKEN: process.env.JENKINS_TOKEN || '',

    // Number of past builds to fetch for history view
    HISTORY_DEPTH: 20,

    // Jobs to track — add or remove job names here freely
    JOBS: [
        'ofb-compile-deploy21',
        'OASYS-FE',
        'OASYS-TS',
        'OFB-ADMIN',
        'MERGE-FE',
        'informer-compile21',
        'informer-deploy21',
        'ofb-schduler-compile21',
        'ofb-schduler-deploy21',
        'orion-compile21',
        'orion-deploy21',
        'orion-compile-deploy21',
        'fs-compile21',
        'fs-deploy21',
        'Supplier-FE',
        'BUYER-FE',
    ],

    // Build parameter names your Jenkins jobs use to pass the target environment.
    // The service will try each name and use the first match found.
    // Real parameter found in OASYS Jenkins: 'Env' with values like 'ofb_stg6'
    ENV_PARAM_NAMES: ['Env', 'ENV', 'ENVIRONMENT', 'env', 'environment', 'STG_ENV', 'staging_env', 'TARGET_ENV'],

    // Build parameter names used for branch (in parameterised builds)
    // Real parameter found in OASYS Jenkins: 'branchName'
    BRANCH_PARAM_NAMES: ['branchName', 'BRANCH', 'branch', 'BRANCH_NAME', 'GIT_BRANCH', 'git_branch'],

};
