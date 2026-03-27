const express = require('express');
const router = express.Router();
const { fetchAllDeployments, fetchBuildHistory, triggerJob, fetchReleaseStatus, fetchJobLogs, abortJob } = require('../services/jenkinsService');
const { checkServerStatus } = require('../services/serverStatusService');
const config = require('../jobs.config');

// GET /api/deployments
// Returns flat array — one record per (job × environment).
// Frontend groups by environment to build the STG tabs.
router.get('/deployments', async (req, res) => {
  try {
    const data = await fetchAllDeployments();
    res.json(data);
  } catch (err) {
    console.error('GET /api/deployments error:', err);
    res.status(500).json({ error: 'Failed to fetch from Jenkins' });
  }
});

// GET /api/history/:job
// Last N builds for a job — used by the history modal.
router.get('/history/:job', async (req, res) => {
  try {
    const history = await fetchBuildHistory(req.params.job);
    res.json({ job: req.params.job, history });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// GET /api/server-status
// Checks health of configured backend services
router.get('/server-status', async (req, res) => {
  try {
    const { env } = req.query;
    const status = await checkServerStatus(env);
    res.json(status);
  } catch (err) {
    console.error('GET /api/server-status error:', err);
    res.status(500).json({ error: 'Failed to fetch server status' });
  }
});

// GET /api/jobs — configured job list (no Jenkins call)
router.get('/jobs', (req, res) => res.json({ jobs: config.JOBS }));

// POST /api/trigger-release
router.post('/trigger-release', async (req, res) => {
  try {
    const { branch, env, jobsToRelease, libsToDeploy, dryRun } = req.body;
    
    if (!branch || !env) {
      return res.status(400).json({ error: 'Branch and Environment are required' });
    }

    const params = {
      RELEASE_BRANCH: branch,
      STG_ENV: env, // Matching Jenkins Parameter name
      JOBS_TO_RELEASE: (jobsToRelease || []).join(','),
      LIBS_TO_DEPLOY: (libsToDeploy || []).join(','), // New library parameter
      DRY_RUN: String(!!dryRun)
    };

    const result = await triggerJob('QA-Release-Deployment', params);
    res.json({ success: true, message: 'Release triggered successfully', ...result });
  } catch (err) {
    console.error('POST /api/trigger-release error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/release-logs?start=0
router.get('/release-logs', async (req, res) => {
  try {
    const start = req.query.start || 0;
    const logs = await fetchJobLogs('QA-Release-Deployment', start);
    res.json(logs);
  } catch (err) {
    console.error('GET /api/release-logs error:', err);
    res.status(500).json({ error: 'Failed to fetch release logs' });
  }
});

// POST /api/abort-release
router.post('/abort-release', async (req, res) => {
  try {
    const result = await abortJob('QA-Release-Deployment');
    res.json(result);
  } catch (err) {
    console.error('POST /api/abort-release error:', err);
    res.status(500).json({ error: 'Failed to abort release' });
  }
});

// GET /api/release-status
router.get('/release-status', async (req, res) => {
  try {
    const status = await fetchReleaseStatus();
    res.json(status);
  } catch (err) {
    console.error('GET /api/release-status error:', err);
    res.status(500).json({ error: 'Failed to fetch release status' });
  }
});

// GET /api/config — public safe config
router.get('/config', (req, res) => res.json({
  jenkinsBaseUrl: config.JENKINS_BASE_URL,
  jobs: config.JOBS,
  authConfigured: !!(config.JENKINS_USER && config.JENKINS_TOKEN),
}));

module.exports = router;
