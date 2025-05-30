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