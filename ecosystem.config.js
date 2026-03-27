module.exports = {
  apps: [
    {
      name: 'jenkins-dashboard',
      script: 'index.js',
      env: {
        PORT: 5001,

        // Set these via prompt or shell variables on the server
        JENKINS_USER: process.env.JENKINS_USER || 'SET_ON_SERVER',
        JENKINS_TOKEN: process.env.JENKINS_TOKEN || 'SET_ON_SERVER'
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G'
    }
  ]
};
