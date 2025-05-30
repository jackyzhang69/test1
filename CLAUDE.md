# CLAUDE.md - 项目重要记忆

## 数据库操作原则（极其重要）

### 🚨 绝对原则
1. **绝对不可以更改数据库数据** - 只能读取，不能修改、添加或删除任何数据
2. **只能通过user_id查询RCIC归属** - 不能使用email或其他字段
3. **临时代码必须在使用后删除** - 所有tmp-*.js文件必须清理

## MongoDB查询方法

### 优先使用mongo命令行
```bash
# 连接格式
mongo "mongodb+srv://jacky:Zxy690211@noah.yi5fo.mongodb.net/visa?retryWrites=true&w=majority" --quiet --eval "查询命令"

# 示例：查询用户
mongo "mongodb+srv://jacky:Zxy690211@noah.yi5fo.mongodb.net/visa?retryWrites=true&w=majority" --quiet --eval "db.user.find({ email: 'noah.consultant@outlook.com' })"

# 示例：统计RCIC
mongo "mongodb+srv://jacky:Zxy690211@noah.yi5fo.mongodb.net/visa?retryWrites=true&w=majority" --quiet --eval "db.rcic.count({ owner_ids: ObjectId('65fa0d42467e67fe369364dc') })"
```

### RCIC查询逻辑
1. **RCIC归属通过owner_ids字段确定**
   - owner_ids是ObjectId数组，不是字符串
   - 查询格式：`{ owner_ids: ObjectId("用户ID") }`

2. **多用户查询使用$in操作符**
   ```javascript
   {
     owner_ids: { $in: [ObjectId("ID1"), ObjectId("ID2")] },
     is_active: true
   }
   ```

3. **重要用户ID**
   - Noah: 65fa0d42467e67fe369364dc (noah.consultant@outlook.com)
   - Amy: 663064806f49911d89f13b95 (noah.amy@outlook.com)

## JobBank Inviter功能

### 🚨 极其重要：只登录一次
- **必须使用 `runJobbankInviterMultiple` API** - 批量处理所有job posts
- **绝对不要循环调用单个job的API** - 那会导致多次登录
- **后端已实现 `inviteMultipleJobPosts` 方法** - 一次登录，处理所有任务
- **前端调用方式**：
  ```javascript
  // 正确 ✓
  const result = await window.api.runJobbankInviterMultiple(
    rcicData,
    jobPosts,  // 传递所有job posts数组
    itemsPerPage,
    headless,
    timeout
  );
  
  // 错误 ✗ - 不要这样做！
  for (let job of jobPosts) {
    await window.api.runJobbankInviter(...);  // 这会导致多次登录
  }
  ```

### 关键映射关系
- **LMIA portal就是JobBank portal** - 使用相同的登录凭据
- **LMIA SQA就是JobBank SQA** - 使用相同的安全问题

### UI要求
1. 移除了Items Per Page选项（默认使用100）
2. Minimum Stars（不是Score），默认值为2
3. 日志格式：`时间: 消息`（如 "10:32:31 AM: after fill username"）

### 🎯 Dark Mode UI 已完成
- **Form Filling 的 Dark Mode UI 已经完成定稿** ✅
- **JobBank Inviter 的 Dark Mode UI 已经完成定稿** ✅
- **绝对不要再修改这两个功能在 Dark Mode 下的界面样式**
- 配色方案已统一为蓝色系主题
- 所有组件样式已优化完成
- 功能完整，用户体验良好

## JobBank Inviter - 功能与逻辑总结 🔒

### 🎯 核心目的
使用RCIC账户凭据在JobBank平台自动化候选人邀请流程。

### 🔧 核心组件

#### 1. 认证流程
- 登录流程：RCIC用户名/密码 → 安全问题 → 访问job posts
- **不重试**：用户名/密码错误、安全问题错误
- **重试**：仅限会话过期

#### 2. Job Post处理
- 导航到job post URL → 验证存在性 → 设置分页 → 按分数排序
- **不重试**：Job post未找到(404)、无效ID、待审核posts
- **重试**：网络超时、加载问题（3次尝试）

#### 3. 候选人邀请
- 查找符合最低星级的候选人 → 点击档案 → 发送邀请 → 返回列表
- **不重试**：永久性错误（凭据/job post问题）
- **重试**：网络/UI失败（2次尝试）

### ⚙️ 技术设置
- **默认超时**：30秒（UI/后端一致）
- **重试延迟**：2-4秒随机化
- **单次登录**：一次会话处理多个job posts

### 🛡️ 验证规则
1. 必须选择RCIC账户
2. 至少需要一个job post ID
3. Job post ID不能为空
4. 最低星级必须在1-5范围内
5. 成功确认显示账户名称+job数量

### 🔄 错误处理
- **立即失败**：无效凭据、job post错误、验证失败
- **智能重试**：网络问题、临时加载问题
- **状态更新**：实时进度与清晰的重试消息
- **继续处理**：单个候选人失败不会停止job处理

### 📊 结果
- 返回逐个job的邀请计数
- 跟踪发送的总邀请数
- 记录所有错误并分类
- 提供完成摘要

**状态**: ✅ **已锁定** - 未经用户批准不得修改

## 代码规范
1. 调试信息只删除jobbank inviter相关的
2. 其他功能的调试信息保留
3. 临时脚本创建在项目目录，文件名格式：tmp-*.js
4. 使用后立即删除临时文件

## 数据库结构说明
- formfillingdata集合：使用user_id字段（字符串格式）
- rcic集合：使用owner_ids字段（ObjectId数组格式）
- MongoDB Playground显示的`{"$oid": "..."}`只是JSON表示，实际存储的是ObjectId对象

## UI设计规范
生成界面时必须参考 `docs/ui_style.md` 文件，确保界面风格一致性。

## 测试和验证命令
```bash
# 快速检查命令
npm run lint          # 代码风格检查
npm run typecheck     # 类型检查（如果有）
```

---
最后更新：2025-01-29