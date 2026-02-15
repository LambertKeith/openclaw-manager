pipeline {
    agent any

    environment {
        // Docker 镜像仓库配置
        REGISTRY = "uhub.service.ucloud.cn"
        API_IMAGE_NAME = "uhub.service.ucloud.cn/pardx/clawbot-api"
        WEB_IMAGE_NAME = "uhub.service.ucloud.cn/pardx/clawbot-web"
        BOTENV_IMAGE_NAME = "uhub.service.ucloud.cn/pardx/clawbot-env"

        // 镜像标签
        TAG_NAME = "${new Date().format('yyyyMMdd-HHmm')}"
        LATEST_TAG_NAME = "latest"

        // 容器名称
        API_CONTAINER_NAME = "clawbot-api"
        WEB_CONTAINER_NAME = "clawbot-web"

        // 构建参数
        BASE_NODE_IMAGE = 'node:24.1-slim'
        NPM_REGISTRY = 'https://registry.npmmirror.com'
    }

    options {
        // 保留最近 10 次构建记录
        buildDiscarder(logRotator(numToKeepStr: '10'))
        // 构建超时时间
        timeout(time: 60, unit: 'MINUTES')
        // 禁用并发构建
        disableConcurrentBuilds()
    }

    stages {
        stage('拉取代码') {
            steps {
                echo '检出代码...'
                checkout scm
            }
        }

        stage('拉取代码') {
            steps {
                echo '检出代码...'
                checkout scm
            }
        }

        stage('构建 API 镜像') {
            steps {
                script {
                    echo '构建 API 镜像...'
                    apiImage = docker.build(
                        "${API_IMAGE_NAME}:${TAG_NAME}",
                        "--target api " +
                        "--build-arg BASE_NODE_IMAGE=${BASE_NODE_IMAGE} " +
                        "--build-arg NPM_REGISTRY=${NPM_REGISTRY} " +
                        "--network host " +
                        "-f Dockerfile ."
                    )
                }
            }
        }

        stage('构建 Web 镜像') {
            steps {
                script {
                    echo '构建 Web 镜像...'
                    webImage = docker.build(
                        "${WEB_IMAGE_NAME}:${TAG_NAME}",
                        "--target web " +
                        "--build-arg BASE_NODE_IMAGE=${BASE_NODE_IMAGE} " +
                        "--build-arg NPM_REGISTRY=${NPM_REGISTRY} " +
                        "--network host " +
                        "-f Dockerfile ."
                    )
                }
            }
        }

        stage('构建 BotEnv 镜像') {
            when {
                expression { params.BUILD_BOTENV == true }
            }
            steps {
                script {
                    echo '构建 BotEnv 镜像...'
                    botenvImage = docker.build(
                        "${BOTENV_IMAGE_NAME}:${TAG_NAME}",
                        "-f Dockerfile.botenv ."
                    )
                }
            }
        }

        stage('推送 Docker 镜像') {
            steps {
                script {
                    echo '推送镜像到 UCloud 镜像仓库...'
                    docker.withRegistry("https://${REGISTRY}", "ucloud-docker") {
                        // 推送 API 镜像
                        apiImage.push()
                        apiImage.push("${LATEST_TAG_NAME}")

                        // 推送 Web 镜像
                        webImage.push()
                        webImage.push("${LATEST_TAG_NAME}")

                        // 推送 BotEnv 镜像（如果构建了）
                        if (params.BUILD_BOTENV) {
                            botenvImage.push()
                            botenvImage.push("${LATEST_TAG_NAME}")
                        }
                    }
                }
            }
        }

        stage('SSH 服务器重新发布') {
            steps {
                script {
                    echo '连接服务器并重新部署...'
                    def remote = [:]
                    remote.name = 'pardxai-03'
                    remote.host = '14.103.218.99'
                    remote.port = 22
                    remote.allowAnyHosts = true

                    withCredentials([usernamePassword(credentialsId: 'ecs-ubuntu-pardxai-03-platform', usernameVariable: 'SSH_USER', passwordVariable: 'SSH_PASS')]) {
                        remote.user = "${SSH_USER}"
                        remote.password = "${SSH_PASS}"
                    }

                    // 拉取最新镜像并重启服务
                    sshCommand remote: remote, command: """
                        cd ~/www/clawbot-deploy && \
                        sudo docker compose pull ${API_CONTAINER_NAME} ${WEB_CONTAINER_NAME} && \
                        sudo docker compose up -d ${API_CONTAINER_NAME} ${WEB_CONTAINER_NAME} --force-recreate
                    """
                }
            }
        }

        stage('健康检查') {
            steps {
                script {
                    echo '等待服务启动并进行健康检查...'
                    def remote = [:]
                    remote.name = 'pardxai-03'
                    remote.host = '14.103.218.99'
                    remote.port = 22
                    remote.allowAnyHosts = true

                    withCredentials([usernamePassword(credentialsId: 'ecs-ubuntu-pardxai-03-platform', usernameVariable: 'SSH_USER', passwordVariable: 'SSH_PASS')]) {
                        remote.user = "${SSH_USER}"
                        remote.password = "${SSH_PASS}"
                    }

                    // 检查容器状态
                    sshCommand remote: remote, command: """
                        cd ~/www/clawbot-deploy && \
                        sudo docker compose ps ${API_CONTAINER_NAME} ${WEB_CONTAINER_NAME}
                    """
                }
            }
        }
    }

    post {
        success {
            echo '部署成功！'
            script {
                def remote = [:]
                remote.name = 'pardxai-03'
                remote.host = '14.103.218.99'
                remote.port = 22
                remote.allowAnyHosts = true

                withCredentials([usernamePassword(credentialsId: 'ecs-ubuntu-pardxai-03-platform', usernameVariable: 'SSH_USER', passwordVariable: 'SSH_PASS')]) {
                    remote.user = "${SSH_USER}"
                    remote.password = "${SSH_PASS}"
                }

                sshCommand remote: remote, command: "cd ~/www/clawbot-deploy && sudo docker compose ps"
            }
        }

        failure {
            echo '部署失败！'
            script {
                def remote = [:]
                remote.name = 'pardxai-03'
                remote.host = '14.103.218.99'
                remote.port = 22
                remote.allowAnyHosts = true

                withCredentials([usernamePassword(credentialsId: 'ecs-ubuntu-pardxai-03-platform', usernameVariable: 'SSH_USER', passwordVariable: 'SSH_PASS')]) {
                    remote.user = "${SSH_USER}"
                    remote.password = "${SSH_PASS}"
                }

                sshCommand remote: remote, command: "cd ~/www/clawbot-deploy && sudo docker compose logs --tail=100"
            }
        }

        always {
            echo '清理本地构建缓存...'
            sh 'docker image prune -f --filter "dangling=true" || true'
        }
    }

    // 构建参数
    parameters {
        booleanParam(
            name: 'BUILD_BOTENV',
            defaultValue: false,
            description: '是否构建 BotEnv 镜像'
        )
    }
}
