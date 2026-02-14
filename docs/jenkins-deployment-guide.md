# Jenkins 部署指南

本文档介绍如何使用 Jenkins 在局域网服务器上部署 ClawBot Manager 项目。

## 前置要求

### 服务器环境

1. **操作系统**: Linux (推荐 Ubuntu 20.04+ 或 CentOS 7+)
2. **Docker**: 20.10+
3. **Docker Compose**: 2.0+
4. **Jenkins**: 2.400+ (LTS 版本)
5. **Git**: 2.0+

### 外部依赖服务

项目需要以下外部服务（需提前部署）：

- **PostgreSQL**: 12+ (用于应用数据存储)
- **Redis**: 6+ (用于缓存和会话管理)

## 一、Jenkins 服务器配置

### 1.1 安装 Jenkins

```bash
# Ubuntu/Debian
wget -q -O - https://pkg.jenkins.io/debian-stable/jenkins.io.key | sudo apt-key add -
sudo sh -c 'echo deb https://pkg.jenkins.io/debian-stable binary/ > /etc/apt/sources.list.d/jenkins.list'
sudo apt update
sudo apt install jenkins

# CentOS/RHEL
sudo wget -O /etc/yum.repos.d/jenkins.repo https://pkg.jenkins.io/redhat-stable/jenkins.repo
sudo rpm --import https://pkg.jenkins.io/redhat-stable/jenkins.io.key
sudo yum install jenkins
```

### 1.2 安装 Docker

```bash
# Ubuntu/Debian
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 将 jenkins 用户添加到 docker 组
sudo usermod -aG docker jenkins

# 重启 Jenkins 服务
sudo systemctl restart jenkins
```

### 1.3 配置 Jenkins 权限

```bash
# 确保 Jenkins 用户可以访问 Docker socket
sudo chmod 666 /var/run/docker.sock

# 或者更安全的方式：将 jenkins 用户添加到 docker 组
sudo usermod -aG docker jenkins
sudo systemctl restart jenkins
```

## 二、Jenkins 项目配置

### 2.1 创建 Jenkins Pipeline 项目

1. 登录 Jenkins Web 界面
2. 点击 "新建任务"
3. 输入项目名称（如 `clawbot-manager`）
4. 选择 "Pipeline" 类型
5. 点击 "确定"

### 2.2 配置 Git 仓库

在项目配置页面：

1. **Pipeline** 部分选择 "Pipeline script from SCM"
2. **SCM** 选择 "Git"
3. **Repository URL** 填写您的 Git 仓库地址
   - 如果是局域网 GitLab: `http://your-gitlab-server/your-group/openclaw-manager.git`
   - 如果是 GitHub: `https://github.com/your-org/openclaw-manager.git`
4. **Credentials** 添加 Git 访问凭证
5. **Branch Specifier** 填写分支名（如 `*/main` 或 `*/dev`）
6. **Script Path** 填写 `Jenkinsfile`

### 2.3 配置构建触发器

根据需求选择：

- **定时构建**: 使用 Cron 表达式（如 `H 2 * * *` 每天凌晨 2 点）
- **轮询 SCM**: 定期检查代码变更（如 `H/5 * * * *` 每 5 分钟检查一次）
- **Webhook 触发**: 配置 Git 仓库的 Webhook（推荐）

#### 配置 GitLab Webhook（推荐）

1. 在 Jenkins 安装 "GitLab Plugin"
2. 在项目配置中勾选 "Build when a change is pushed to GitLab"
3. 复制生成的 Webhook URL
4. 在 GitLab 项目设置中添加 Webhook

## 三、环境配置

### 3.1 准备配置文件

在服务器上创建必要的配置文件：

```bash
# 创建项目目录
sudo mkdir -p /opt/clawbot-manager
cd /opt/clawbot-manager

# 克隆代码（首次）
git clone <your-repo-url> .

# 创建 API 配置文件
cp apps/api/.env.example apps/api/.env
cp apps/api/config.example.yaml apps/api/config.local.yaml

# 创建 Web 配置文件
cp apps/web/.env.example apps/web/.env.local

# 创建根目录 .env 文件
cat > .env << 'EOF'
# Docker 配置
DOCKER_PLATFORM=linux/amd64
BASE_NODE_IMAGE=node:24.1-slim
NPM_REGISTRY=https://registry.npmmirror.com

# 端口配置
API_PORT=13100
WEB_PORT=13000

# 数据库配置
DATABASE_URL=postgresql://user:password@localhost:5432/clawbot

# Redis 配置
REDIS_URL=redis://localhost:6379

# 环境
NODE_ENV=production
EOF
```

### 3.2 编辑配置文件

#### apps/api/.env

```env
# 数据库连接
DATABASE_URL=postgresql://user:password@your-postgres-host:5432/clawbot

# Redis 连接
REDIS_URL=redis://your-redis-host:6379

# JWT 密钥（请修改为随机字符串）
JWT_SECRET=your-random-secret-key-here

# API 端口
PORT=3200
```

#### apps/api/config.local.yaml

根据项目需求配置 AI 服务、存储等参数。

#### apps/web/.env.local

```env
# API 地址（局域网访问）
NEXT_PUBLIC_API_BASE_URL=http://your-server-ip:13100/api
```

### 3.3 创建 Docker 网络

```bash
docker network create common_network
```

### 3.4 配置文件权限

```bash
# 确保 Jenkins 可以读取配置文件
sudo chown -R jenkins:jenkins /opt/clawbot-manager
sudo chmod 600 apps/api/.env
sudo chmod 600 apps/api/config.local.yaml
```

## 四、首次部署

### 4.1 手动触发构建

1. 在 Jenkins 项目页面点击 "Build with Parameters"
2. 选择是否构建 BotEnv 镜像（首次部署建议勾选）
3. 选择 NPM 镜像源
4. 点击 "开始构建"

### 4.2 监控构建过程

1. 点击构建编号查看详情
2. 点击 "Console Output" 查看实时日志
3. 等待构建完成（首次构建约 10-20 分钟）

### 4.3 验证部署

```bash
# 检查容器状态
docker compose ps

# 检查服务健康状态
curl http://localhost:13100/health
curl http://localhost:13000

# 查看日志
docker compose logs -f api
docker compose logs -f web
```

## 五、Pipeline 说明

### 5.1 Pipeline 阶段

1. **环境检查**: 验证 Docker、Docker Compose 等工具
2. **代码检出**: 从 Git 仓库拉取最新代码
3. **环境准备**: 检查配置文件、创建 Docker 网络
4. **构建镜像**: 并行构建 API 和 Web 镜像
5. **构建 BotEnv 镜像**: 可选，用于 Bot 运行环境
6. **停止旧容器**: 停止并移除旧版本容器
7. **数据库迁移**: 执行 Prisma 数据库迁移
8. **启动服务**: 启动新版本容器
9. **健康检查**: 等待服务启动并验证健康状态
10. **清理旧镜像**: 清理未使用的 Docker 镜像

### 5.2 构建参数

- **BUILD_BOTENV**: 是否构建 BotEnv 镜像（默认 false）
- **NPM_REGISTRY**: NPM 镜像源选择

## 六、常见问题

### 6.1 构建失败：权限不足

```bash
# 确保 Jenkins 用户在 docker 组中
sudo usermod -aG docker jenkins
sudo systemctl restart jenkins
```

### 6.2 网络连接问题

如果遇到 npm 安装失败：

1. 修改 Jenkinsfile 中的 `NPM_REGISTRY` 为官方源
2. 或在服务器上配置代理

### 6.3 数据库迁移失败

```bash
# 手动执行迁移
cd /opt/clawbot-manager
docker compose run --rm api sh -c "cd /app/apps/api && npx prisma migrate deploy"
```

### 6.4 容器无法启动

```bash
# 查看详细日志
docker compose logs api
docker compose logs web

# 检查配置文件
cat apps/api/.env
cat apps/api/config.local.yaml
```

## 七、维护操作

### 7.1 查看日志

```bash
# 实时查看日志
docker compose logs -f

# 查看最近 100 行日志
docker compose logs --tail=100

# 查看特定服务日志
docker compose logs -f api
```

### 7.2 重启服务

```bash
cd /opt/clawbot-manager
docker compose restart api
docker compose restart web
```

### 7.3 备份数据

```bash
# 备份数据库
docker exec -t clawbot-api pg_dump -U user -d clawbot > backup_$(date +%Y%m%d).sql

# 备份 Docker volumes
docker run --rm -v clawbot-manager_clawbot-data:/data -v $(pwd):/backup \
    alpine tar czf /backup/clawbot-data-$(date +%Y%m%d).tar.gz /data
```

### 7.4 回滚版本

```bash
# 在 Jenkins 中选择之前成功的构建
# 点击 "Rebuild" 重新部署
```

## 八、安全建议

1. **配置文件安全**
   - 不要将 `.env` 文件提交到 Git
   - 使用 Jenkins Credentials 管理敏感信息
   - 限制配置文件权限为 600

2. **网络安全**
   - 使用防火墙限制端口访问
   - 配置 HTTPS（使用 Nginx 反向代理）
   - 限制 Jenkins 访问 IP

3. **Docker 安全**
   - 定期更新 Docker 镜像
   - 使用非 root 用户运行容器
   - 限制容器资源使用

## 九、监控和告警

### 9.1 配置 Jenkins 邮件通知

1. 安装 "Email Extension Plugin"
2. 在系统配置中设置 SMTP 服务器
3. 在 Jenkinsfile 的 `post` 部分添加邮件通知

### 9.2 集成监控系统

建议集成以下监控工具：

- **Prometheus + Grafana**: 监控容器资源使用
- **ELK Stack**: 集中日志管理
- **Uptime Kuma**: 服务可用性监控

## 十、性能优化

### 10.1 构建缓存

在 Jenkinsfile 中添加 Docker 构建缓存：

```groovy
sh """
    docker build \
        --cache-from ${API_IMAGE} \
        --build-arg BUILDKIT_INLINE_CACHE=1 \
        -t ${API_IMAGE} .
"""
```

### 10.2 并行构建

Pipeline 已配置并行构建 API 和 Web 镜像，无需额外配置。

### 10.3 资源限制

在 docker-compose.yml 中添加资源限制：

```yaml
services:
  api:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
```

## 联系支持

如有问题，请联系项目维护者或查看项目文档。
