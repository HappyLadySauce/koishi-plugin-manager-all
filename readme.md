# koishi-plugin-group-master

[![npm](https://img.shields.io/npm/v/koishi-plugin-group-master?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-group-master)
[![npm downloads](https://img.shields.io/npm/dm/koishi-plugin-group-master?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-group-master)
[![license](https://img.shields.io/npm/l/koishi-plugin-group-master?style=flat-square)](https://github.com/HappyLadySauce/koishi-plugin-group-master/blob/main/LICENSE)
[![koishi](https://img.shields.io/badge/koishi-%3E%3D4.18.7-blue?style=flat-square)](https://koishi.chat/)

一个功能完整的 Koishi 群管机器人插件，支持**严格姓名验证**、智能白名单管理、通用规则引擎、关键词过滤和消息监控。专为需要严格控制入群条件的内部群组设计。

## ✨ 核心特性

### 🔐 **严格姓名验证** (NEW!)
- **姓名白名单验证**：只允许填写了指定姓名的申请通过
- **智能拒绝引导**：自动提示用户填写正确姓名重新申请
- **优先级控制**：姓名验证优先级最高，适合内部群组
- **防误操作**：友好的错误提示，避免用户因填错姓名被永久拒绝

### 🤖 **通用规则引擎** (NEW!)
- **多种条件类型**：QQ号、姓名、关键词、数据库查询、自定义表达式
- **灵活操作符**：等于、包含、匹配、在列表中等多种判断方式
- **优先级驱动**：按规则优先级顺序执行，支持复杂审批逻辑
- **预设规则模板**：快速创建常用规则，开箱即用
- **安全执行环境**：自定义表达式支持安全的JavaScript执行

### 💾 **数据库集成** (NEW!)
- **持久化存储**：配置、白名单、规则等数据持久化保存
- **多群组支持**：每个群组独立的配置和数据
- **自动降级**：数据库不可用时自动使用配置文件存储
- **完整CRUD**：支持数据的增删改查操作

### 📋 **智能白名单管理**
- **双重白名单**：支持QQ号白名单 + 姓名白名单
- **批量操作增强**：智能格式清理、多种分隔符支持
- **快速添加命令**：`whitelist.quick` 和 `names.quick` 智能解析
- **群组导入**：一键导入当前群组成员到白名单

### 🎯 **模块化架构**
- **清晰的文件结构**：类型定义、数据库服务、命令处理器分离
- **可扩展设计**：易于添加新功能模块
- **类型安全**：完整的TypeScript类型定义
- **错误处理**：完善的错误处理和日志记录

## 📦 安装

```bash
npm install koishi-plugin-group-master
```

或者使用 yarn：

```bash
yarn add koishi-plugin-group-master
```

## ⚙️ 配置

```yaml
plugins:
  group-master:
    groupManagement:
      autoApprove: true                     # 启用自动审批
      useWhitelist: false                   # QQ号白名单（严格姓名验证时可关闭）
      autoRejectNonWhitelist: false         # 自动拒绝非QQ号白名单用户
      useKeywordFilter: false               # 关键词过滤（严格姓名验证时可关闭）
      useNameValidation: true               # 🔥 启用严格姓名验证
      enableWelcome: true                   # 启用入群欢迎消息
      welcomeMessage: "欢迎加入群聊！请仔细阅读群公告。"
      rejectionMessage: "很抱歉，您的入群申请不符合要求。"
      nameValidationMessage: "申请被拒绝：请填写完整真实姓名后重新申请。如姓名填写正确但仍被拒绝，请联系群管理员添加到白名单。"
    whitelist: []                           # QQ号白名单
    nameWhitelist: []                       # 🔥 姓名白名单
    approvalKeywords:                       # 自动通过关键词
      - "朋友推荐"
      - "学习交流"
    rejectionKeywords:                      # 自动拒绝关键词
      - "广告"
      - "营销"
      - "推广"
    messageMonitor:
      enabled: true                         # 启用消息监控
      logLevel: "info"                      # 日志级别：info/warn/error
    database:
      enabled: true                         # 🔥 启用数据库存储
      tableName: "group_master_config"      # 数据库表前缀
```

## 🚀 使用方法

### 🎯 典型使用场景

#### 内部群组（推荐配置）
```bash
# 1. 启用严格姓名验证
names.validation-toggle

# 2. 添加员工姓名到白名单
names.batch 张三,李四,王五

# 3. 查看配置状态
master.status
```

### 👤 姓名白名单管理（核心功能）

```bash
names                          # 查看姓名白名单帮助
names.add 张三                 # 添加单个姓名
names.batch 张三,李四,王五      # 批量添加姓名
names.quick "张 三"            # 快速添加（智能清理格式）
names.remove 张三              # 移除姓名
names.list                     # 查看姓名白名单
names.clear                    # 清空姓名白名单
names.validation-toggle        # 🔥 切换严格姓名验证模式
```

**批量添加示例：**
```bash
# 支持多种格式
names.batch 张三,李四,王五
names.batch 张三 李四 王五
names.batch "张三
李四
王五"
```

### 🔧 通用规则管理（高级功能）

```bash
rules                          # 查看规则管理帮助
rules.list                     # 查看规则列表
rules.preset.whitelist         # 创建QQ号白名单规则
rules.preset.names             # 创建姓名验证规则
rules.preset.keywords 广告,营销 # 创建关键词过滤规则
rules.delete <规则ID>          # 删除规则
rules.toggle <规则ID>          # 启用/禁用规则
rules.priority <规则ID> <优先级> # 设置规则优先级
rules.test <规则ID> <测试消息>  # 测试规则
```

### 📋 QQ号白名单管理

```bash
whitelist                      # 查看QQ号白名单帮助
whitelist.add 123456789        # 添加单个QQ号
whitelist.quick @123456789     # 快速添加（智能解析）
whitelist.batch 123,456,789    # 批量添加QQ号
whitelist.import               # 从当前群组导入成员
whitelist.remove 123456789     # 移除QQ号
whitelist.list                 # 查看QQ号白名单
whitelist.clear                # 清空QQ号白名单
whitelist.reject-toggle        # 切换自动拒绝功能
```

### 👥 群组管理

```bash
group.config                   # 查看群管配置
master.status                  # 查看插件状态
master.debug                   # 开启调试模式
```

### 💬 消息管理

```bash
message                        # 查看消息管理帮助
message.welcome.set <消息>     # 设置欢迎消息
message.welcome.toggle         # 启用/禁用欢迎功能
message.rejection.set <消息>   # 设置拒绝消息
```

### 🔍 系统功能

```bash
ping                          # 测试机器人响应
help                          # 显示完整帮助信息
```

## 📊 使用场景和配置策略

### 🏢 企业内部群（推荐）
```yaml
groupManagement:
  useNameValidation: true      # ✅ 启用严格姓名验证
  useWhitelist: false          # ❌ 关闭QQ号白名单
  useKeywordFilter: false      # ❌ 关闭关键词过滤
```
- **适用场景**：公司内部群、部门群
- **特点**：只有填写正确姓名的员工才能加入
- **优势**：最严格的准入控制，防止外部人员进入

### 🎓 学习交流群
```yaml
groupManagement:
  useNameValidation: true      # ✅ 启用姓名验证
  useKeywordFilter: true       # ✅ 启用关键词过滤
  useWhitelist: false          # ❌ 关闭QQ号白名单
```
- **适用场景**：课程群、研讨会群
- **特点**：姓名验证 + 关键词过滤
- **优势**：确保成员身份同时过滤无关申请

### 👥 半开放社区群
```yaml
groupManagement:
  useNameValidation: false     # ❌ 关闭姓名验证
  useWhitelist: true           # ✅ 启用QQ号白名单
  useKeywordFilter: true       # ✅ 启用关键词过滤
```
- **适用场景**：兴趣群、技术交流群
- **特点**：传统白名单 + 关键词组合
- **优势**：平衡开放性和安全性

## 🔄 工作流程

### 严格姓名验证模式
```
入群申请 → 提取申请消息 → 检查姓名白名单 → 通过/拒绝
                                   ↓
                              发送引导消息
```

### 传统模式
```
入群申请 → QQ号白名单检查 → 关键词过滤 → 规则引擎 → 通过/拒绝
```

## 💡 最佳实践

### 1. 内部群组管理
```bash
# 启用严格姓名验证
names.validation-toggle

# 批量导入员工姓名
names.batch "张三,李四,王五,赵六,孙七"

# 设置友好的拒绝提示
message.rejection.set "请填写您的真实姓名重新申请，格式：姓名（如：张三）"
```

### 2. 多层次准入控制
```bash
# 创建多个规则实现复杂逻辑
rules.preset.names           # 优先级 5：姓名验证
rules.preset.keywords 广告   # 优先级 20：关键词拦截
rules.preset.whitelist       # 优先级 10：QQ白名单
```

### 3. 数据备份与迁移
由于启用了数据库存储，数据会自动持久化。重要数据建议定期备份：
- QQ号白名单：`whitelist.list`
- 姓名白名单：`names.list`  
- 规则配置：`rules.list`

## 🔧 技术架构

### 模块化设计
```
src/
├── types/           # 类型定义
├── config/          # 配置Schema
├── database/        # 数据库服务层
├── handlers/        # 业务处理器
│   ├── group-request.ts  # 入群申请处理
│   └── rule-engine.ts    # 通用规则引擎
├── commands/        # 命令处理器
│   ├── base.ts      # 基础命令类
│   ├── whitelist.ts # QQ号白名单管理
│   ├── names.ts     # 姓名白名单管理
│   └── rules.ts     # 规则管理
├── utils/          # 工具函数
└── index.ts        # 主入口
```

### 数据库Schema
- `group_master_config` - 配置表
- `group_master_whitelist` - QQ号白名单表
- `group_master_name_whitelist` - 姓名白名单表  
- `group_master_keywords` - 关键词表
- `group_master_rules` - 规则表

## 🐛 故障排除

### 常见问题

1. **入群申请没有响应**
   ```bash
   master.debug  # 开启调试模式查看事件监听
   ```

2. **姓名验证不生效**
   ```bash
   names.validation-toggle  # 检查是否启用严格验证
   names.list              # 确认姓名白名单不为空
   ```

3. **数据库连接失败**
   - 插件会自动降级到配置文件存储
   - 检查数据库配置是否正确

## 🔄 更新日志

### v3.0.0 (Latest)
- ✨ 新增严格姓名验证功能
- ✨ 新增通用规则引擎系统
- ✨ 新增数据库集成支持
- 🔧 完整重构为模块化架构
- 🚀 优化批量操作，支持智能格式清理
- 📝 增强错误处理和用户体验

### v2.x.x
- 基础群管功能
- QQ号白名单管理
- 关键词过滤

## 🔗 兼容性

- **Koishi 版本**：^4.18.7 或更高版本
- **Node.js 版本**：^16.0.0 或更高版本
- **适配器支持**：OneBot v11/v12、QQ官方、Telegram 等
- **平台支持**：QQ、微信、Telegram、Discord 等
- **数据库支持**：SQLite、MySQL、PostgreSQL、MongoDB

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 👤 作者信息

**作者**: HappyLadySauce

- 🌐 个人博客: [https://www.happyladysauce.cn](https://www.happyladysauce.cn)
- 🐙 GitHub: [https://github.com/HappyLadySauce](https://github.com/HappyLadySauce)
- 📧 邮箱: 13452552349@163.com
- 💬 QQ: 1552089234

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## ⭐ Star History

如果这个插件对你有帮助，请给个 Star 支持一下！

---

**让群组管理变得简单而强大** ✨