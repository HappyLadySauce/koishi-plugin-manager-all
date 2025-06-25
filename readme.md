# koishi-plugin-manager-all

[![npm](https://img.shields.io/npm/v/koishi-plugin-manager-all?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-manager-all)

一个功能完整的 Koishi 群管机器人插件，支持白名单管理、关键词过滤、消息监控和智能入群审批。

## 功能特性

### 🤖 智能入群审批
- **自动审批系统**：根据白名单和关键词自动处理入群申请
- **白名单优先**：支持白名单用户优先通过
- **关键词过滤**：基于申请消息内容智能判断
- **自定义拒绝消息**：为被拒绝的申请提供个性化说明

### 📋 白名单管理
- **完整 CRUD 操作**：添加、删除、查看白名单用户
- **批量操作**：支持批量添加多个用户
- **群组导入**：一键导入当前群组成员
- **灵活控制**：可选择是否自动拒绝非白名单用户

### 🔑 关键词过滤
- **双向过滤**：分别设置通过和拒绝关键词
- **智能匹配**：基于申请消息内容进行关键词匹配
- **优先级控制**：关键词与白名单的优先级可配置
- **实时管理**：支持运行时添加、删除关键词

### 💬 消息管理
- **欢迎消息**：新成员加入时自动发送个性化欢迎
- **拒绝消息**：为被拒绝的申请提供友好的解释
- **开关控制**：可独立启用/禁用欢迎消息功能
- **内容自定义**：支持自定义欢迎和拒绝消息内容

### 📝 消息监控
- **全面消息日志**：记录所有类型消息（文本、图片、语音等）
- **违规内容检测**：自动检测和标记可疑内容
- **特殊消息处理**：ping/pong 响应、帮助信息等
- **可调节日志级别**：支持 info/warn/error 三种级别

### ⚙️ 配置管理
- **实时配置**：支持运行时修改所有配置项
- **状态查询**：实时显示插件运行状态
- **调试模式**：提供详细的事件监听和调试信息
- **兼容性强**：支持多种适配器和事件格式

## 安装

```bash
npm install koishi-plugin-manager-all
```

或者使用 yarn：

```bash
yarn add koishi-plugin-manager-all
```

## 配置

```yaml
plugins:
  manager-all:
    groupManagement:
      autoApprove: false                    # 是否启用自动审批
      useWhitelist: true                    # 是否启用白名单检查
      autoRejectNonWhitelist: true          # 是否自动拒绝非白名单用户
      useKeywordFilter: true                # 是否启用关键词过滤
      enableWelcome: true                   # 是否启用入群欢迎消息
      welcomeMessage: "欢迎新朋友加入！请仔细阅读群公告。"
      rejectionMessage: "很抱歉，您的入群申请不符合要求。"
    whitelist:                              # QQ号白名单
      - "123456789"
      - "987654321"
    approvalKeywords:                       # 自动通过关键词
      - "朋友推荐"
      - "学习交流"
    rejectionKeywords:                      # 自动拒绝关键词
      - "广告"
      - "营销"
      - "推广"
    messageMonitor:
      enabled: true                         # 是否启用消息监控
      logLevel: "info"                      # 日志级别：info/warn/error
```

## 使用方法

### 白名单管理

```
whitelist                      # 查看白名单管理帮助
whitelist.add <QQ号>           # 添加单个白名单
whitelist.batch <QQ号列表>     # 批量添加白名单
whitelist.import               # 从当前群组导入成员
whitelist.remove <QQ号>        # 移除白名单
whitelist.list                 # 查看白名单列表
whitelist.clear                # 清空白名单
whitelist.reject-toggle        # 切换白名单自动拒绝功能
```

**批量添加示例：**
```
whitelist.batch 123456789,987654321,555666777
whitelist.batch 123456789 987654321 555666777
```

### 关键词管理

```
keywords                       # 查看关键词管理帮助
keywords.approval.add <关键词>  # 添加通过关键词
keywords.approval.remove <关键词> # 移除通过关键词
keywords.approval.list         # 查看通过关键词列表
keywords.rejection.add <关键词> # 添加拒绝关键词
keywords.rejection.remove <关键词> # 移除拒绝关键词
keywords.rejection.list        # 查看拒绝关键词列表
keywords.list                  # 查看所有关键词
```

### 消息管理

```
message                        # 查看消息管理帮助
message.welcome.set <消息>     # 设置欢迎消息
message.welcome.get            # 查看当前欢迎消息
message.welcome.toggle         # 启用/禁用欢迎功能
message.rejection.set <消息>   # 设置拒绝消息
message.rejection.get          # 查看当前拒绝消息
message.list                   # 查看所有消息配置
```

**设置消息示例：**
```
message.welcome.set 欢迎新朋友加入我们的大家庭！请遵守群规，友善交流。
message.rejection.set 很抱歉，本群暂时不接受新成员申请，请稍后再试。
```

### 群组管理

```
group.info                     # 查看群组信息
group.config                   # 查看群管配置
```

### 监控管理

```
monitor.toggle                 # 切换消息监控状态
monitor.level <级别>           # 设置监控日志级别
```

### 系统功能

```
ping                          # 测试机器人响应
help                          # 显示帮助信息
manager.status                # 查看插件状态
manager.debug                 # 开启调试模式
```

## 使用场景

### 🏢 企业群组管理
- **严格准入控制**：启用白名单 + 自动拒绝，确保只有授权人员加入
- **关键词审核**：过滤广告、营销等不当申请
- **自动化流程**：减少管理员手动审核工作量

### 👥 社区群组管理
- **灵活准入**：白名单 + 关键词组合，平衡开放性和安全性
- **友好体验**：自定义欢迎和拒绝消息，提升用户体验
- **活动监控**：实时监控群组消息，及时发现异常

### 🎓 学习交流群
- **学术导向**：通过关键词过滤确保申请者符合学习目的
- **成员管理**：批量导入现有成员到白名单
- **氛围维护**：欢迎消息引导新成员了解群规

## 配置策略

### 严格模式
```yaml
groupManagement:
  autoApprove: true
  useWhitelist: true
  autoRejectNonWhitelist: true
  useKeywordFilter: false
```
适用于：企业内部群、私密群组

### 平衡模式
```yaml
groupManagement:
  autoApprove: true
  useWhitelist: true
  autoRejectNonWhitelist: false
  useKeywordFilter: true
```
适用于：半开放社区、兴趣群组

### 开放模式
```yaml
groupManagement:
  autoApprove: true
  useWhitelist: false
  autoRejectNonWhitelist: false
  useKeywordFilter: true
```
适用于：公开交流群、大型社区

## 兼容性

- **Koishi 版本**：^4.18.7 或更高版本
- **适配器支持**：OneBot v11/v12、QQ官方、Telegram 等
- **平台支持**：QQ、微信、Telegram、Discord 等
- **事件兼容**：自动适配不同适配器的事件格式

## 技术架构

- **模块化设计**：清晰的功能模块分离
- **中间件架构**：统一的消息处理和监控
- **事件兼容**：支持多种入群申请事件格式
- **TypeScript**：完整的类型定义支持
- **可扩展性**：易于添加新功能模块
- **调试友好**：提供详细的事件监听和调试信息

## 许可证

MIT License

## 作者

作者的个人博客网站：[https://www.happyladysauce.cn](https://www.happyladysauce.cn)

作者的github：[https://github.com/HappyLadySauce](https://github.com/HappyLadySauce)

联系作者：
- 邮箱：13452552349@163.com
- QQ: 1552089234