/**
 * 运行时路径注册 — 只注册 @prisma/client 映射
 *
 * 不能直接用 tsconfig-paths/register，因为它会加载 tsconfig.json 中所有 paths，
 * 把 @repo/utils/* 映射到 .ts 源文件，导致 Node.js 运行时 ERR_MODULE_NOT_FOUND。
 *
 * 运行时各别名的解析方式：
 *   @prisma/client  → 本脚本映射到 ./generated/prisma-client（Prisma 7 自定义 output）
 *   @repo/*         → pnpm workspace symlink + package.json exports
 *   @app/*, @/*, src/* → NestJS CLI 编译时已转换为相对路径
 */
const { register } = require('tsconfig-paths');
const path = require('path');

register({
  baseUrl: path.resolve(__dirname),
  paths: {
    '@prisma/client': ['./generated/prisma-client'],
    '@prisma/client/*': ['./generated/prisma-client/*'],
  },
});
