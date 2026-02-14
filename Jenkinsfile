pipeline {
    agent any

    environment {
        // Docker 镜像名称
        API_IMAGE = 'clawbot-api:latest'
        WEB_IMAGE = 'clawbot-web:latest'
        BOTENV_IMAGE = 'clawbot-env:latest'

        // Docker Compose 项目名称
        COMPOSE_PROJECT_NAME = 'clawbot-manager'

        // 构建参数（可在 .env 中配置）
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
        stage('环境检查') {
            steps {
                script {
                    echo '检查 Docker 和 Docker Compose 环境...'
                    sh 'docker --version'
                    sh 'docker compose version'
                    sh 'pnpm --version || echo "pnpm not found in Jenkins agent"'
                }
            }
        }

        stage('代码检出') {
            steps {
                echo '检出代码...'
                checkout scm
            }
        }

        stage('环境准备') {
            steps {
                script {
                    echo '检查必要的配置文件...'
                    // 检查必要的配置文件是否存在
                    sh '''
                        if [ ! -f apps/api/.env ]; then
                            echo "错误: apps/api/.env 文件不存在"
                            exit 1
                        fi
                        if [ ! -f apps/api/config.local.yaml ]; then
                            echo "错误: apps/api/config.local.yaml 文件不存在"
                            exit 1
                        fi
                        echo "配置文件检查通过"
                    '''

                    // 创建 Docker 网络（如果不存在）
                    sh '''
                        docker network inspect common_network >/dev/null 2>&1 || \
                        docker network create common_network
                    '''
                }
            }
        }

        stage('构建镜像') {
            parallel {
                stage('构建 API 镜像') {
                    steps {
                        script {
                            echo '构建 API 镜像...'
                            sh """
                                docker build \
                                    --target api \
                                    --build-arg BASE_NODE_IMAGE=${BASE_NODE_IMAGE} \
                                    --build-arg NPM_REGISTRY=${NPM_REGISTRY} \
                                    --network host \
                                    -t ${API_IMAGE} \
                                    -f Dockerfile .
                            """
                        }
                    }
                }

                stage('构建 Web 镜像') {
                    steps {
                        script {
                            echo '构建 Web 镜像...'
                            sh """
                                docker build \
                                    --target web \
                                    --build-arg BASE_NODE_IMAGE=${BASE_NODE_IMAGE} \
                                    --build-arg NPM_REGISTRY=${NPM_REGISTRY} \
                                    --network host \
                                    -t ${WEB_IMAGE} \
                                    -f Dockerfile .
                            """
                        }
                    }
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
                    sh """
                        docker compose --profile build build botenv
                    """
                }
            }
        }

        stage('停止旧容器') {
            steps {
                script {
                    echo '停止并移除旧容器...'
                    sh '''
                        docker compose down || true
                    '''
                }
            }
        }

        stage('数据库迁移') {
            steps {
                script {
                    echo '执行数据库迁移...'
                    sh '''
                        # 临时启动 API 容器执行迁移
                        docker compose run --rm api sh -c "cd /app/apps/api && npx prisma migrate deploy"
                    '''
                }
            }
        }

        stage('启动服务') {
            steps {
                script {
                    echo '启动服务...'
                    sh '''
                        docker compose up -d api web
                    '''
                }
            }
        }

        stage('健康检查') {
            steps {
                script {
                    echo '等待服务启动并进行健康检查...'
                    sh '''
                        # 等待 API 服务健康
                        timeout 120 sh -c 'until docker compose ps api | grep -q "healthy"; do
                            echo "等待 API 服务启动..."
                            sleep 5
                        done'

                        # 等待 Web 服务健康
                        timeout 120 sh -c 'until docker compose ps web | grep -q "healthy"; do
                            echo "等待 Web 服务启动..."
                            sleep 5
                        done'

                        echo "所有服务已成功启动"
                    '''
                }
            }
        }

        stage('清理旧镜像') {
            steps {
                script {
                    echo '清理未使用的 Docker 镜像...'
                    sh '''
                        docker image prune -f --filter "dangling=true"
                    '''
                }
            }
        }
    }

    post {
        success {
            echo '部署成功！'
            script {
                sh 'docker compose ps'
            }
        }

        failure {
            echo '部署失败！'
            script {
                sh 'docker compose logs --tail=100'
            }
        }

        always {
            echo '清理工作空间...'
            cleanWs(
                deleteDirs: true,
                patterns: [
                    [pattern: 'node_modules', type: 'INCLUDE'],
                    [pattern: '.next', type: 'INCLUDE'],
                    [pattern: 'dist', type: 'INCLUDE']
                ]
            )
        }
    }

    // 构建参数
    parameters {
        booleanParam(
            name: 'BUILD_BOTENV',
            defaultValue: false,
            description: '是否构建 BotEnv 镜像'
        )
        choice(
            name: 'NPM_REGISTRY',
            choices: [
                'https://registry.npmmirror.com',
                'https://registry.npmjs.org'
            ],
            description: 'NPM 镜像源'
        )
    }
}
