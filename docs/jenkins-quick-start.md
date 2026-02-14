# Jenkins 部署快速开始

## 快速部署步骤（5 步完成）

### 步骤 1: 安装 Jenkins 和 Docker

```bash
# 安装 Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 安装 Jenkins（Ubuntu/Debian）
wget -q -O - https://pkg.jenkins.io/debian-stable/jenkins.io.key | sudo apt-key add -
sudo sh -c 'echo deb https://pkg.jenkins.io/debian-stable binary/ > /etc/apt/sources.list.d/jenkins.list'
sudo apt update
sudo apt install jenkins

# 配置权限
sudo usermod -aG docker jenkins
sudo systemctl restart jenkins
```

### 步骤 2: 准备配置文件

```bash
# 创建项目目录
sudo mkdir -p /opt/clawbot-manager
cd /opt/clawbot-manager

# 克隆代码
git clone <your-repo-url> .

# 复制配置文件模板
cp apps/api/.env.example apps/api/.env
cp apps/api/config.example.yaml apps/api/config.local.yaml
cp apps/web/.env.example apps/web/.env.local

# 编辑配置文件（修改数据库、Redis 等连接信息）
nano apps/api/.env
nano apps/api/config.local.yaml
nano apps/web/.env.local

# 创建 Docker 网络
docker network create common_network

# 设置权限
sudo chown -R jenkins:jenkins /opt/clawbot-manager
```

### 步骤 3: 创建 Jenkins Pipeline 项目

1. 访问 Jenkins: `http://your-server-ip:8080`
2. 新建任务 → 输入名称 → 选择 "Pipeline"
3. 配置 Git 仓库:
   - Pipeline → Pipeline script from SCM
   - SCM → Git
   - Repository URL → 填写仓库地址
   - Branch → `*/main` 或 `*/dev`
   - Script Path → `Jenkinsfile`

### 步骤 4: 首次构建

1. 点击 "Build with Parameters"
2. 勾选 "BUILD_BOTENV"（首次部署）
3. 点击 "开始构建"
4. 等待构建完成（约 10-20 分钟）

### 步骤 5: 验证部署

```bash
# 检查容器状态
docker compose ps

# 测试 API
curl http://localhost:13100/health

# 测试 Web
curl http://localhost:13000

# 访问应用
# Web: http://your-server-ip:13000
# API: http://your-server-ip:13100
```

## 最小配置示例

### apps/api/.env

```env
DATABASE_URL=postgresql://user:password@postgres-host:5432/clawbot
REDIS_URL=redis://redis-host:6379
JWT_SECRET=change-this-to-random-string
PORT=3200
```

### apps/web/.env.local

```env
NEXT_PUBLIC_API_BASE_URL=http://your-server-ip:13100/api
```

## 常用命令

```bash
# 查看日志
docker compose logs -f

# 重启服务
docker compose restart

# 停止服务
docker compose down

# 手动部署（不使用 Jenkins）
docker compose up -d --build
```

## 故障排查

### 问题 1: Jenkins 无法访问 Docker

```bash
sudo usermod -aG docker jenkins
sudo systemctl restart jenkins
```

### 问题 2: 构建失败 - 网络问题

修改 Jenkinsfile 中的 NPM_REGISTRY 为官方源：
```groovy
NPM_REGISTRY = 'https://registry.npmjs.org'
```

### 问题 3: 容器无法启动

```bash
# 查看详细日志
docker compose logs api
docker compose logs web

# 检查配置文件
cat apps/api/.env
```

## 下一步

- 配置自动触发构建（Webhook）
- 设置邮件通知
- 配置 HTTPS（Nginx 反向代理）
- 集成监控系统

详细文档请参考: [jenkins-deployment-guide.md](./jenkins-deployment-guide.md)
