pipeline {
    agent any

    options {
        timeout(time: 4, unit: 'HOURS')
        disableConcurrentBuilds()
        ansiColor('xterm')
    }

    environment {
        DEPLOY_RESULTS = "" 
    }

    stages {
        stage('Initialize & Load Manifest') {
            steps {
                script {
                    echo "--- Initializing QA Release Pipeline ---"
                    // Use env. instead of params. since we removed the explicit parameters block
                    def targetEnv = env.STG_ENV ?: "stg1"
                    def releaseBranch = env.RELEASE_BRANCH ?: "master"
                    
                    echo "Target Environment: ${targetEnv}"
                    echo "Release Branch: ${releaseBranch}"
                    
                    // Load jobs from YAML
                    def manifest = readYaml file: 'jobs.yaml'
                    dest_jobs = manifest.jobs
                    
                    // Parse jobs to release supports comma or newline
                    def rawJobs = env.JOBS_TO_RELEASE ?: ""
                    release_jobs_list = rawJobs.split(/[,\n]/).collect { it.trim() }.findAll { it }
                    
                    echo "Jobs selected for release: ${release_jobs_list}"
                    
                    results = [] 
                }
            }
        }

        stage('Execute Deployments') {
            steps {
                script {
                    dest_jobs.each { jobMeta ->
                        def jobDisplayName = jobMeta.name
                        def jenkinsJobName = jobMeta.jenkins_job
                        def releaseBranch = env.RELEASE_BRANCH ?: "master"
                        
                        // ONLY trigger if selected
                        if (!release_jobs_list.contains(jobDisplayName)) {
                            echo "Skipping ${jobDisplayName} (not selected)"
                            results.add([
                                name: jobDisplayName,
                                branch: "-",
                                type: "-",
                                domain: "-",
                                status: "SKIPPED",
                                duration: "0s"
                            ])
                            return
                        }
                        
                        echo "Processing Job: ${jobDisplayName} (Branch: ${releaseBranch})"

                        if (jobMeta.fe_type == 'standard') {
                            executeJob(jobDisplayName, jenkinsJobName, releaseBranch, 'website', null, jobMeta)
                            executeJob(jobDisplayName, jenkinsJobName, releaseBranch, 'msite', null, jobMeta)
                        } else if (jobMeta.fe_type == 'special') {
                            jobMeta.runs.each { run ->
                                executeJob(jobDisplayName, jenkinsJobName, releaseBranch, run.deploy_type, run.domain, jobMeta)
                            }
                        } else {
                            executeJob(jobDisplayName, jenkinsJobName, releaseBranch, null, null, jobMeta)
                        }
                    }
                }
            }
        }

        stage('Final Reporting') {
            steps {
                script {
                    generateAndSendReports()
                }
            }
        }
    }
}

/**
 * Executes a Jenkins job with parameters and tracks results.
 */
def executeJob(displayName, jobName, branch, deployType, domain, meta) {
    def startTime = System.currentTimeMillis()
    def status = "SUCCESS"
    def targetEnv = env.STG_ENV ?: "stg1"
    def dryRun = env.DRY_RUN == "true"
    
    def jobParams = [
        string(name: 'BRANCH', value: branch),
        string(name: 'Env', value: targetEnv)
    ]
    
    if (deployType) jobParams.add(string(name: 'DEPLOY_TYPE', value: deployType))
    if (domain) jobParams.add(string(name: 'DOMAIN', value: domain))
    
    if (meta.has_libs_param && env.LIBS_TO_DEPLOY) {
        jobParams.add(text(name: 'LIBS_TO_DEPLOY', value: env.LIBS_TO_DEPLOY))
    }

    echo ">>> Triggering ${jobName} | Branch: ${branch} | Env: ${targetEnv} | Type: ${deployType ?: 'N/A'}"
    
    try {
        if (dryRun) {
            echo "[DRY RUN] Would trigger ${jobName} with params ${jobParams}"
            sleep 1
        } else {
            catchError(buildResult: 'SUCCESS', stageResult: 'FAILURE') {
                def jobBuild = build job: jobName, parameters: jobParams, wait: true, propagate: false
                status = jobBuild.result
            }
        }
    } catch (Exception e) {
        echo "Error triggering job ${jobName}: ${e.message}"
        status = "FAILED"
    }

    def endTime = System.currentTimeMillis()
    def durationStr = formatDuration(endTime - startTime)
    
    results.add([
        name: displayName,
        branch: branch,
        type: deployType ?: "-",
        domain: domain ?: "-",
        status: status,
        duration: durationStr
    ])
}

def formatDuration(ms) {
    def seconds = (ms / 1000) as Integer
    if (seconds < 60) return "${seconds}s"
    def minutes = (seconds / 60) as Integer
    def remSeconds = seconds % 60
    return "${minutes}m ${remSeconds}s"
}

def generateAndSendReports() {
    def successCount = results.count { it.status == 'SUCCESS' }
    def failCount = results.size() - successCount
    def summary = "${successCount} / ${results.size()} runs succeeded | ${failCount} failed"
    def releaseBranch = env.RELEASE_BRANCH ?: "master"
    def title = "QA Release Deploy — ${releaseBranch}"

    if (env.GCHAT_WEBHOOK_URL) {
        def cardJson = [
            cards: [[
                header: [ title: title, subtitle: summary ],
                sections: [[
                    widgets: results.collect { r ->
                        [ textParagraph: [ text: "<b>${r.name}</b> (${r.branch})<br>Type: ${r.type} | Status: <font color=\"${r.status == 'SUCCESS' ? '#2ecc71' : '#e74c3c'}\">${r.status}</font>" ] ]
                    }
                ]]
            ]]
        ]
        try {
            httpRequest url: env.GCHAT_WEBHOOK_URL,
                        httpMode: 'POST',
                        contentType: 'APPLICATION_JSON',
                        requestBody: groovy.json.JsonOutput.toJson(cardJson)
        } catch (e) {
            echo "Failed to send GChat notification: ${e.message}"
        }
    }

    if (env.NOTIFY_EMAIL) {
        def htmlBody = """
        <html>
        <body>
            <div style="font-size: 18px;"><b>${title}</b></div>
            <div>${summary}</div>
            <br>
            <table border="1" cellpadding="8" style="border-collapse: collapse; width: 100%;">
                <tr style="background: #f2f2f2;">
                    <th>Job Name</th><th>Branch</th><th>Type</th><th>Status</th><th>Duration</th>
                </tr>
                ${results.collect { r ->
                    """
                    <tr>
                        <td>${r.name}</td><td>${r.branch}</td><td>${r.type}</td>
                        <td style="color: ${r.status == 'SUCCESS' ? 'green' : 'red'}; font-weight: bold;">${r.status}</td>
                        <td>${r.duration}</td>
                    </tr>
                    """
                }.join('')}
            </table>
        </body>
        </html>
        """
        emailext body: htmlBody,
                 subject: "[QA Deploy] ${releaseBranch} — ${summary}",
                 to: env.NOTIFY_EMAIL,
                 mimeType: 'text/html'
    }
}
