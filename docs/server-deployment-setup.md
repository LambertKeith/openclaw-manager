# 服务器部署配置指南

本文档说明如何在服务器上准备 ClawBot Manager 项目的部署环境。

## 一、服务器端准备工作

### 1.1 在服务器上创建部署目录

```bash
# SSH 连接到服务器
ssh pardx@14.103.218.99

# 创建项目部署目录
cd ~/www
mkdir -p clawbot-deploy
cd clawbot-deploy
```

### 1.2 创建 docker-compose.yml

在 `~/www/clawbot-deploy/` 目录下创建 `docker-compose.yml` 文件：

```yaml
version: '3.8'

services:
  # API 服务
  clawbot-api:
    image: uhub.service.ucloud.cn/pardx/clawbot-api:latest
    container_name: clawbot-api
    restart: unless-stopped
    env_file:
      - .env
      - api.env
    environment:
      NODE_ENV: production
      PORT: 3200
    ports:
      - "13100:3200"
    volumes:
      - api-logs:/app/apps/api/logs
      - ./config.local.yaml:/app/apps/api/config.local.yaml:ro
      - ./keys:/app/apps/api/keys:ro
      - /var/run/docker.sock:/var/run/docker.sock
      - clawbot-data:/data/bots
      - clawbot-secrets:/data/secrets
      - ./secrets:/secrets:ro
    networks:
      - common_network
    extra_hosts:
      - 'host.docker.internal:host-gateway'
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:3200/health']
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s

  # Web 服务
  clawbot-web:
    image: uhub.service.ucloud.cn/pardx/clawbot-web:latest
    container_name: clawbot-web
    restart: unless-stopped
    env_file:
      - .env
      - web.env
    environment:
      NODE_ENV: production
      PORT: 3000
    ports:
      - "13000:3000"
    depends_on:
      clawbot-api:
        condition: service_healthy
    networks:
      - common_network
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:3000']
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s

networks:
  common_network:
    external: true

volumes:
  api-logs:
    name: clawbot-api-logs
  clawbot-data:
    name: clawbot-manager_clawbot-data
  clawbot-secrets:
    name: clawbot-manager_clawbot-secrets
```

### 1.3 创建环境变量文件

#### 创建 `.env` 文件（通用配置）

```bash
cat > .env << 'EOF'
# Docker 配置
DOCKER_PLATFORM=linux/amd64

# 端口配置
API_PORT=13100
WEB_PORT=13000

# 环境
NODE_ENV=production

# Bot 运行时配置
BOT_DATA_DIR=/data/bots
BOT_SECRETS_DIR=/data/secrets
BOTENV_IMAGE=uhub.service.ucloud.cn/pardx/clawbot-env:latest
DATA_VOLUME_NAME=clawbot-manager_clawbot-data
SECRETS_VOLUME_NAME=clawbot-manager_clawbot-secrets
EOF
```

#### 创建 `api.env` 文件（API 配置）

```bash
cat > api.env << 'EOF'
# 数据库连接（请修改为实际值）
DATABASE_URL=postgresql://user:password@your-db-host:5432/clawbot

# Redis 连接（请修改为实际值）
REDIS_URL=redis://your-redis-host:6379

# JWT 密钥（请修改为随机字符串）
JWT_SECRET=your-random-secret-key-change-this

# API 端口
PORT=3200

# 配置文件名
YAML_CONFIG_FILENAME=config.local.yaml
EOF

# 设置文件权限
chmod 600 api.env
```

#### 创建 `web.env` 文件（Web 配置）

```bash
cat > web.env << 'EOF'
# API 地址（请修改为实际服务器 IP 或域名）
NEXT_PUBLIC_API_BASE_URL=http://14.103.218.99:13100/api
EOF
```

### 1.4 创建配置文件

#### 创建 `config.local.yaml`

```bash
cat > config.local.yaml << 'EOF'
server:
  port: 3200

# 根据项目需求添加其他配置
EOF
```

#### 创建 keys 目录（如果需要）

```bash
mkdir -p keys
mkdir -p secrets
```

### 1.5 创建 Docker 网络

```bash
# 检查网络是否存在
docker network ls | grep common_network

# 如果不存在，创建网络
docker network create common_network
```

### 1.6 设置文件权限

```bash
# 确保配置文件权限正确
chmod 600 api.env
chmod 644 web.env
chmod 644 config.local.yaml
```

## 二、Jenkins 配置

### 2.1 在 Jenkins 中创建新项目

1. 访问 Jenkins：`http://your-jenkins-url:8080`
2. 点击 "New Item" 或 "新建任务"
3. 输入项目名称：`clawbot-manager`
4. 选择 "Pipeline"
5. 点击 "OK"

### 2.2 配置 Git 仓库

在项目配置页面：

**Pipeline 部分**：
- Definition：选择 "Pipeline script from SCM"
- SCM：选择 "Git"
- Repository URL：`https://github.com/iTechwu/openclaw-manager.git`
- Credentials：选择或添加 Git 凭据
- Branch Specifier：`*/dev`
- Script Path：`Jenkinsfile`

### 2.3 配置构建触发器（可选）

**Build Triggers 部分**：
- 勾选 "Poll SCM"
- Schedule：`H/5 * * * *`（每 5 分钟检查一次代码变更）

### 2.4 确认凭据配置

确保 Jenkins 中已配置以下凭据：

1. **ucloud-docker**：UCloud 镜像仓库凭据
   - Kind: Username with password
   - Username: UCloud 账号
   - Password: UCloud 密码

2. **ecs-ubuntu-pardxai-03-platform**：服务器 SSH 凭据
   - Kind: Username with password
   - Username: pardx
   - Password: 服务器密码

## 三、首次部署

### 3.1 手动触发构建

1. 在 Jenkins 项目页面点击 "Build with Parameters"
2. 勾选 "BUILD_BOTENV"（首次部署需要构建 Bot 环境镜像）
3. 点击 "Build"

### 3.2 监控构建进度

1. 点击构建编号查看详情
2. 点击 "Console Output" 查看实时日志
3. 等待构建完成（首次构建约 15-30 分钟）

### 3.3 验证部署

在服务器上执行：

```bash
# 检查容器状态
cd ~/www/clawbot-deploy
sudo docker compose ps

# 查看日志
sudo docker compose logs -f clawbot-api
sudo docker compose logs -f clawbot-web

# 测试服务
curl http://localhost:13100/health
curl http://localhost:13000
```

## 四、日常维护

### 4.1 查看服务状态

```bash
cd ~/www/clawbot-deploy
sudo docker compose ps
```

### 4.2 查看日志

```bash
# 实时查看日志
sudo docker compose logs -f

# 查看最近 100 行日志
sudo docker compose logs --tail=100

# 查看特定服务日志
sudo docker compose logs -f clawbot-api
sudo docker compose logs -f clawbot-web
```

### 4.3 重启服务

```bash
# 重启所有服务
sudo docker compose restart

# 重启特定服务
sudo docker compose restart clawbot-api
sudo docker compose restart clawbot-web
```

### 4.4 更新部署

1. 推送代码到 Git 仓库
2. Jenkins 自动检测到变更并触发构建
3. 或手动在 Jenkins 中点击 "Build Now"

### 4.5 回滚版本

```bash
# 使用特定日期的镜像标签
cd ~/www/clawbot-deploy

# 编辑 docker-compose.yml，修改镜像标签
# 例如：uhub.service.ucloud.cn/pardx/clawbot-api:20250215-1430

# 重新部署
sudo docker compose up -d --force-recreate
```

## 五、故障排查

### 5.1 容器无法启动

```bash
# 查看详细日志
sudo docker compose logs clawbot-api
sudo docker compose logs clawbot-web

# 检查配置文件
cat api.env
cat web.env
cat config.local.yaml
```

### 5.2 数据库连接失败

```bash
# 检查数据库连接
# 在 api.env 中确认 DATABASE_URL 配置正确

# 测试数据库连接
docker run --rm postgres:15 psql "postgresql://user:password@host:5432/clawbot" -c "SELECT 1"
```

### 5.3 端口冲突

```bash
# 检查端口占用
netstat -tlnp | grep 13100
netstat -tlnp | grep 13000

# 如果端口被占用，修改 docker-compose.yml 中的端口映射
```

### 5.4 镜像拉取失败

```bash
# 手动拉取镜像
sudo docker pull uhub.service.ucloud.cn/pardx/clawbot-api:latest
sudo docker pull uhub.service.ucloud.cn/pardx/clawbot-web:latest

# 检查 UCloud 镜像仓库凭据
sudo docker login uhub.service.ucloud.cn
```

## 六、安全建议

1. **配置文件安全**
   - 不要将 `.env` 文件提交到 Git
   - 限制配置文件权限为 600
   - 定期更换密钥和密码

2. **网络安全**
   - 使用防火墙限制端口访问
   - 配置 HTTPS（使用 Nginx 反向代理）
   - 限制 SSH 访问 IP

3. **备份策略**
   - 定期备份数据库
   - 备份 Docker volumes
   - 保留多个版本的镜像

## 七、联系支持

如有问题，请联系项目维护者或查看项目文档。
