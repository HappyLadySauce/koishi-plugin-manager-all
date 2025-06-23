# koishi-plugin-manager-all

[![npm](https://img.shields.io/npm/v/koishi-plugin-manager-all?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-manager-all)

一个功能完整的 Koishi 群管机器人插件，支持白名单管理、关键词过滤和消息监控。

## 功能特性

### 📝 消息监控
- **全面消息日志**：记录所有类型消息（文本、图片、语音等）
- **违规内容检测**：自动检测和标记可疑内容
- **特殊消息处理**：ping/pong 响应、帮助信息等
- **可调节日志级别**：支持 info/warn/error 三种级别

### ⚙️ 配置管理
- **白名单管理**：完整的 CRUD 操作支持
- **关键词管理**：分别管理通过和拒绝关键词
- **实时配置**：支持运行时修改配置
- **状态查询**：实时显示插件运行状态

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
      autoApprove: false          # 是否启用自动审批
      useWhitelist: true          # 是否启用白名单检查
      useKeywordFilter: true      # 是否启用关键词过滤
      welcomeMessage: "欢迎新朋友加入！请仔细阅读群公告。"
    whitelist:                    # QQ号白名单
      - "123456789"
      - "987654321"
    approvalKeywords:             # 自动通过关键词
      - "朋友推荐"
      - "学习交流"
    rejectionKeywords:            # 自动拒绝关键词
      - "广告"
      - "营销"
      - "推广"
    messageMonitor:
      enabled: true               # 是否启用消息监控
      logLevel: "info"            # 日志级别：info/warn/error
```

## 使用方法

### 白名单管理

```
whitelist                      # 查看白名单管理帮助
whitelist.add <QQ号>           # 添加白名单
whitelist.remove <QQ号>        # 移除白名单
whitelist.list                 # 查看白名单列表
whitelist.clear                # 清空白名单
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

### 其他功能

```
ping                          # 测试机器人响应
help                          # 显示帮助信息
manager.status                # 查看插件状态
```

## 兼容性

- **Koishi 版本**：^4.18.7 或更高版本
- **适配器支持**：OneBot v11/v12、QQ官方、Telegram 等
- **平台支持**：QQ、微信、Telegram、Discord 等

## 技术架构

- **模块化设计**：清晰的功能模块分离
- **中间件架构**：统一的消息处理和监控
- **TypeScript**：完整的类型定义支持
- **可扩展性**：易于添加新功能模块

## 许可证

MIT License
