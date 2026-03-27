pipeline {
    agent any

    options {
        timeout(time: 4, unit: 'HOURS')
        disableConcurrentBuilds()
        ansiColor('xterm')
    }

    parameters {
        string(name: 'RELEASE_BRANCH', defaultValue: 'release/2.4.0', description: 'The release branch tag (e.g., release/2.4.0)')
        choice(name: 'STG_ENV', choices: ['stg1', 'stg2', 'stg3', 'stg4', 'stg5', 'stg6', 'stg7', 'stg8', 'stg9', 'stg10', 'uat1', 'uat2'], description: 'Select the target staging environment for deployment')
        text(name: 'JOBS_TO_RELEASE', defaultValue: '', description: 'List of job names (one per line) that should use the RELEASE_BRANCH. All others default to master.')
        text(name: 'LIBS_TO_DEPLOY', defaultValue: '', description: 'Selection for Deploy-Libs (passed as parameter to the job)')
        string(name: 'NOTIFY_EMAIL', defaultValue: 'qa-team@example.com', description: 'Comma-separated emails for the final report')
        string(name: 'GCHAT_WEBHOOK_URL', defaultValue: '', description: 'Google Chat Webhook URL (if not using credentials)')
        booleanParam(name: 'DRY_RUN', defaultValue: false, description: 'If true, logs actions instead of triggering jobs')
    }

    environment {
        DEPLOY_RESULTS = "" // Will store results in a serialized-friendly way
    }

    stages {
        stage('Initialize & Load Manifest') {
            steps {
                script {
                    echo "--- Initializing QA Release Pipeline ---"
                    echo "Release Branch: ${params.RELEASE_BRANCH}"
                    
                    // Load jobs from YAML (Now in root of the unified repo)
                    def manifest = readYaml file: 'jobs.yaml'
                    dest_jobs = manifest.jobs
                    
                    // Parse jobs to release into a list for easy lookup (supports comma or newline)
                    release_jobs_list = params.JOBS_TO_RELEASE.split(/[,\n]/).collect { it.trim() }.findAll { it }
                    
                    results = [] // List to store Result objects
                }
            }
        }

        stage('Execute Deployments') {
            steps {
                script {
                    dest_jobs.each { jobMeta ->
                        def jobDisplayName = jobMeta.name
                        def jenkinsJobName = jobMeta.jenkins_job
                        
                        // 1. Resolve Branch
                        def branchToUse = "master"
                        if (release_jobs_list.contains(jobDisplayName) && params.RELEASE_BRANCH) {
                            branchToUse = params.RELEASE_BRANCH
                        }
                        
                        echo "Processing Job: ${jobDisplayName} (Branch: ${branchToUse})"

                        // 2. Handle Multi-Run Logic based on fe_type
                        if (jobMeta.fe_type == 'standard') {
                            // Standard FE: website then msite
                            executeJob(jobDisplayName, jenkinsJobName, branchToUse, 'website', null, jobMeta)
                            executeJob(jobDisplayName, jenkinsJobName, branchToUse, 'msite', null, jobMeta)
                        } else if (jobMeta.fe_type == 'special') {
                            // Special FE (Merge-FE): predefined sequence
                            jobMeta.runs.each { run ->
                                executeJob(jobDisplayName, jenkinsJobName, branchToUse, run.deploy_type, run.domain, jobMeta)
                            }
                        } else {
                            // Backend / Orion / Generic (Single Run)
                            executeJob(jobDisplayName, jenkinsJobName, branchToUse, null, null, jobMeta)
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
    def durationStr = "0s"
    
    def jobParams = [
        string(name: 'BRANCH', value: branch),
        string(name: 'Env', value: params.STG_ENV) // Propagate selected environment
    ]
    
    // Add specific params if provided
    if (deployType) jobParams.add(string(name: 'DEPLOY_TYPE', value: deployType))
    if (domain) jobParams.add(string(name: 'DOMAIN', value: domain))
    
    // Special handling for Deploy-Libs
    if (meta.has_libs_param && params.LIBS_TO_DEPLOY) {
        jobParams.add(text(name: 'LIBS_TO_DEPLOY', value: params.LIBS_TO_DEPLOY))
    }

    echo ">>> Triggering ${jobName} | Branch: ${branch} | Type: ${deployType ?: 'N/A'} | Domain: ${domain ?: 'N/A'}"
    
    try {
        if (params.DRY_RUN) {
            echo "[DRY RUN] Would trigger ${jobName} with params ${jobParams}"
            sleep 1
        } else {
            // catchError allows us to mark the build result but continue execution
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
    durationStr = formatDuration(endTime - startTime)
    
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
    def title = "QA Release Deploy — ${params.RELEASE_BRANCH}"

    // 1. Google Chat Report (JSON Card)
    if (params.GCHAT_WEBHOOK_URL) {
        def cardJson = [
            cards: [[
                header: [ title: title, subtitle: summary ],
                sections: [[
                    widgets: results.collect { r ->
                        [ textParagraph: [ text: "<b>${r.name}</b> (${r.branch})<br>Type: ${r.type} | Domain: ${r.domain}<br>Status: <font color=\"${r.status == 'SUCCESS' ? '#2ecc71' : '#e74c3c'}\">${r.status}</font> | Dur: ${r.duration}" ] ]
                    }
                ]]
            ]]
        ]
        
        try {
            httpRequest url: params.GCHAT_WEBHOOK_URL,
                        httpMode: 'POST',
                        contentType: 'APPLICATION_JSON',
                        requestBody: groovy.json.JsonOutput.toJson(cardJson)
        } catch (e) {
            echo "Failed to send GChat notification: ${e.message}"
        }
    }

    // 2. Email Report (HTML)
    if (params.NOTIFY_EMAIL) {
        def htmlBody = """
        <html>
        <head>
            <style>
                table { border-collapse: collapse; width: 100%; font-family: sans-serif; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f2f2f2; }
                .success { background-color: #d4edda; color: #155724; font-weight: bold; }
                .failed { background-color: #f8d7da; color: #721c24; font-weight: bold; }
                .header { font-size: 18px; margin-bottom: 10px; }
            </style>
        </head>
        <body>
            <div class="header"><b>${title}</b></div>
            <div>${summary}</div>
            <br>
            <table>
                <tr>
                    <th>Job Name</th>
                    <th>Branch</th>
                    <th>Type</th>
                    <th>Domain</th>
                    <th>Status</th>
                    <th>Duration</th>
                </tr>
                ${results.collect { r ->
                    """
                    <tr>
                        <td>${r.name}</td>
                        <td>${r.branch}</td>
                        <td>${r.type}</td>
                        <td>${r.domain}</td>
                        <td class="${r.status == 'SUCCESS' ? 'success' : 'failed'}">${r.status}</td>
                        <td>${r.duration}</td>
                    </tr>
                    """
                }.join('')}
            </table>
            <br>
            <p>View full build details: <a href="${env.BUILD_URL}">${env.BUILD_URL}</a></p>
        </body>
        </html>
        """

        emailext body: htmlBody,
                 subject: "[QA Deploy] ${params.RELEASE_BRANCH} — ${successCount}/${results.size()} succeeded",
                 to: params.NOTIFY_EMAIL,
                 mimeType: 'text/html'
    }
}
